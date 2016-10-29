
/* VARIABLES
================================================== */

var mode; //1:Flash, 2:Diamond, 3:Flow
var modeNb;
var fontNb;
var speed;
var delay; //Delay before the reading starts
var position; //Position of the window
var int; //Interval
var currentVersion = "0.9.5"; //Current version on the patchNote
var patchNote = [
	'<h1>What\'s new in 0.9.5</h1>',
	'<ul>',
	'<li>Minor changes</li>',
	'</ul>'
].join("\n");



/* FUNCTIONS
================================================== */

//Set the mode
function setMode(modeNb){
	switch (modeNb){
		case 1:
			mode = jQuery.extend(true, {}, mode1);
			localStorage["modeNb"] = 1;
			$("#boxMode .right").text("Flash Mode");
			$("#boxMode .logo").addClass("m1");
			$("#boxMode .logo").removeClass("m2");
			$("#boxMode .logo").removeClass("m3");
			$("#boxMode .logo").removeClass("m4");
			$("#boxMode .logo").removeClass("m5");
			break;
		case 2:
			mode = jQuery.extend(true, {}, mode2);
			localStorage["modeNb"] = 2;
			$("#boxMode .right").text("Diamond Mode");
			$("#boxMode .logo").removeClass("m1");
			$("#boxMode .logo").addClass("m2");
			$("#boxMode .logo").removeClass("m3");
			$("#boxMode .logo").removeClass("m4");
			$("#boxMode .logo").removeClass("m5");
			break;
		case 3:
			mode = jQuery.extend(true, {}, mode3);
			localStorage["modeNb"] = 3;
			mode.nbOfWordAtATime = 2,
			$("#boxMode .right").text("Flow Mode");
			$("#boxMode .logo").removeClass("m1");
			$("#boxMode .logo").removeClass("m2");
			$("#boxMode .logo").addClass("m3");
			$("#boxMode .logo").removeClass("m4");
			$("#boxMode .logo").removeClass("m5");
			break;
		case 4:
			mode = jQuery.extend(true, {}, mode3);
			localStorage["modeNb"] = 4;
			mode.nbOfWordAtATime = 3,
			$("#boxMode .right").text("Flow Mode");
			$("#boxMode .logo").removeClass("m1");
			$("#boxMode .logo").removeClass("m2");
			$("#boxMode .logo").removeClass("m3");
			$("#boxMode .logo").addClass("m4");
			$("#boxMode .logo").removeClass("m5");
			break;
		case 5:
			mode = jQuery.extend(true, {}, mode3);
			localStorage["modeNb"] = 5;
			mode.nbOfWordAtATime = 4,
			$("#boxMode .right").text("Flow Mode");
			$("#boxMode .logo").removeClass("m1");
			$("#boxMode .logo").removeClass("m2");
			$("#boxMode .logo").removeClass("m3");
			$("#boxMode .logo").removeClass("m4");
			$("#boxMode .logo").addClass("m5");
			break;
	}
}

//Set the font
function setFont(fontNb){
	switch (fontNb){
		case 1:
			fontNb = 1;
			localStorage["fontNb"] = 1;
			$("body").addClass("font1");
			$("body").removeClass("font2");
			$("body").removeClass("font3");
			$("#boxFont .right").text("Sans Serif");
			$("#boxFont .right").css("padding-top", "12px");
			$("#boxFont .right").css("height", "42px");
			break;
		case 2:
			fontNb = 2;
			localStorage["fontNb"] = 2;
			$("body").removeClass("font1");
			$("body").addClass("font2");
			$("body").removeClass("font3");
			$("#boxFont .right").text("Serif");
			$("#boxFont .right").css("padding-top", "19px");
			$("#boxFont .right").css("height", "35px");
			break;
		case 3:
			fontNb = 3;
			localStorage["fontNb"] = 3;
			$("body").removeClass("font1");
			$("body").removeClass("font2");
			$("body").addClass("font3");
			$("#boxFont .right").text("Mono space");
			$("#boxFont .right").css("padding-top", "12px");
			$("#boxFont .right").css("height", "42px");
			break;
	}
}

//Set the speed
function setSpeed(){
	$("#speed").text(speed + " wpm");
	$("#boxSpeed .right").text(speed);
	$("#slider").slider({
		value: speed,
		min: 25,
    max: 1000,
    step: 25,
    slide: function( event, ui ) {
      $("#speed").text(ui.value + " wpm");
    }
	});
}

