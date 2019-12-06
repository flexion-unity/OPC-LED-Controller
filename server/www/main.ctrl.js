angular.module('app', []);
var $thescope;
angular.module('app').controller("MainController", function($scope, $http, $interval ){
   var vm = this;
   vm.title = 'OPC LED Controller';
   vm.srv=[];
   vm.connected = false;
   vm.editTimer=false;

// --- Generic API POST/GET --------------------
   vm.API_POST = function(apiurl, postData, fnSuccess) {
	$http.post(apiurl, postData).success(fnSuccess);
   }
   vm.API_GET = function(apiurl, fnSuccess) {
	$http.get(apiurl).success(fnSuccess).error(function(){
		console.log("Disconnected from server");
		vm.connected = false;
	});
   }
   vm.rcParseServerResponse = function(data, status, headers, config) {
	vm.connected = true;
	// default callback for API GET/POSTs, to update info received from server
	if (data.rc && data.rc=="OK") {
	  if (data.error) alert(data.error);
	  if (data.datastore)  vm.datastore = data.datastore; // update datastore with remote version
	  if (data.server) vm.srv = data.server; // update server info
	} else {
	  console.log("Error in HTTP API Call, response is invalid or empty");
	}
   }
// --- Server info and maintenance ------------
   vm.getServerInfo = function() { 	vm.API_GET("/api", vm.rcParseServerResponse ) } // incl. datastore
   vm.getServerStatus = function() { 	vm.API_GET("/api/status", vm.rcParseServerResponse ) } // without datastore
   vm.saveServerConfig = function() {	vm.API_POST("/api/savedatastore", { "save": true }, vm.rcParseServerResponse ) }
   vm.reloadServerConfig = function() {
	// this will discard the current in-memory datastore and re-read the datastore from the disc
	// it's like an "undo" function
	vm.API_POST("/api/reloaddatastore",{}, vm.rcParseServerResponse );
   } 
   vm.rescanAnimationsFolder = function(plName) { vm.API_POST("/api/animations/rescan", {}, vm.rcParseServerResponse ) }
   vm.disconnectServer = function() { vm.connected = false; } // stop polling server constantly
   vm.setPowerSupply = function(onoff) { vm.API_POST("/api/powersupply", {"state": onoff }, vm.rcParseServerResponse); }

   vm.shutdown = function() { 
	   if (!confirm("Do you really want to shutdown the controller?")) return false;
	   vm.API_POST("/api/shutdown", {}, vm.rcParseServerResponse ) 
   }
   
// --- Playback actions
   vm.playAnimation = function(aName) { vm.API_POST("/api/anim/play", { "file": aName }, vm.rcParseServerResponse )}
   vm.stopPlayback = function(clearScreen) {
	//vm.API_POST("/api/anim/stop", {"clearscreen": clearScreen }, function(data, status, headers, config) {});
	vm.API_POST("/api/anim/stop", {"clearscreen": clearScreen }, vm.rcParseServerResponse );
   }

// --- Playlist actions ----------------------
   vm.playPlaylist = function(plName) { vm.API_POST("/api/playlists/play", { "playlistname": plName}, vm.rcParseServerResponse )}
   vm.createNewPlaylist = function(plName) {
	if (!plName || plName=="") return;
	// to create a new playlist on the server, leave plid blank
	vm.API_POST("/api/playlists/set", { "plid": "", "oPlaylist": { "name": plName, "items": []} }, vm.rcParseServerResponse );
	vm.ui_showPlaylistEdit=false; // hide UI
	vm.getServerInfo(); // refresh datastore again
   }
   vm.deletePlaylist = function(plName) {
	if (!confirm('Do you really want to delete this playlist?')) return;
	vm.API_POST("/api/playlists/delete", { "name": plName }, vm.rcParseServerResponse );
   }

// --- Showtime ------------------------------
   vm.enableShowTimes = function(onoff) {
	var rcShowTimes = { "enabled": onoff }
	vm.API_POST("/api/showtimes", { "showtimes": rcShowTimes}, vm.rcParseServerResponse );
   }
   vm.toggleEditShowTimes = function() {
	vm.editTimer = !vm.editTimer;
	if (vm.editTimer) {
		var ST = vm.srv.showtimes;
		if (ST.starttime) {
			vm.newStartTimeHours = ST.starttime[0];	
			vm.newStartTimeMinutes = ST.starttime[1];
		}
		if (ST.endtime) {
			vm.newEndTimeHours = ST.endtime[0];	
			vm.newEndTimeMinutes = ST.endtime[1];
		}
		if (ST.starttime2) {
			vm.newStartTimeHours2 = ST.starttime2[0];	
			vm.newStartTimeMinutes2 = ST.starttime2[1];
		}
		if (ST.endtime2) {
			vm.newEndTimeHours2 = ST.endtime2[0];	
			vm.newEndTimeMinutes2 = ST.endtime2[1];
		}
	}
   };
   vm.updateShowTime = function() {
	var newST = vm.srv.showtimes;
	var validation=true;
	if (vm.newStartTimeHours==null) validation=false;
	if (vm.newStartTimeMinutes==null) validation=false;
	if (vm.newEndTimeHours==null) validation=false;	
	if (vm.newEndTimeMinutes==null) validation=false;
	
	if (validation==false) {
		alert("Please fill in all fields of timer 1");
		return;
	}

	if (vm.newStartTimeHours2!==null) {
		if (vm.newStartTimeMinutes2==null) validation=false;
		if (vm.newEndTimeHours2==null) validation=false;
		if (vm.newEndTimeMinutes2==null) validation=false;
	}
	
	if (validation==false) {
		alert("Please fill in all fields of timer 2");
		return;
	}
	newST.starttime = [parseInt(vm.newStartTimeHours), parseInt(vm.newStartTimeMinutes)];
	newST.endtime = [parseInt(vm.newEndTimeHours), parseInt(vm.newEndTimeMinutes)];
	if (vm.newStartTimeHours2!==null) {
		newST.starttime2 = [parseInt(vm.newStartTimeHours2), parseInt(vm.newStartTimeMinutes2)];
		newST.endtime2 = [parseInt(vm.newEndTimeHours2), parseInt(vm.newEndTimeMinutes2)];
	}
	vm.API_POST("/api/showtimes", { "showtimes": newST}, vm.rcParseServerResponse );
	// leave edit mode
	vm.editTimer = false;
   }

// --- UI actions ---------------------------------
   vm.ui_editPlaylist = function(oPL) {
	vm.ui_showEditPlaylistAnimations=true;
	vm._currentEditPlaylist = oPL;
	vm._plfilecache=";"
	for (var i=0;i<oPL.items.length;i++) vm._plfilecache+=oPL.items[i].file+";";
   }
   
   vm.ui_addRemoveAnimFromPlaylistEditor = function(oAnim) {
	var filename = oAnim.file;
	var idx=-1;
 	for (var i=0;i<vm._currentEditPlaylist.items.length;i++) if (vm._currentEditPlaylist.items[i].file===filename) idx=i;
	if (idx<0) { // add
	 console.log("Add " + filename + " to temp playlist");
	 vm._currentEditPlaylist.items.push(oAnim);
	} else { // remove
	 console.log("Remove " + filename + " from temp playlist");
	 vm._currentEditPlaylist.items.splice(idx,1);
	}
  	// immediately update playlist on server
	vm.API_POST("/api/playlists/set", { "plid": vm._currentEditPlaylist.name, "oPlaylist": vm._currentEditPlaylist },
	vm.rcParseServerResponse );
	vm.ui_editPlaylist(vm._currentEditPlaylist); // this will re-render the ng-repeat with updated values
   }

   vm.isPlaylistMember = function(aName) { return vm._plfilecache.indexOf(aName)>0 }

   // move playlist items up and down
   var movePLAnim = function (oPL, origin, destination) {
        var temp = oPL.items[destination];
        oPL.items[destination] = oPL.items[origin];
        oPL.items[origin] = temp;
	// update changes on server
	vm.API_POST("/api/playlists/set", { "plid": oPL.name, "oPlaylist": oPL }, vm.rcParseServerResponse );
    };
 
    vm.moveUp = function(oPL,index){ movePLAnim(oPL, index, index - 1); };
    vm.moveDown = function(oPL, index){ movePLAnim(oPL, index, index + 1); };

// --- Init.. -----------------------------
   vm.getServerInfo();
   $interval(function() { if (vm.connected) vm.getServerStatus() },5000); // query server status each X seconds
   
});


$(document).ready(function(){
	$("#toggler").click(function(){ $(this).toggleClass('active, inactive') });
});

