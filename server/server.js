/* 
 * Node.js OPC Playback API Interface
 * 
 * flexion 2015
 *
 * Version 25.04.2016 17:12
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); 
 * you may not use this file except in compliance with the License. 
 * You may obtain a copy of the License at:
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software 
 * distributed under the License is distributed on an "AS IS" BASIS, 
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or 
 * implied. See the License for the specific language governing 
 * permissions and limitations under the License.
 * 
 * --- API calls: ----------

- GET	/api/				Return general information (datastore, version, status opc connection etc)
- GET	/api/status			Return general information w/o datastore (version, status opc connection etc)
- POST	/api/savedatastore		Save current datastore to datastore.json on server disk
- POST	/api/reloaddatastore		Discard current datastore and reload datastore.json from server disk
- POST  /animations/rescan		scan for new files in animations folder on server
- GET	/api/playlists/list		Lists all available playlists
- GET	/api/playlists/show/:plname	List specified playlist
- POST	/api/playlists/play		Play specified playlist (POST options: name)
- POST 	/api/playlists/set		Upload a new or modified playlist
- POST	/api/playlists/delete/:plname	Remove specified playlist
- POST	/api/playlists/save		Save playlists to datastore file
- GET	/api/anim/list			List all available animations
- POST 	/api/anim/play			Play specified animation (POST options: file, framerate, repeat)
- POST	/api/anim/stop			Stop playback (POST options: clearscreen)
- POST	/api/powersupply		Toggle power supply ON/OFF via GPIO port on raspberry (POST options: state=ON/OFF)
 
*/

var version = "25.04.2016-17:12";
var datastoreFilename="datastore.json";
var datastore=[];

var opcHost; 		// fcserver host (fadecandy) will be read from datastore.json
var opcPort = 7890; // default fcserver port (fadecandy)
var port = 8082;	// set our port (will be replaced with value read from datastore.json)

var express    = require('express');        // call express
var app        = express();                 // define our app using express
var bodyParser = require('body-parser');
var fs 	       = require('fs');

var exec = require('child_process').exec;
var powerSupplyEnabled; 

var OPCPlayer = new require('./opcplayerlib')
var opcplayer;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// API endpoints
// --------------------
var router = express.Router();              // get an instance of the express Router

// GET /api
router.get('/', function(req, res) {
      readGPIOPowerSupplyStatus(); // read GPIO pin of powersupply relay
      res.json( getDefaultServerInfoResponse(true) ); 
});
// GET /api/status 	// list status objects without datastore
router.get('/status', function(req, res) { 
      readGPIOPowerSupplyStatus(); // read GPIO pin of powersupply relay
      res.json( getDefaultServerInfoResponse(false));
});

// POST	/api/savedatastore		Write datastore.json to disk
router.route('/savedatastore')
    .post(function(req, res) {
      saveDataStore();
      res.json( getDefaultServerInfoResponse(false) );
    });

// POST	/api/reloaddatastore		Discard in-memory datastore and reload from datastore.json on disk
router.route('/reloaddatastore')
    .post(function(req, res) {
	loadDataStoreFromDisk();
      res.json( getDefaultServerInfoResponse(true) );
    });
// POST /api/animations/rescan
router.route('/animations/rescan')
    .post(function(req, res) {
	scanAnimationsFolder();
      res.json( getDefaultServerInfoResponse(true) );
    });
// GET	/api/playlists/list		Lists all available playlists
router.route('/playlists/list')
    .get(function(req, res) {
        res.json({ "rc": "OK",  "playlists": datastore.playlists });
    });
// GET	/api/playlists/show/:plname	List specified playlist
router.route('/playlists/show/:plname')
    .get(function(req, res) {
	var rcPlaylist = null;
	for (var i=0;i<datastore.playlists.length;i++) if (datastore.playlists[i].name==req.params.plname) rcPlaylist = datastore.playlists[i];
        res.json({ "rc": "OK",  "playlist": rcPlaylist });
    });
// GET	/api/anim/list			List all available animations
router.route('/anim/list')
    .get(function(req, res) {
        res.json({ "rc": "OK",  "animations": datastore.animations });
    });

// POST /api/anim/play		Play specified animation (POST options: framerate, repeat)
router.route('/anim/play')
    .post(function(req, res) {
      var rcFileObj = searchAnimation(req.body.file);
      if (rcFileObj==null) {
        res.json({ "rc": "OK", "error": "File not found in animations list" });
	return;
      }
      // set overrides
      if (req.body.framerate) rcFileObj.framerate = parseInt(req.body.framerate);
      if (req.body.repeat) rcFileObj.repeat = parseInt(req.body.repeat);
      opcplayer.playFile(rcFileObj);
      res.json( getDefaultServerInfoResponse(false) ); 
    });

