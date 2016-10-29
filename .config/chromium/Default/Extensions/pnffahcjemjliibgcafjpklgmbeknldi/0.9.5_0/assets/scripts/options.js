
/* FUNCTIONS
================================================== */

function restoreOptions(){
	if (localStorage["delay"])
		$('input[value='+localStorage["delay"]+']').prop('checked', true);
	else
		$('input[value=500]').prop('checked', true);
}

function saveOptions(){
	localStorage["delay"] = $('input[name=delay]:checked', '#options').val();
}




$(document).ready(function(){

	/* ON START
	================================================== */

	restoreOptions();

	$("#SAVE").click(function(){
		saveOptions();
		showSexySaveMessage();
	});

	//Displays a saving message with darken bg and stuff
	function showSexySaveMessage(){
	  $("#darkenBackground").fadeIn();
	  $("#sexySaveMessage").fadeIn();
	  setTimeout(function(){
	    $("#darkenBackground").fadeOut();
	    $("#sexySaveMessage").fadeOut();
	  },1500);
	}
});