angular.module('app', []);
var $thescope;
angular.module('app').controller("MainController", function($scope, $http, $interval ){
   var vm = this;
   vm.title = 'OPC LED Controller';
   vm.srv=[];
   vm.connected = false;

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
   vm.updateShowTime = function() {
	var newST = vm.srv.showtimes;
	if (vm.newStartTimeHours!=null) {
		if (vm.newStartTimeHours>=0 && vm.newStartTimeMinutes>=0) {
			newST.starttime = [parseInt(vm.newStartTimeHours), parseInt(vm.newStartTimeMinutes)];
		}
	}
	if (vm.newEndTimeHours!=null) if (vm.newEndTimeHours>=0 && vm.newEndTimeMinutes>=0) newST.endtime = [parseInt(vm.newEndTimeHours), parseInt(vm.newEndTimeMinutes)];
	// reset UI 
	vm.newEndTimeHours = null;
	vm.newEndTimeMinutes = null;
	vm.newStartTimeHours = null;
	vm.newStartTimeMinutes = null;
	vm.editStartTime = false;
	vm.editEndTime = false;

	vm.API_POST("/api/showtimes", { "showtimes": newST}, vm.rcParseServerResponse );
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