//Update the speed
function updateSpeed(){
	speed = $("#slider").slider( "option", "value" );
	localStorage["speed"] = speed;
	setSpeed();
}

/* Set the ProgressBar */
function setProgressBar(){
	$("#progressbar").progressbar({
		value: getProgress()
	});
}



/* Change the icon of the Play/Pause button */
function putPause(){
	$("#playAndPause").removeClass("pause");
  $("#playAndPause").addClass("play");
}
function putPlay(){
	$("#playAndPause").removeClass("play");
  $("#playAndPause").addClass("pause");
}



//Play if paused, Pause, if playing
function playAndPause(){
	mode.toggle();
	closeAllPopups();
  showModeArea();
}



/* Show/Hide the Mode area (In the "content" div, where the text is written) */
function showModeArea(){
	$(mode.modeArea).show();
}
function hideModeArea(){
	$(mode.modeArea).hide();
}




/* Show/Hide the Params Area (In the "content" div, where you can set the params) */
function showParamsArea(paramName){
	closeAllPopupsAndReset();
	$(paramName).show();
}
function hideParamsArea(paramName){
	$(paramName).hide();
}

// Add/Remove a "pressed" effect
function pressed1(that){
	that.addClass("pressedOnDarkBG");
}
function unpressed1(that){
	that.removeClass("pressedOnDarkBG");
}
function pressed2(that){
	that.addClass("pressedOnLightBG");
}
function unpressed2(that){
	that.removeClass("pressedOnLightBG");
}

function restoreParams(){
	//modeNb
	if (localStorage["modeNb"])
		modeNb = parseInt(localStorage["modeNb"]);
	else
		modeNb = 1;
	//fontNb
	if (localStorage["fontNb"])
		fontNb = parseInt(localStorage["fontNb"]);
	else
		fontNb = 1;
	//speed
	if (localStorage["speed"])
		speed = localStorage["speed"];
	else
		speed = 300;
	//delay
	if (localStorage["delay"])
		delay = localStorage["delay"];
	else{
		delay = 500;
		localStorage["delay"] = 500;
	}
}

function hideSpinningWheel(){
	$("#spinningWheel").hide();
}

function createLinkToOptionsPage(){
	$("#optionsLink").attr('href', chrome.extension.getURL("options.html"));
}


function showPatchNote(){
	hideSpinningWheel();
	activeKeys();
	if(localStorage.currentVersion == currentVersion){
		mode.start();
	}
	else{
		$("#patchNote").append(patchNote);
		$("#patchNote").show();
		localStorage.currentVersion = currentVersion;
	}
}
function closePatchNote(){
	$("#patchNote").hide();
}


function closeAllPopups(){
	closePatchNote();
	hideParamsArea("#paramsArea1");
	hideParamsArea("#paramsArea2");
	hideParamsArea("#paramsArea3");
	showModeArea();
}
function closeAllPopupsAndReset(){
	mode.reset();
	closeAllPopups();
}


function activeKeys(){
	$('body').keydown(function(e){
		if(e.keyCode == 32){ //Space key
			playAndPause();
		}
		if(e.keyCode == 8){ //Backspace key
			closeAllPopupsAndReset();
		}
	});
}