// POST	/api/playlists/play	Play specified playlist
router.route('/playlists/play')
    .post(function(req, res) {
      var objPlaylist = searchPlaylist(req.body.playlistname);
      if (objPlaylist==null) {
        res.json({ "rc": "OK", "playlist": null, "error": "Playlist not found" });
	return;
      }
      opcplayer.playPlaylist(objPlaylist);
      res.json( getDefaultServerInfoResponse(false) );
    });

// POST	/api/anim/stop			Stop playback (POST options: clearscreen)
router.route('/anim/stop')
    .post(function(req, res) {
      var clr=req.body.clearscreen=="1"?true:false; 
      opcplayer.stopPlayback(clr);
      res.json( getDefaultServerInfoResponse(false) );
    });

// POST	/api/playlists/save		Save playlists in datastore from memory to disk
router.route('/playlists/save')
    .post(function(req, res) {
      saveDataStore();
      res.json({ "rc": "OK" });
    });
// POST	/api/playlists/delete	Remove specified playlist
router.route('/playlists/delete')
    .post(function(req, res) {
      if (removePlaylist(req.body.name)) {
        res.json({ "rc": "OK", "datastore": datastore });
       } else {
        res.json({ "rc": "OK", "error": "Playlist not found" });
      }
    });
// POST 	/api/playlists/set	Upload a new or modified playlist
router.route('/playlists/set')
    .post(function(req, res) {
      if (updatePlaylist(req.body.plid, req.body.oPlaylist)) {
	res.json( getDefaultServerInfoResponse(true) );
       } else {
        res.json({ "rc": "OK", "error": "Playlist not found" });
      }
    });

// POST	/api/powersupply 	Toggle external relay
router.route('/powersupply')
    .post(function(req, res) {
      console.log("Changing power supply state: " + req.body.state);
      // write GPIO port
      setPowerSupply(req.body.state?"1":"0");
      powerSupplyEnabled = req.body.state;
      res.json( getDefaultServerInfoResponse(false) );
    });

// POST	/api/showtimes	Set show timer
router.route('/showtimes')
    .post(function(req, res) {
      if (req.body.showtimes) { // transfer supplied values only
	datastore.config.showtimes.enabled = req.body.showtimes.enabled;
	if (req.body.showtimes.starttime) datastore.config.showtimes.starttime = req.body.showtimes.starttime;
	if (req.body.showtimes.endtime) datastore.config.showtimes.endtime = req.body.showtimes.endtime;
	if (req.body.showtimes.autoplaylistname) datastore.config.showtimes.autoplaylistname = req.body.showtimes.autoplaylistname;
	checkShowTimes();
      } else {
        res.json({ "rc": "OK", "error": "Unable to update show times" });
	return;
      }
      res.json( getDefaultServerInfoResponse(false) );
    });


// Register endpoint routes
app.use('/api', router);

app.use('/:file', function (req, res, next) {
	res.sendFile(fs.realpathSync(".")+'/www/'+req.params.file);
});

app.use('/', function (req, res, next) {
  res.sendFile(fs.realpathSync(".")+'/www/webui.html');
});

startUp();

function startUp() {
 // Start webserver
 console.log('--- flx OPC WebServices version: '+version);
 
 // load playlists and animations from file into datastore

 if (!loadDataStoreFromDisk()) return;
 scanAnimationsFolder(); // scan for new animations on disk

 opcHost = datastore.config.opcserveraddr;
 if (datastore.config.opcserverport) opcPort = datastore.config.opcserverport;

 if (datastore.config.thisserverport) port = datastore.config.thisserverport;
 opcplayer = new OPCPlayer(opcHost, opcPort);

 app.listen(port);
 console.log('--- flx OPC Webserver listening on port '+port);

 readGPIOPowerSupplyStatus(); // read status of gpio relay pin

 setInterval(function() {checkShowTimes()}, 1000*60);
}
var showtimeCurrentState = false;

function checkShowTimes() {
 if (!datastore.config.showtimes.enabled) return; 
 if (isShowTime()) {
	if (showtimeCurrentState!=true) { // state change detected
		// trigger this only once when active timerange reached
		console.log("Showtime start time reached. Starting playback.");
		// Start playing first playlist
		var rcPLName = datastore.config.showtimes.autoplaylistname || "Default Playlist";
		opcplayer.playPlaylist(searchPlaylist(rcPLName)); // or read playlist name from 
		showtimeCurrentState=true;
		// GPIO toggle!		
		setPowerSupply(true);
	}
    } else {  // timers active, but outside timerange
	if (showtimeCurrentState==true) { // state change detected
	      showtimeCurrentState=false;
	      if (opcplayer.status=="Playing") {
		console.log("Showtime end time reached. Stopping playback.");
		opcplayer.stopPlayback(true);
	      }
	      	// GPIO toggle!		
		setPowerSupply(false);
	}
    }
}

