/* 
 * Open Pixel Control playback extension for nodejs (server-side)
 * Playback OPC pixel animations from local files
 * 
 * flexion 2015
 *
 * Version 08.11.2015 08:27
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
 */
var fs = require('fs');
var net = require('net');

var OPCPlayer = function(host, port) {
 this.host = host;
 this.port = port;

 this.pixelBuffer = null;
 this.socket = null;
 this.connected; 

 this.status = "Idle";
 this.powerSupplyState;
 this.nowplaying="";

 this.repeat = 0;
 this.frameLength;
 this.frameRate;
 this.buf;
 this.fPos = 26; // first frame starts at 26
 this.s=[];
 this.playlist;
 this.playlistIndex;
 this.shuffledplaylistIndex = [];

 console.log("* flx OPCPlayerLib initialized for fadecandy server on: " + host);

 this.setPowerSupply = function(onoff) {
  console.log("* OPCPlayer power supply state change: " + (onoff?"ON":"OFF") );
  powerSupplyState = onoff;
  return powerSupplyState;
 }
 this.getNowPlaying = function() {
  return this.nowplaying;
 }
 
 this.playFile = function(objAnim) {
  console.log(">* OPCPlayer playing animation: " + objAnim.file);
  repeat = objAnim.repeat || 1;
  var forceFrameRate = objAnim.framerate || 0;
  this.nowplaying = "Animation: " +objAnim.file;
  this._loadAnimation(objAnim.file, forceFrameRate);
 }

 this.playPlaylist = function(objPlaylist) {
  console.log(">* OPCPlayer playing playlist: " + objPlaylist.name);

  if (!objPlaylist.items || objPlaylist.items.length<1) {
	console.log("No items found in specified playlist");
  	return;
  }

  this.playlist = objPlaylist;
  this.playlistIndex=0;

  // Random playback order
  if (objPlaylist.shuffle) {
   this.shuffledplaylistIndex=[];
   console.log("Shuffling playlist order (" + objPlaylist.items.length +")");
   for (var i=0;i<objPlaylist.items.length;i++) this.shuffledplaylistIndex.push(i);
   this.shuffledplaylistIndex = this.shuffle(this.shuffledplaylistIndex);
  }

  this.loadNextPlaylistFile();
 }


 this.stopPlayback = function(clearScreen) {
  console.log("* OPCPlayer stopping playback");
  if (this.status!="Idle") {
   // stop playback here..  
   if (connected) this._disconnect();
  }
  // optional: clear screen
  if (clearScreen) this.clearScreen();
  
  this.playlist = null; // reset playlist
  this.status = "Idle";
  this.nowplaying = "";
 }

 this.shuffle = function(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
 }

  // ------- Internal functions --------------------
  this._connect = function() {

   if (this.connected) {
	// console.log("#already connected!");
	this._playFrame();
	return;
   }
   console.log("* Connecting to fcserver: " + host);
    socket = new net.Socket()
    connected = false;
    var that = this;
    socket.onclose = function() {
        console.log("* Connection to fcserver closed");
        socket = null;
        that.connected = false;
    	that.status = "Idle";
    	that.nowplaying = "";
    }
    socket.onerror = function(evt) {
        console.log("* Connection to fcserver failed: " + evt.data);
        socket = null;
        that.connected = false;
    	that.status = "Idle";
    	that.nowplaying = "";
    }
    socket.connect(port, host, function() {
        console.log("* Connected to " + socket.remoteAddress);
        that.connected = true;
        socket.setNoDelay();
	that._playFrame();
     }
    );
  }

  this._disconnect = function() {
   if (socket) {
    this.socket = null;
    this.connected = false;
    this.status = "Idle";
    this.nowplaying = "";
    console.log("* Disconnected from fcserver");
   }
  }
  this._writePixels = function() {
    if (!this.connected) {
        console.log("* NOT CONNECTED!");
	return;
    }
    socket.write(this.pixelBuffer);
  }

  this._playFrame = function() {
    if (this.status!="Playing") return; // stop playback
    var that = this;
    this.pixelBuffer = this.buf.slice(this.fPos, this.fPos+this.frameLength);
    this._writePixels();
    this.fPos += this.frameLength;
    if (this.fPos <= this.buf.length - this.frameLength) {
     if (this.connected) { 
	setTimeout(function() {that._playFrame()} , 1000/this.frameRate);
     }
    } else {
     if (this.repeat>1) {
	this.repeat-=1;
	this.fPos = 26; // rewind current file
	if (this.connected) setTimeout(function() { that._playFrame() }, 1000/this.frameRate);
     } else {
	if (this.playlist) {
	   this.status=""; // reset from playing
	   this.loadNextPlaylistFile();
	} else {
	   this.clearScreen();
	   this._disconnect();
	}
     }
    }

  }
  this.clearScreen = function() {
	if (!this.pixelBuffer) return; // we cannot clear screen when no animation was played
	if (this.pixelBuffer.length>1) {
		for (var i=3; i<this.frameLength;i++) 	this.pixelBuffer[i] = 0;
	     	this._writePixels();
	}
  }
  this.loadNextPlaylistFile = function() {
 	var currentIndex = this.playlist.shuffle?this.shuffledplaylistIndex[this.playlistIndex]:this.playlistIndex;
	var anim = this.playlist.items[currentIndex];
	this.repeat = 0;
	if (anim.repeat && anim.repeat>0) this.repeat = anim.repeat;
	console.log("-- Playing file [" + currentIndex + "] "+anim.file+" from playlist: " + this.playlist.name );
	this.nowplaying = "Playlist: " + this.playlist.name + " / " + anim.file;
	this._loadAnimation( anim.file, anim.framerate );
    	this.playlistIndex+=1;
  	if (this.playlistIndex >= this.playlist.items.length) this.playlistIndex=0;
   }

  this._loadAnimation = function(filename, forceFrameRate) {
   if (this.status=="Playing") {
	console.log("* Unable to play file because already playing");
	return;
   }
   
   this.fPos=26; // frames start here
   console.log("* Reading file: " + filename);
   this.buf = fs.readFileSync("animations/"+filename);

   // 1) Read header
   var hdr="";
   for (var p=0;p<18;p++) hdr+=String.fromCharCode(this.buf[p]);

   if (hdr.indexOf("flx.opc.movie") == 0) {
     //    console.log("* Valid format detected: "+ hdr);
   } else {
         console.log("* Invalid file format: '" + hdr +"'");
         return;
   }
   // 2) read the int value for frame rate
   this.frameRate = ((this.buf[18]) | 
              (this.buf[19] << 8) | 
              (this.buf[20] << 16) | 
              (this.buf[21] << 24));
   //console.log("* frame rate: " + this.frameRate);
   // 3) read the int value for frame length
   this.frameLength = ((this.buf[22]) | 
              (this.buf[23] << 8) | 
              (this.buf[24] << 16) | 
              (this.buf[25] << 24));
  // console.log("frame length: " + this.frameLength);
 
   if (forceFrameRate>1) this.frameRate = forceFrameRate;
   this.status="Playing";
   this._connect();
  }
};

module.exports = OPCPlayer;