$(document).ready(function(){


	/* ON START
	================================================== */

	restoreParams();
	setMode(modeNb);
	setFont(fontNb);
	setSpeed();
	setProgressBar();
	showModeArea();
	createLinkToOptionsPage();

	// Communication with the page
	chrome.tabs.query({active:true, windowId: chrome.windows.WINDOW_ID_CURRENT},
	  function(tab) {
	    chrome.tabs.sendMessage(tab[0].id, {method: "getTextToRead"},
	    function(response){
	    	if(!response){
	    		response = {
	    			title: "If it's the first time you use Read fast, please reload the page",
	    			data: ""
	    		}
	    	}
	      $("#title").append(response.title);
	      textToRead.init(cleanTxt(response.data));
	      setTimeout(function(){
	      	showPatchNote();
	      },delay); //TODO: Spinning wheel
	    });
	  });


	/* UI BEHAVIOR
	================================================== */

	/*
	#params
		Orange Mode Button
		Dark Blue Font Button
		Light Blue Speed Button
		Light Blue Play/Pause Button
		Light Blue SkipToStart Button
	*/

	//Orange Mode Button
	$("#boxMode").mousedown(function(){
		pressed1($(this));
	});
	$("#boxMode").mouseup(function(){
		unpressed1($(this));
	});
	$("#boxMode").click(function(){
		if($("#paramsArea1").is(":visible")){
			closeAllPopupsAndReset();
		}
		else{
			showParamsArea("#paramsArea1");
			hideModeArea();
		}
	});

	//Dark Blue Font Button
	$("#boxFont").mousedown(function(){
		pressed1($(this));
	});
	$("#boxFont").mouseup(function(){
		unpressed1($(this));
	});
	$("#boxFont").click(function(){
		if($("#paramsArea2").is(":visible")){
			closeAllPopupsAndReset();
		}
		else{
			showParamsArea("#paramsArea2");
			hideModeArea();
		}
	});

	//Light Blue Speed Button
	$("#boxSpeed").mousedown(function(){
		pressed1($(this));
	});
	$("#boxSpeed").mouseup(function(){
		unpressed1($(this));
	});
	$("#boxSpeed").click(function(){
		if($("#paramsArea3").is(":visible")){
			closeAllPopupsAndReset();
			/*setSpeed();*/ //Why?
		}
		else{
			showParamsArea("#paramsArea3");
			hideModeArea();
		}
	});

	//Light Blue Play/Pause Button
	$("#playAndPause").mousedown(function(){
		pressed1($(this));
	});
	$("#playAndPause").mouseup(function(){
		unpressed1($(this));
	});
	$("#playAndPause").click(function() {
		playAndPause();
	});

	//Light Blue SkipToStart Button
	$("#skipToStart").mousedown(function(){
		pressed1($(this));
	});
	$("#skipToStart").mouseup(function(){
		unpressed1($(this));
	});
	$("#skipToStart").click(function(){
		closeAllPopupsAndReset();
	});



	/*
	#content
		Mode button: Flash
		Mode button: Diamond
		Mode button: Flow 2
		Mode button: Flow 3
		Mode button: Flow 4

		Font button: Sans Serif
		Font button: Serif
		Font button: Monospace

		Speed button: OK

		PatchNote button: Close
	*/

	//Mode button: Flash
	$("#m1").mousedown(function(){
		pressed2($(this));
	});
	$("#m1").mouseup(function(){
		unpressed2($(this));
	});
	$("#m1").click(function(){
		setMode(1);
		closeAllPopupsAndReset();
	});

	//Mode button: Diamond
	$("#m2").mousedown(function(){
		pressed2($(this));
	});
	$("#m2").mouseup(function(){
		unpressed2($(this));
	});
	$("#m2").click(function(){
		setMode(2);
		closeAllPopupsAndReset();
	});

	//Mode button: Flow 2
	$("#m3").mousedown(function(){
		pressed2($(this));
	});
	$("#m3").mouseup(function(){
		unpressed2($(this));
	});
	$("#m3").click(function(){
		setMode(3);
		closeAllPopupsAndReset();
	});

	//Mode button: Flow 3
	$("#m4").mousedown(function(){
		pressed2($(this));
	});
	$("#m4").mouseup(function(){
		unpressed2($(this));
	});
	$("#m4").click(function(){
		setMode(4);
		closeAllPopupsAndReset();
	});

	//Mode button: Flow 4
	$("#m5").mousedown(function(){
		pressed2($(this));
	});
	$("#m5").mouseup(function(){
		unpressed2($(this));
	});
	$("#m5").click(function(){
		setMode(5);
		closeAllPopupsAndReset();
	});


	//Font button: Sans Serif
	$("#f1").mousedown(function(){
		pressed2($(this));
	});
	$("#f1").mouseup(function(){
		unpressed2($(this));
	});
	$("#f1").click(function(){
		setFont(1);
		closeAllPopupsAndReset();
	});

	//Font button: Serif
	$("#f2").mousedown(function(){
		pressed2($(this));
	});
	$("#f2").mouseup(function(){
		unpressed2($(this));
	});
	$("#f2").click(function(){
		setFont(2);
		closeAllPopupsAndReset();
	});

	//Font button: Monospace
	$("#f3").mousedown(function(){
		pressed2($(this));
	});
	$("#f3").mouseup(function(){
		unpressed2($(this));
	});
	$("#f3").click(function(){
		setFont(3);
		closeAllPopupsAndReset();
	});


	//Speed button: OK
	$("#paramsArea3 .ok").mousedown(function(){
		pressed2($(this));
	});
	$("#paramsArea3 .ok").mouseup(function(){
		unpressed2($(this));
	});
	$("#paramsArea3 .ok").click(function(){
		updateSpeed();
		closeAllPopupsAndReset();
	});


	$("#patchNote .close").click(function(){
		closeAllPopupsAndReset();
	})


});