function isShowTime() {
 var now = new Date();
 var dtstart = new Date();
 var dtend = new Date();
 dtstart.setHours(datastore.config.showtimes.starttime[0]);
 dtstart.setMinutes(datastore.config.showtimes.starttime[1]);
 dtend.setHours(datastore.config.showtimes.endtime[0]);
 dtend.setMinutes(datastore.config.showtimes.endtime[1]);
 return (now>=dtstart && now<=dtend);
}

function readGPIOPowerSupplyStatus() {
 // read GPIO port
 exec(datastore.config.gpioexec+' -g read 18', function (error, stdout, stderr) {
	powerSupplyEnabled = (stdout==1); 	  // cmd output is in stdout
 });
}
function setPowerSupply(onoff) {
 onoff=(onoff=="1"||onoff==true?"1":"0");
 console.log("Changing Power Supply state to: " + onoff);
 exec(datastore.config.gpioexec+' -g write 18 '+onoff, function (error, stdout, stderr) {
	  // output is in stdout
 });
}
function searchAnimation(aName) {
 // search file in available animations and return a COPY of the file object
 var rc=null;
 var idx=null;
 for (var i=0;i<datastore.animations.length;i++) if (datastore.animations[i].file==aName) idx = i;
 if (idx!=null) {
	var a = datastore.animations[idx];
	if (a) rc = { "file": a.file, "framerate": a.framerate, "repeat": a.repeat, "description": a.description }
 }
 if (rc==null) console.log("File not found in animations list: " + aName);
 return rc;
}
function searchPlaylist(plName) {
 var rc=null;
 for (var i=0;i<datastore.playlists.length;i++) if (datastore.playlists[i].name==plName) rc=datastore.playlists[i];
 if (rc==null) console.log("Playlist not found: " + plName);
 return rc;
}
function saveDataStore() {
 // save datastore to disc
 console.log("--- Saving: " + datastoreFilename);
 fs.writeFile(datastoreFilename, JSON.stringify(datastore, null, 4)); // async!
}
function loadDataStoreFromDisk() {
 datastore = JSON.parse(fs.readFileSync(datastoreFilename, 'utf8'));
  if (!datastore) {
	console.log("Failed to load datastore from: " + datastoreFilename);
	return false;
  }
 // read config from datastore 
 if (!datastore.config) {
	console.log("Failed to load config section from: " + datastoreFilename);
	return false;
 }
 for (var i=0;i<datastore.playlists.length;i++) datastore.playlists[i].expanded=false; // collapse everything
 return true;
}

function scanAnimationsFolder() {
  console.log("Scanning local /animations folder..");
  var aFiles = fs.readdirSync("animations/");

  for (var i=0;i<aFiles.length;i++) {
    var idx=-1;
    for (var p=0;p<datastore.animations.length;p++) if (datastore.animations[p].file==aFiles[i]) idx=i;
    if (idx<0) { // not found. add
	console.log("Adding new animation to database: " + aFiles[i] );
	datastore.animations.push({"file": aFiles[i], "title": "-New imported file-", "repeat": 1});
    }
  }

}
function updatePlaylist(plid, objPL) {
 var idx=null;
 if (plid=="") { // add new playlist -> check for name conflict
	for (var i=0;i<datastore.playlists.length;i++) if (datastore.playlists[i].name==objPL.name) idx=i;
	if (idx) {
		console.log("Can't add new Playlist. Name already exists: " + objPL.name);
		return false;
	}
  	console.log("* Create NEW Playlist: " + objPL.name);
	datastore.playlists.push(objPL);
	return true;
 } else { // update existing playlist
	 for (var i=0;i<datastore.playlists.length;i++) if (datastore.playlists[i].name==plid) idx=i;
	 if (idx==null) {
	  console.log("Playlist not found");
	  return false;
	 } else {
	  datastore.playlists[idx] = objPL;
   	  return true;
	 }
 }
}
function removePlaylist(plName) {
 var idx=null;
 for (var i=0;i<datastore.playlists.length;i++) if (datastore.playlists[i].name==plName) idx=i;
 if (idx==null) {
	console.log("Playlist not found: " + plName);
	return false;
 }
 datastore.playlists.splice(idx,1); // remove that playlist
 return true;
}
function getDefaultServerInfoResponse(includeDataStore) {
 var jserver = {"version": version, 
		"status": opcplayer.status, 
		"nowplaying": opcplayer.getNowPlaying(), 
		"servertime": new Date(), 
		"powersupplyenabled": powerSupplyEnabled,
		"showtimes" : datastore.config.showtimes
 };

 if (includeDataStore) {
  return { "rc": "OK", "server": jserver, "datastore": datastore }
 } else {
  return { "rc": "OK", "server": jserver }
 }
  
}
