var storage;
var loadingTimer = null;
var openingSite = false;

var eventTitle = null;
var description = null;
var descriptionFromPage;

var initialCalendarHeight;

// bgobjects
var events;
var email;
var cachedFeeds;
var colors;
var arrayOfCalendars;
var writeableCalendars = [];
var notificationsQueue;
var notificationsOpened;
var loggedOut;

var betaCalendarFirstLoad = true;
var inWidget;
var fromToolbar;
var isDetached;
var bgObjectsReady;

var customIconsDocument = $("#custom-icons")[0].import;

if (DetectClient.isChrome()) { // only because in Firefox this local onMessage would be called when local sendMessage was sent (instead I want the background.js > onMessage to get the local sendMessage
	chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
		console.log("message rec", message);
		if (message.command == "grantPermissionToCalendarsAndPolledServer") {
			location.reload();
		}
	});
}

if (location.href.indexOf("source=widget") != -1) {
	inWidget = true;
} else if (location.href.indexOf("source=toolbar") != -1) {
	fromToolbar = true;
} else {
	isDetached = true;
}

function closeWindow() {
	if (fromToolbar) {
		window.close();
	}
}

function showSaving() {
	$("#progress").css("opacity", 1);
}

function hideSaving() {
	$("#progress").css("opacity", 0);
}

function showLoadingError(error) {
	polymerPromise2.then(() => {
		if (error.stack) {
			showError(error.stack);
		} else {
			showError(error);
		}
	});
}

function showCalendarError(error) {
	// todo need to show a link to re-grant
	console.log("error", error);
	if (error.toString().indexOf("401") != -1 || error.code == 401) { // invalid grant
		bg.loggedOut = true;
		showError(getMessage("accessNotGrantedSeeAccountOptions", ["", getMessage("accessNotGrantedSeeAccountOptions_accounts")]), {
			text: getMessage("accounts"),
			onClick: function() {
				openUrl("options.html?accessNotGranted=true#accounts");
			}
		});
	} else if (error.code == 0) {
		showError("Might be offline.");
	} else {
		showError(error);
	}
}

function getBGObjects() {
	return new Promise(function(resolve, reject) {
		console.time("getBGObjects");
		
		// bg is always declared in checkerPlusForCalendar.js so we must check the location for background to verify it's really pointing to the bg file
		if (window.bg && window.bg.location.href.indexOf("background") != -1) {
			events = bg.events;
			email = bg.email;
			storage = bg.storage;
			cachedFeeds = bg.cachedFeeds;
			colors = cachedFeeds["colors"];
			arrayOfCalendars = bg.getArrayOfCalendars();
			notificationsQueue = bg.notificationsQueue;
			notificationsOpened = bg.notificationsOpened;
			loggedOut = bg.loggedOut;
			
			console.timeEnd("getBGObjects");
			
			resolve();
		} else {
			chrome.runtime.sendMessage({name:"getBGObjects"}, function(response) {
				//events = $.extend(true, [], response.events);
				events = response.events;
				response.events.forEach(function(event) {
					parseEventDates(event);
				});
				
				email = response.email;
				
				// TODO must parseDate inside cachedfeeds like we do above for events and snoozers
				cachedFeeds = response.cachedFeeds;
				colors = cachedFeeds["colors"];
				arrayOfCalendars = response.arrayOfCalendars;
				notificationsQueue = response.notificationsQueue;
				notificationsOpened = response.notificationsOpened;
				loggedOut = response.loggedOut;
				
				console.timeEnd("getBGObjects");
				
				storage = new ChromeStorage(STORAGE_DEFAULTS, STORAGE_ITEMS_TO_COMPRESS);
				storage.load().then(() => {
					resolve(response);
				}).catch(error => {
					reject(error);
				});

			});
		}
	});
}

function getCalendarView() {
	var calendarView;

	/* must match min-width 500 */
	if (document.body.clientWidth >= 500 || !inWidget) {
		calendarView = storage.get("calendarView");
	} else {
		calendarView = CalendarView.AGENDA;
	}
	
	return calendarView;
}

function shouldWatermarkImage(skin) {
	//if (skin.name && skin.name.startsWith("[img:") && skin.author != "Jason") {
	if (skin.image && skin.author != "Jason") {
		return true;
	}
}

function addSkinPiece(id, css) {
	polymerPromise.then(function() {
		$("#" + id).append(css);
	});
}

function addSkin(skin, id) {
	if (!id) {
		id = "skin_" + skin.id;
	}
	$("#" + id).remove();
	
	$("body").addClass("skin_" + skin.id);
	
	var css = "";
	
	if (skin.image) {

		// normally default is black BUT if image exists than default is white, unless overwritten with text_color
		if (skin.text_color != "dark") {
			//css += " html:not(.searchInputVisible) [main] paper-toolbar paper-icon-button, #topLeft, #skinWatermark, .showMoreEmails iron-icon {color:white} ";
		}

		var resizedImageUrl;
		if (skin.image.match(/blogspot\./) || skin.image.match(/googleusercontent\./)) {
			resizedImageUrl = skin.image.replace(/\/s\d+\//, "\/s" + $("body").width() + "\/");
		} else {
			resizedImageUrl = skin.image;
		}
		
		//css += "[main] {background-size:cover;background-image:url('" + resizedImageUrl + "');background-position-x:50%;background-position-y:50%} [main] paper-toolbar {background-color:transparent} .accountHeader {background-color:transparent}";
		// Loading the background image "after" initial load for 2 reasons: 1) make sure it loads after the mails. 2) to trigger opacity transition
		addSkinPiece(id, " [main]::before {opacity:0.5;background-size:cover;background-image:url('" + resizedImageUrl + "');background-position-x:50%;background-position-y:50%} [main] paper-toolbar, .accountHeader {background-color:transparent}");
		
		if (shouldWatermarkImage(skin)) {
			$("#skinWatermark").addClass("visible");
			$("#skinWatermark").text(skin.author);
			if (skin.author_url) {
				$("#skinWatermark").attr("href", skin.author_url); 
			} else {
				$("#skinWatermark").removeAttr("href");
			}
		}
	}
	if (skin.css) {
		css += " " + skin.css;
	}
	
	addCSS(id, css);
}

function removeSkin(skin) {
	$("#skin_" + skin.id).remove();
	$("body").removeClass("skin_" + skin.id);

	if (shouldWatermarkImage(skin)) {
		$("#skinWatermark").removeClass("visible");
	}
}

function setSkinDetails($dialog, skin) {
	
	$dialog.find("#skinCSS").off().on("click", function() {
		
		var $textarea = $("<textarea readonly style='width:400px;height:200px'></textarea>");
		$textarea.text(skin.css);
		
		openGenericDialog({
			title: "Skin details",
			content: $textarea
		});

		return false;
	});

	if (skin.css) {
		$dialog.find("#skinCSS").attr("href", "#");
	} else {
		$dialog.find("#skinCSS").removeAttr("href");
	}
	
	$dialog.find("#skinAuthor").text(skin.author);
	if (skin.author_url) {
		$dialog.find("#skinAuthor").attr("href", skin.author_url);
	} else {
		$dialog.find("#skinAuthor").removeAttr("href");
	}
}

function isGmailCheckerInstalled(callback) {
	// use cached response for true
	if (storage.get("gmailCheckerInstalled")) {
		callback(true);
	} else {
		sendMessageToGmailExtension({action:"getInfo"}).then(function(response) {
			var installed = false;
			if (response && response.installed) {
				installed = true;
				storage.enable("gmailCheckerInstalled");
			}
			callback(installed)
		}).catch(function(error) {
			callback();
		});
	}
}

function convertEventToFullCalendarEvent(jEvent, snoozeTime) {
	var fcEvent = {};
	
	fcEvent.id = getEventID(jEvent);
	
	fcEvent.title = jEvent.title;
	if (!fcEvent.title) {
		fcEvent.title = getSummary(jEvent);
	}
	
	//fcEvent.url = getEventUrl(jEvent);

	if (hasUserDeclinedEvent(jEvent)) {
		fcEvent.isDeclined = true;
	}
	
	if (snoozeTime) {		
		fcEvent.isSnoozer = true;
		fcEvent.id += "_snooze";
		
		fcEvent.start = snoozeTime;
		fcEvent.end = snoozeTime.addDays(1);
		// required for fullcalendar or else it would spread the event across many days
		fcEvent.end.resetTime();
	} else {
		fcEvent.start = new Date(jEvent.startTime);
		fcEvent.end = new Date(jEvent.endTime);
	}

	fcEvent.allDay = jEvent.allDay;
	if (jEvent.colorId && colors) {
		fcEvent.color = colors.event[jEvent.colorId].background;
		fcEvent.textColor = colors.event[jEvent.colorId].foreground;
	} else {
		if (jEvent.calendar.backgroundColor) {
			fcEvent.color = jEvent.calendar.backgroundColor;
		} else {
			fcEvent.color = colors.calendar[jEvent.calendar.colorId].background;
		}
		if (jEvent.calendar.foregroundColor) {
			fcEvent.textColor = jEvent.calendar.foregroundColor
		} else {
			fcEvent.textColor = colors.calendar[jEvent.calendar.colorId].foreground;
		}
	}
	fcEvent.jEvent = jEvent;
	return fcEvent;
}

function convertEventsToFullCalendarEvents(events) {
	//console.log("convertEventsToFullCalendarEvents")
	var fullCalendarEvents = [];
	
	for (var a=0; a<events.length; a++) {
		var snoozeTime;
		if (events[a].isSnoozer) {
			jEvent = events[a].event;			
			snoozeTime = events[a].time;

			// let's force the snoozed event to allday if not today - so that the time does not appear
			if (!snoozeTime.isToday()) {
				jEvent.allDay = true;
			}
		} else {
			jEvent = events[a];
		}
		
		var selected = isCalendarSelectedInExtension(jEvent.calendar, email, storage.get("selectedCalendars"));
		if (selected && passedShowDeclinedEventsTest(jEvent, storage)) {
			var event = convertEventToFullCalendarEvent(jEvent, snoozeTime);
			fullCalendarEvents.push(event);
		}
	}
	return fullCalendarEvents;
}

function openSiteInsteadOfPopup() {
	openingSite = true;
	openGoogleCalendarWebsite();
}

var tooLateForShortcut = false;
setInterval(function() {tooLateForShortcut=true}, 500);
window.addEventListener ("keydown", function(e) {
	console.log("keydow", e);
	// for bypassing popup and opening google calendar webpage
	if (fromToolbar && !tooLateForShortcut && isCtrlPressed(e)) {
		tooLateForShortcut = true;
		if (donationClicked("CtrlKeyOnIcon")) {
			openSiteInsteadOfPopup();
			return;
		}
	}
	
	if (isCtrlPressed(e)) {
		$("#betaCalendar").addClass("ctrlKey");
	}
	
	if (!isFocusOnInputElement()) {
		if (e.keyCode == 39 || e.keyCode == 40) { // right arrow or down arrow
			$("#betaCalendar").fullCalendar("next");
		} else if (e.keyCode == 37 || e.keyCode == 38) { // up arrow or left arrrow
			$("#betaCalendar").fullCalendar("prev");
		}
	}
	
	// for Dismissing events
	if (e.altKey && letterPressedEquals(e, "d")) {
		chrome.runtime.sendMessage({name: "dismissAll"}, function() {
			closeWindow();
		});		
	}
	
}, false);

window.addEventListener ("keyup", function(e) {
	if (!isCtrlPressed(e)) {
		$("#betaCalendar").removeClass("ctrlKey");
	}
}, false);

function pollServerAndGetBGObjects(params) {
	return new Promise(function(resolve, reject) {
		chrome.runtime.sendMessage({name:"pollServer", params:params}, function(response) {
			getBGObjects().then(function() {
				if (response && response.error) {
					reject(response.error);
				} else {
					resolve(response);
				}
			}).catch(function(error) {
				reject(error);
			});
		});
	});
}

function reloadCalendar(params) {
	return new Promise(function(resolve, reject) {
		// default atleast in the context of this popup window is to ignorenotification for performance
		params.ignoreNotifications = true;
		
		pollServerAndGetBGObjects(params).catch(error => {
			showCalendarError(error);
		}).then(function(response) {
			if (params.refetchEvents) {
				$("#betaCalendar").fullCalendar( 'refetchEvents' );
			}
			if (getCalendarView() == CalendarView.AGENDA) {
				initAgenda();
				hideLoading();
			}
			resolve();
		});
	});
}

function setStatusMessage(params) {
	var $toast = $("#eventToast");
	var duration = params.onEditClick || params.onUndoClick ? 6 : 2;
	
	if (params.onEditClick) {
		$toast.find(".toastEditEvent")
			.removeAttr("hidden")
			.off()
			.click(function() {
				$toast[0].hide();
				params.onEditClick();
			})
		;
	} else {
		$toast.find(".toastEditEvent").attr("hidden", "");
	}
	
	if (params.onUndoClick) {
		$toast.find(".toastUndoEvent")
			.removeAttr("hidden")
			.off()
			.click(function() {
				$toast[0].hide();
				params.onUndoClick();
			})
		;
	} else {
		$toast.find(".toastUndoEvent").attr("hidden", "");
	}
	
	showToast({toastId:"eventToast", text:params.message, duration:duration, keepToastLinks:true});
}

function setEventDateMessage(eventEntry) {
	var message = formatEventAddedMessage("<span class='eventTitle'>" + $.trim(eventEntry.summary) + "</span>", eventEntry);
	
	// for safe Firefox DOM insertion
	var messageNode = new DOMParser().parseFromString(message, "text/html").body;
	var $message = $("<span/>");
	Array.from(messageNode.childNodes).forEach(node => {
		var $eventTitle = $("<span/>");
		$eventTitle.text(node.textContent);
		if (node.className) {
			$eventTitle.addClass(node.className);
		}
		$message.append( $eventTitle );
	});
	
	
	setStatusMessage({
		message: $message,
		eventEntry: eventEntry,
		onEditClick: function() {
			showCreateBubble({event:eventEntry, editing:true});
		},
		onUndoClick: function() {
			showSaving();
			deleteEvent(eventEntry).then(function(response) {
				$("#betaCalendar").fullCalendar('removeEvents', getEventID(eventEntry));
				setStatusMessage({message:getMessage("eventDeleted")});
				
				if (getCalendarView() == CalendarView.AGENDA) {
					initAgenda();
				}
			}).catch(error => {
				showError("Error deleting event: " + error);
			}).then(() => {
				hideSaving();
			});
		}
	});
}

function maybePerformUnlock(processor, callback) {
	callback();
}

function cleanICal(str) {
	return str.replace(/\\/g, "");
}

function initReminderLine($createEventDialog, $calendarReminder, allDay) {
	var $reminderMinutes = $calendarReminder.find(".reminderMinutes");
	var $reminderValuePerPeriod = $calendarReminder.find(".reminderValuePerPeriod");
	var $reminderPeriod = $calendarReminder.find(".reminderPeriod");

	initReminderPeriod($reminderValuePerPeriod, $reminderPeriod, $reminderMinutes, allDay);
	
	$calendarReminder.find("paper-item").off().click(function() {
		updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod);
		$createEventDialog.data("remindersChanged", true);
	});
	
	$calendarReminder.find("paper-input").off().change(function() {
		updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod);
		$createEventDialog.data("remindersChanged", true);
	});
	
	$calendarReminder.find(".deleteReminder").off().click(function() {
		var index = $(".calendarReminder").index($calendarReminder);
		$createEventDialog.find("event-reminders")[0].splice("reminders", index, 1);
		$createEventDialog.data("remindersChanged", true);
	});
	
	//initMessages($calendarReminder.find("paper-item"));
}

function initAllReminders($createEventDialog, allDay) {
	
	setTimeout(function() {
		
		$createEventDialog.data("remindersChanged", false);
		$createEventDialog.find(".calendarReminder").each(function() {
			var $calendarReminder = $(this);
			initReminderLine($createEventDialog, $calendarReminder, allDay);
		});
		
		$createEventDialog.find("#addReminder").off().on("click", function() {
			var reminder;
			if (allDay) {
				reminder = {method:"popup", minutes:1440}; // 1 day
			} else {
				reminder = {method:"popup", minutes:10};
			}
			
			$createEventDialog.find("event-reminders")[0].push("reminders", reminder);
			$createEventDialog.data("remindersChanged", true);
			
			setTimeout(function() {
				initReminderLine($createEventDialog, $(".calendarReminder").last(), allDay);
				$createEventDialog.find("paper-dialog-scrollable")[0].scrollTarget.scrollTop=99999;
			}, 1)
		});

	}, 1);
}

// created patch method to "change" reminders to maintain polymer array binding
function changeReminders(allDay, $createEventDialog, allDayReminders, timedReminders) {
	if (allDay) {
		$createEventDialog.find("event-reminders")[0].splice("reminders", 0, 99);
		allDayReminders.forEach(function(reminder) {
			$createEventDialog.find("event-reminders")[0].push("reminders", reminder);
		});
		initAllReminders($createEventDialog, true);
		$createEventDialog.data("allDay", true);
	} else {
		$createEventDialog.find("event-reminders")[0].splice("reminders", 0, 99);
		timedReminders.forEach(function(reminder) {
			$createEventDialog.find("event-reminders")[0].push("reminders", reminder);
		});
		initAllReminders($createEventDialog, false);
		$createEventDialog.data("allDay", false);
	}
}

function initColorChoice($content, colorId, color) {
	var $color = $("<div class='colorChoice'><paper-ripple center style='color:white'></paper-ripple></div>");
	$color
		.css("background", color)
		.data("colorId", colorId)
	;
	$color.click(function() {
		$("#eventColor")
			.css("background", color)
			.data("colorId", colorId)
		;
		$("#eventColorsDialog")[0].close();
	});
	$content.append($color);
}

function showEventColors(colors, calendar) {
	var $content = $("<div/>");
	
	var bgColor = colors.calendar[calendar.colorId].background;
	initColorChoice($content, null, bgColor);
	
	$content.append($("<div style='background:#aaa;width:1px;height:21px;display:inline-block;margin-right:7px'/>"));
	
	for (a in colors.event) {
		initColorChoice($content, a, colors.event[a].background);
	}
	
	var $dialog = initTemplate("eventColorsDialogTemplate");
	$dialog.find("h2").text( getMessage("eventColor") );
	$dialog.find(".dialogDescription").empty().append( $content );
	
	openDialog($dialog).then(function(response) {
		$dialog[0].close();
	});
	
	return $dialog;
}

function showCreateBubble(params) {
	console.time("create");
	console.log("showCreateBubble", params);
	
	var event = params.event;
	
	var $createEventDialog = initTemplate("createEventDialogTemplate");
	
	// need to re-initialize Date object here because .format was not found
	event.startTime = new Date(event.startTime);

	$createEventDialog.find("#createEventDate").text( generateTimeDurationStr({event:event}) );
	
	initCalendarDropDown( $("#createEventCalendarsTemplate") );
	$("#createEventCalendar").attr("label", getMessage("calendar"));
	$("#createEventCalendar").find("paper-item").off().click(function() {
		initEventColor(event);
	});
	
	var reminders;
	var allDayReminders = [{method:"popup", minutes:0}].clone();
	var timedReminders = writeableCalendars.first().defaultReminders.clone();
	
	$createEventDialog.data("allDay", event.allDay);

	
	function initAllDay(allDay) {
		if (allDay) {
			$("#eventStartTime").hide();
			$("#eventEndTime").hide();
		} else {
			$("#eventStartTime").show();
			$("#eventEndTime").show();
		}
	}
	
	function initEndTime(deltaMinutes) {
		var start = $("#eventStartTime").timepicker("getTime");
		var end = $("#eventEndTime").timepicker("getTime");
		
		var endTime = start.addMinutes(deltaMinutes);
		$("#eventEndTime").timepicker("setTime", endTime);
		
		// if duration times goes over the midnight then +1 to the end date
		if (!start.isSameDay(endTime)) {
			$("#eventEndDate").datepicker("setDate", $("#eventEndDate").datepicker("getDate").addDays(1));
		}
	}
	
	if (params.editing) {
		
		$createEventDialog.find("#createEventDate").hide();
		$("#createEventCalendar").find("paper-menu")[0].selected = event.calendar.id;
		
		var deltaDays = event.endTime.diffInDays(event.startTime);
		var deltaMinutes = event.endTime.diffInMinutes(event.startTime);
		if (deltaMinutes >= 60*24) { // if 1+ days then just use default length
			deltaMinutes = getDefaultEventLength();
		}
		
		var datePickerStartParams = generateDatePickerParams(storage);
		datePickerStartParams.onSelect = function() {
			var start = $("#eventStartDate").datepicker("getDate");
			var end = $("#eventEndDate").datepicker("getDate");
			
			// google calendar all day events actually end the next day, so for displaying purposes we display the day before
			var date = start.addDays(deltaDays);
			if ($("#eventAllDay")[0].checked) {
				date.setDate(date.getDate() - 1);
			}
			$("#eventEndDate").datepicker("setDate", date);
		}
		
		// must re-init (because we could have created dialog twice by clicking several events in the same popup window session and compounding datepicker calls)
		$("#eventStartDate").datepicker("destroy");
		$("#eventStartDate").datepicker(datePickerStartParams);
		$("#eventStartDate").datepicker("setDate", event.startTime);
		
		var timePickerStartParams = generateTimePickerParams();
		$("#eventStartTime").timepicker(timePickerStartParams);
		if (event.allDay) {
			$("#eventStartTime").timepicker('setTime', new Date());
		} else {
			$("#eventStartTime").timepicker('setTime', event.startTime);
		}
		$('#eventStartTime').off('changeTime').on('changeTime', function(e) {
			initEndTime(deltaMinutes);
		});
		
		var datePickerEndParams = generateDatePickerParams(storage);
		$("#eventEndDate").datepicker("destroy");
		$("#eventEndDate").datepicker(datePickerEndParams);
		if (event.allDay) {
			// google calendar all day events actually end the next day, so for displaying purposes we display the day before
			var date = new Date(event.endTime);
			date.setDate(date.getDate() - 1);
			$("#eventEndDate").datepicker("setDate", date);
		} else {
			$("#eventEndDate").datepicker("setDate", event.endTime);
		}

		var timePickerEndParams = generateTimePickerParams();
		$("#eventEndTime").timepicker(timePickerEndParams);
		if (event.allDay) {
			initEndTime(deltaMinutes);
		} else {
			$("#eventEndTime").timepicker('setTime', event.endTime);
		}
		
		$("#eventAllDay")[0].checked = event.allDay;
		initAllDay(event.allDay);
		
		$("#eventAllDay").change(function() {
			event.allDay = $("#eventAllDay")[0].checked;
			initAllDay(event.allDay);
			changeReminders(event.allDay, $createEventDialog, allDayReminders, timedReminders);
		});
		
		$("#eventStartEndTimeWrapper").show();
		
		if (!event.reminders || event.reminders.useDefault) {
			if (event.allDay) {
				reminders = allDayReminders.clone();
			} else {
				reminders = timedReminders.clone();
			}
		} else {
			reminders = event.reminders.overrides;
		}
	} else {
		$createEventDialog.find("#createEventDate").show();
		
		$("#createEventCalendar").find("paper-menu")[0].selected = getPrimaryCalendar(arrayOfCalendars).id;
		
		if (event.allDay) {
			reminders = allDayReminders.clone();
		} else {
			reminders = timedReminders.clone();
		}
		
		$("#eventStartEndTimeWrapper").hide();
	}
	
	if (!reminders) {
		reminders = [];
	}
	
	reminders.sort(function(a, b) {
		if (a.minutes > b.minutes) {
			return +1;
		} else {
			return -1;
		}
	});
	
	$createEventDialog.find("event-reminders").prop("reminders", reminders);
	if (!window.assignedStyleScopePatch) {
		patchToRemoveStyleScope(document.getElementsByTagName("event-reminders")[0]);
		window.assignedStyleScopePatch = true;
	}
	
	console.timeEnd("create")
	
	// must use keypress instead of keyup (ime japense input issue: https://jasonsavard.com/forum/discussion/comment/8236#Comment_8236)
	$createEventDialog.find("#eventTitle").off().keypress(function(e) {
		// check that we are not in weekview ie. must be a allDay event
		if (event.allDay && $(this).attr("id") == "eventTitle") {
			if ($(this).val().match(/\b\d/)) {
				if ($createEventDialog.data("allDay")) {
					changeReminders(false, $createEventDialog, allDayReminders, timedReminders);
				}
			} else {
				if (!$createEventDialog.data("allDay")) {
					changeReminders(true, $createEventDialog, allDayReminders, timedReminders);
				}
			}
		} 
		
		if (e.keyCode == 13) {
			$createEventDialog.find("paper-button[dialog-confirm]").trigger("click");
			// patch: seems when select time slots in weekview and pressing enter, that the dialog would not close
			$createEventDialog[0].close();
		}
	});
	
	$createEventDialog.on("iron-overlay-opened", function() {
		initEventColor(event);
		$createEventDialog.find("#eventTitle input").focus();
	});
	
	openDialog($createEventDialog).then(function(response) {
		
		var eventTitle = $("#eventTitle")[0].value;
		var description = $("#eventDescription")[0].value;
		var calendar = getSelectedCalendar( $("#createEventCalendar") );
		
		if (response == "ok") {
			
			if (!storage.get("donationClicked") && storage.get("_createEventTested") && !params.editing) {
				donationClicked("createEvent");
			} else {
				var eventEntry;
				if (params.editing) {
					eventEntry = clone(event);
					eventEntry.allDay = $("#eventAllDay")[0].checked;
					eventEntry.startTime = $("#eventStartDate").datepicker("getDate");
					eventEntry.endTime = $("#eventEndDate").datepicker("getDate");
					
					// google calendar all day events actually end the next day, so for displaying purposes we display the day before - now we must submit as next day
					if ($("#eventAllDay")[0].checked) {
						eventEntry.endTime.setDate(eventEntry.endTime.getDate() + 1);
					}
					
					var time;
					
					// since timepicker always returns current date we must instead use the date from the date picked and merge the time from the time picked
					time = $("#eventStartTime").timepicker("getTime");
					eventEntry.startTime.setHours( time.getHours() );
					eventEntry.startTime.setMinutes( time.getMinutes() );
					eventEntry.startTime.setSeconds( time.getSeconds() ); 
					eventEntry.startTime.setMilliseconds( time.getMilliseconds() );

					// since timepicker always returns current date we must instead use the date from the date picked and merge the time from the time picked
					time = $("#eventEndTime").timepicker("getTime");
					eventEntry.endTime.setHours( time.getHours() );
					eventEntry.endTime.setMinutes( time.getMinutes() );
					eventEntry.endTime.setSeconds( time.getSeconds() ); 
					eventEntry.endTime.setMilliseconds( time.getMilliseconds() );
				} else {
					eventEntry = new EventEntry();
					eventEntry.startTime = event.startTime;
				}
				
				eventEntry.summary = eventTitle;
				eventEntry.description = description;
				eventEntry.calendar = calendar;
				eventEntry.colorId = $("#eventColor").data("colorId");
				
				eventEntry.location = $("#eventLocation")[0].value;
				var source = $createEventDialog.data("source");
				if (source) {
					eventEntry.source = source;
				}
				
				if ($createEventDialog.data("remindersChanged")) {
					var reminders = $createEventDialog.find("event-reminders").prop("reminders");
					console.log("reminder: ", reminders);
					eventEntry.reminders = {useDefault:false, overrides:reminders};
				}
				
				if ($("#currentPage").data("currentPageClicked")) {
					var favIconUrl = $("#currentPage").attr("src");
					if (favIconUrl) {
						eventEntry.extendedProperties = {};
						eventEntry.extendedProperties.private = {favIconUrl:favIconUrl};
					}
				}
				
				console.log("evententry", eventEntry);
				
				if (params.editing) {
					ensureSendNotificationDialog(event).then(function(sendNotifications) {
						showSaving();
						var updateEventParams = {eventEntry:eventEntry, event:event};
						updateEventParams.sendNotifications = sendNotifications;
						updateEvent(updateEventParams).then(function(response) {
							// quick refresh
							$("#betaCalendar").fullCalendar( 'refetchEvents' );

							setStatusMessage({message:getMessage("eventUpdated")});

							// then must pass bypassCache or else we would override the updated event seconds later
							// seems we need this line if we move and event and then edit it - or else the display is not refreshed in the betacalendar??
							reloadCalendar({source:"editEvent", bypassCache:true, refetchEvents:true}).then(function() {
								
							});
						}).catch(function(error) {
							showCalendarError(error);
						}).then(function() {
							hideSaving();
						});
					});
				} else {
					var saveEventMethodFlag;
					if (event.endTime) {
						eventEntry.endTime = event.endTime;
						eventEntry.quickAdd = false;
						eventEntry.allDay = event.allDay;
						saveEventMethodFlag = false;
					} else {
						eventEntry.allDay = true;
						saveEventMethodFlag = true;
					}
					
					saveAndLoadInCalendar(saveEventMethodFlag, eventEntry);
					
					if (!storage.get("donationClicked")) {
						setTimeout(function() {
							openGenericDialog({
								title: getMessage("extraFeatures"),
								content: "Creating events by clicking in the calendar is an extra feature.<br>Use the big red button instead to add events if you don't want to contribute.",
								otherLabel: getMessage("extraFeatures")
							}).then(function(response) {
								if (response == "other") {
									openUrl("donate.html?action=createEvent");
								}
							});
						}, 2200);
					}
					storage.setDate("_createEventTested");
				}
			}
		} else if (response == "other") {

			var eventEntry = {summary:eventTitle, description:description, calendar:calendar};
			var currentView = $('#betaCalendar').fullCalendar("getView").name;
		
			if (params.editing) {
				openUrl(getEventUrl(event));
			} else {
				if (!eventTitle || (!event.allDay && (currentView == CalendarView.WEEK || currentView == CalendarView.DAY))) {
					// user has "selected" the time in the calendar - so don't parse the time from string
					eventEntry.allDay = event.allDay;
					eventEntry.startTime = event.startTime;
					eventEntry.endTime = event.endTime;
					openGoogleCalendarEventPage(eventEntry);
				} else {
					// parse the time from string
					var parseParams = {};
					parseParams.text = eventTitle;
					parseParams.startTime = event.startTime;
					parseParams.endTime = event.endTime;
					
					googleCalendarParseString(parseParams, function(response) {
						if (response.error) {
							eventEntry.allDay = true;
							eventEntry.startTime = event.startTime;
						} else {
							eventEntry.summary = response.summary;
							eventEntry.allDay = response.allDay;
							if (response.startTime) {
								eventEntry.startTime = response.startTime;
								eventEntry.endTime = response.endTime;
							}
						}
						openGoogleCalendarEventPage(eventEntry);
					});
				}
			}
		}
	});
	
	initAllReminders($createEventDialog, event.allDay);
	
	if (params.editing) {
		$createEventDialog.find("#eventTitle")[0].value = event.summary;
		$createEventDialog.find("#eventLocation")[0].value = event.location;
		$createEventDialog.find("#eventDescription")[0].value = event.description;
	} else {
		$createEventDialog.find("#eventTitle")[0].value = "";
		$createEventDialog.find("#eventLocation")[0].value = "";
		$createEventDialog.find("#eventDescription")[0].value = "";
	}
	
	function initEventColor(event) {
		if (params.editing && event.colorId) {
			var color = colors.event[event.colorId].background;
			$createEventDialog.find("#eventColor")
				.css("background", color)
				.data("colorId", event.colorId)
			;
		} else {
			var calendar = getSelectedCalendar( $("#createEventCalendar") );
			var bgColor = colors.calendar[calendar.colorId].background;
			$createEventDialog.find("#eventColor")
				.css("background", bgColor)
				.data("colorId", null)
			;
		}
	}

	getActiveTab(function(tab) {
		if (tab && tab.favIconUrl) {
			$("#currentPage")
				.off()
				.removeAttr("icon")
				.attr("src", tab.favIconUrl)
			;
		}
		
		if (tab) {
			$("#currentPage").off().click(function() {
				$(this).data("currentPageClicked", true);
				getEventDetailsFromPage(tab, function(response) {
					if (!$("#eventTitle")[0].value) {
						$("#eventTitle")[0].value = response.title;
					}
					descriptionFromPage = response.description;
					$("#eventLocation")[0].value = tab.url;
					if (tab.url != response.description) {
						$("#eventDescription")[0].value = response.description;
					}
					$createEventDialog.data("source", {title:response.title, url:tab.url});
				});
			});
		}
		
		var placeHolder;
		if (event.endTime) {
			if (event.allDay) {
				placeHolder = getMessage("quickAddDefaultTextMultipleDays");
			} else {
				placeHolder = getMessage("quickAddDefaultTextMultipleHours");
			}
		} else {
			placeHolder = getMessage("quickAddDefaultText");					
		}
		$("#eventTitle").prop("placeholder", placeHolder)		
	});
	
	$("#eventColor").off().click(function() {
		var calendar = getSelectedCalendar( $("#createEventCalendar") );
		showEventColors(colors, calendar);
	});
	
	$("#eventLocation").off().focus(function() {
		if (!window.initWhereAutocomplete) {
			window.initWhereAutocomplete = function() {
			    autocomplete = new google.maps.places.Autocomplete(
			        ($("#eventLocation")[0].inputElement));
			
			    // When the user selects an address from the dropdown, populate the address
			    // fields in the form.
			    autocomplete.addListener('place_changed', function() {
			    	// copy the native value to the paper-input value
			    	$("#eventLocation")[0].value = $("#eventLocation")[0].inputElement.value;
			    });
			}

			$.ajax({
				type: "GET",
				url: "https://maps.googleapis.com/maps/api/js?key=AIzaSyDXReaPD426Bgnt4Aw83HGKKDdpjDFHKiQ&libraries=places&callback=initWhereAutocomplete",
				dataType: "jsonp",
				jsonp: "jsoncallback",
				timeout: seconds(5)
			});
		}
	})
}

function fetchAndDisplayEvent(url) {
	// must use this method because $.getScript uses eval and is produces unsafe-eval errors
	var link = document.createElement('script');
	link.src = '/js/jquery.icalendar.js'
	link.onload = function() {
		$.ajax({
			url: url,
			type: "GET",
			jsonpCallback: "hello",
			timeout: 10000,
			complete: function(request, textStatus) {
				if (request.status == 200) {
					
					polymerPromise2.then(function() {
						 
						 var $fbOverlay = initTemplate("fbOverlayTemplate");
						
						 var ical = $.icalendar.parse(request.responseText);
						 
						 var foundEvent = events.some(function(event) {
							 if (event.summary == ical.vevent.summary) {
								 console.log("facebook event already exists!")
								 return true;
							 }
						 });
	
						 if (!foundEvent) {
							 console.log("parse fb event");
							 var start = request.responseText.indexOf("DTSTART");
							 var end = request.responseText.indexOf("DTEND");
							 
							 var dtStart;
							 var startDateOnly;
							 
				 			 var eventEntry = new EventEntry();
	
							 try {
								 dtStart = request.responseText.substring(start+8, end-2);
								 // date only found ie. DTSTART:20121016
								 if (dtStart.length <= 10) {
									 startDateOnly = dtStart.parseDate();
									 startDateOnly.setDate(startDateOnly.getDate() + 1);
								 }
							 } catch (e) {
								 console.log("coud not parse for dtstart: ", e);
							 }
							 
							 //$fbOverlay.attr("heading", ical.vevent.summary);
							 $("#fbEventTitle").text(ical.vevent.summary);
							 
							 if (startDateOnly) {
								 ical.vevent.dtstart = startDateOnly;
								 ical.vevent.dtend = new Date(startDateOnly);
								 ical.vevent.dtend.setDate(ical.vevent.dtend.getDate() + 1);
								 eventEntry.allDay = true;
							 }
				 				
							 var dateStr = ical.vevent.dtstart.format("dddd, mmmm d");
							 if (!startDateOnly) {
								 dateStr += ", " + ical.vevent.dtstart.formatTime() + "";
							 }
							 
							 $("#fbEventDate div").text(dateStr);
							 
							 openDialog($fbOverlay).then(function(response) {
								 if (response == "ok") {
									 eventEntry.quickAdd = false;
									 eventEntry.summary = cleanICal(ical.vevent.summary);
									 eventEntry.description = cleanICal(ical.vevent.description);
									 eventEntry.location = cleanICal(ical.vevent.location);
							 			
									 eventEntry.startTime = ical.vevent.dtstart;
									 eventEntry.endTime = ical.vevent.dtend;
	
									 eventEntry.calendar = arrayOfCalendars.first();
							 			
									 saveAndLoadInCalendar(false, eventEntry);
								 }
							 }).catch(function(error) {
								 showError("error: " + error);
							 });								 
							 
						 }
					 });
				}
			}
		});		
	};
	link.onerror = function(e) {
		console.log("jerror loading icalendar: ", e);
	};
	document.head.appendChild(link);
}

function saveAndLoadInCalendar(saveEventMethodFlag, eventEntry) {
	return new Promise((resolve, reject) => {
		var saveFunction;
		if (saveEventMethodFlag) {
			saveFunction = saveEvent;
		} else {
			saveFunction = postToGoogleCalendar;
		}
		
		$("#betaCalendar").fullCalendar('unselect');

		console.log("savefunc: ", eventEntry);

		showSaving();
		saveFunction(eventEntry).then(response => {
			console.log("savefunc2: ", eventEntry);
			var fcEvent = convertEventToFullCalendarEvent(eventEntry);
			$("#betaCalendar").fullCalendar('renderEvent', fcEvent)

			setEventDateMessage(eventEntry);
			
			$("#eventTitle").val("");
			reloadCalendar({source:"saveEvent"});
			resolve(response);
		}).catch(error => {
			// seems like status 500 errors are not returning details about the error and so the oauth just returns the statusText "error"
			if (error == "error") {
				showError("Intermittent error, please try again!");
			} else {
				showCalendarError(error);
			}
			reject(error);
		}).then(() => {
			hideSaving();
		});
	});
}

function strTimeToMinutes(str_time) {
  var arr_time = str_time.split(":");
  var hour = parseInt(arr_time[0]);
  var minutes = parseInt(arr_time[1]);
  return((hour * 60) + minutes);
}

function fetchEvents(params) {
	return new Promise((resolve, reject) => {
		var method;
		if (bg.fetchAllCalendarEvents) {
			bg.fetchAllCalendarEvents(params).then(response => {
				// must clone them
				newEvents = $.extend(true, [], response.events);
				resolve({events:newEvents});
			}).catch(error => {
				reject(error);
			});
		} else {
			// stringify dates etc. for sendmessage
			var fetchParams = JSON.parse(JSON.stringify(params));
			chrome.runtime.sendMessage({name:"fetchEvents", params:fetchParams}, function(response) {
				if (response.error) {
					reject(response.error);
				} else {
					response = JSON.parse(response);
					newEvents = response.events;
					newEvents.forEach(function(event) {
						parseEventDates(event);
					});
					resolve({events:newEvents});
				}
			});
		}
	});
}

function getAllEvents(events, start, end) {
	return new Promise((resolve, reject) => {
		console.log("getAllEvents");
		if (events.length == 0 || start.isBefore(events.first().startTime) || end.isAfter(events.last().startTime)) {
			showLoading();
			
			console.time("fetchEvents");
			fetchEvents({email:email, startDate:start, endDate:end, source:"popup", bypassCache:false}).then(function(response) {
				console.timeEnd("fetchEvents");
				return response;
			}).then(response => {
				var newEvents = [];
				if (response && response.events) {
					newEvents = response.events.slice();
				} else if (events) {
					newEvents = events.slice();
				}
				resolve(newEvents);
			}).catch(error => {
				hideLoading();
				showError("Try reload button or " + getMessage("accessNotGrantedSeeAccountOptions_accounts") + " options!", {
					text: getMessage("accessNotGrantedSeeAccountOptions_accounts"),
					onClick: function() {
						openUrl("options.html?accessNotGranted=true#accounts");
					}
				});
				console.error("getAllEvents error", error);
				reject(error);
			});
		} else {
			resolve(events.shallowClone());
		}
	});
}

function getSelectedCalendar($node) {
	var selectedCalendar = $node[0].selectedItem;
	var calendarId = $(selectedCalendar).attr("value");
	return getCalendarById(calendarId);
}

function convertFullCalendarCurrentDateToDate() {
	var date = $("#betaCalendar").fullCalendar( 'getDate' ).toDate();
	date = date.addMinutes( date.getTimezoneOffset() );
	return date;
}

function saveQuickAdd() {
	$("#save").addClass("disabled");
	
	// Must match what timeFilte and formatContent returns
	var eventEntry = new EventEntry();
	
	if (getCalendarView() == CalendarView.DAY) {
		// use currently selected day in day view
		eventEntry.startTime = convertFullCalendarCurrentDateToDate();
	}
	
	var summary = $("#quickAdd").val();
	if (!summary) {
		summary = getMessage("noTitle");
	}
	eventEntry.summary = summary;
	eventEntry.allDay = true; // default to this
	eventEntry.calendar = getSelectedCalendar($("#quickAddCalendarsMenu"));
	eventEntry.inputSource = "QUICK_ADD";

	sendGA('quickadd', 'click');
	
	saveAndLoadInCalendar(true, eventEntry).then(response => {
		$("#quickAdd")
			.attr("placeholder", "")
			.val("")
		;
	}).catch(error => {
		// do nothing because error is handled in saveAndLoadInCalendar
	}).then(() => {
		$("#save").removeClass("disabled");
		$("html").removeClass("quickAddVisible");
		$("#quickAddWrapper").removeClass("inputEntered");
	});
}

function searchEvents() {
	var calendar = getSelectedCalendar($("#searchCalendarsMenu"));
	
	showSaving();
	oauthDeviceSend({userEmail:email, type:"get", url: "/calendars/" + encodeURIComponent(calendar.id) + "/events", data:{q:$("#searchInput").val(), singleEvents:true, orderBy:"startTime"}}).then(response => {
		if (response.data.items.length) {
			var searchResultEvents = [];
			response.data.items.forEach(function(event) {
				console.log("result", event);
				initEventObj(event);
				event.calendar = calendar;
				searchResultEvents.push(event);
			});
			displayAgenda({events:searchResultEvents, showPastEvents:true, hideMultipleDayEvents:true});
		} else {
			showError("No results - try selecting another calendar");
		}
	}).catch(error => {
		showCalendarError(error);
	}).then(() => {
		hideSaving();
	});
}

function fetchAgendaEvents(params) {
	showLoading();
	console.log("start: " + params.start + " end: " + params.end);
	return getAllEvents(events, params.start, params.end).then(newEvents => {
		// deep down ... fetchCalendarEvents could pull events (cached, invisible etc.) that are outside of the start/stop parameters here
		// so let's restrict it here
		var indexOfEventWhichObeysStartTime = null;
		newEvents.some(function(newEvent, index) {
			if (indexOfEventWhichObeysStartTime == null && (newEvent.startTime.toJSON() == params.start.toJSON() || newEvent.startTime.isAfter(params.start))) {
				indexOfEventWhichObeysStartTime = index;
				return true;
			}
		});
		
		console.log("indexOfEventWhichObeysStartTime: " + indexOfEventWhichObeysStartTime);
		if (indexOfEventWhichObeysStartTime != null) {
			newEvents = newEvents.slice(indexOfEventWhichObeysStartTime);
		}
		
		params.newEvents = newEvents;
		displayAgenda(params);
		hideLoading();
	});
}

function initAgenda() {
 	displayAgenda({showStartingToday:true});
	polymerPromise2.then(() => {
		// IF agenda has more events then load all the rest
		if ($('[main]')[0] && $('[main]')[0].scroller && $('[main]')[0].scroller.scrollHeight > $("body").height()) {
			displayAgenda({scrollToToday:true});
		}
	});
}

function displayAgenda(params) {
	params = initUndefinedObject(params);
	
	console.log("displayagenda params", params);
	
	var eventsToDisplay;
	var dateToDisplay;
	if (params.newEvents) {
		eventsToDisplay = params.newEvents;
		if (eventsToDisplay.length) {
			dateToDisplay = eventsToDisplay.first().startTime;
		} else {
			dateToDisplay = new Date();
		}
	} else {
		if (params.events) {
			eventsToDisplay = params.events;
		} else {
			/*
			eventsToDisplay = events.filter(function(event) {
				if (event.endTime.diffInDays() >= -2) { //  && event.endTime.diffInDays() <= 7
					return true;
				}
			});
			*/
			/*
			eventsToDisplay = [];
			events.some((event) => {
				if (event.startTime.diffInDays() >= -2) {
					eventsToDisplay.push(event);
				}
				if (eventsToDisplay.length > 50) {
					return true;
				}
			});
			*/
			eventsToDisplay = events;
		}
		dateToDisplay = new Date();
	}

	displayAgendaHeaderDetails(dateToDisplay);
	
	var selectedCalendars = storage.get("selectedCalendars");
	
	$("#calendarTitleToolTip").text("");
	
	var $agendaEvents = $("#agendaEvents");
	var $agendaEventsForThisFetch = $("<div></div>");
	
	if ((!params.append && !params.prepend) || params.forceEmpty) {
		$agendaEvents.empty();
	}
	
	var eventsShown = 0;
	var previousEvent;
	
	var $agendaDay;
	var $firstEventOfTheDay;
	var hasAnEventToday;
	var addedPlaceHolderForToday;

	function displayAgendaEvents(eventParams) {
		var events = eventParams.events;

		$.each(events, function(index, event) {
			
			if (!params.newEvents && !hasAnEventToday && !addedPlaceHolderForToday && (event.startTime.isTomorrow() || event.startTime.isAfter(tomorrow()))) {
				addedPlaceHolderForToday = true;
				
				var placeHolderForTodayEvent = new EventEntry();
				placeHolderForTodayEvent.summary = getMessage("nothingPlanned");
				placeHolderForTodayEvent.startTime = today();
				placeHolderForTodayEvent.endTime = tomorrow();
				placeHolderForTodayEvent.allDay = true;
				placeHolderForTodayEvent.calendar = getPrimaryCalendar(arrayOfCalendars);
				placeHolderForTodayEvent.placeHolderForToday = true;
				
				displayAgendaEvents({events:[placeHolderForTodayEvent]});
			}
			
			if (index >= 20) {
				//return false;
			}
			
			// optimize for speed by skipping over before today events
			if (params.showStartingToday && event.endTime.isBefore(today())) {
				return true;
			}
			
			var eventTitle;
			var eventColor;
			var calendarSelected;
			eventTitle = event.summary;
			
			if (event.colorId && colors) { // storage.get("eventColors")
				eventColor = colors.event[event.colorId].background;
			} else {
				eventColor = colors.calendar[event.calendar.colorId].background;
			}
			
			calendarSelected = isCalendarSelectedInExtension(event.calendar, email, selectedCalendars);
			
			// because endtime is really 00:00:00 of the NEXT day so my isToday detects that it actually ends tomorrow which is incorrect
			var realEndDay = event.endTime.addSeconds(-1, true);
			
			if ((eventTitle && calendarSelected && passedShowDeclinedEventsTest(event, storage)) || event.placeHolderForToday) { // && (realEndDay.isToday() || event.endTime.isAfter())

				if (event.startTime.isToday()) {
					hasAnEventToday = true;
				}
				
				eventsShown++;
				
				if (!eventParams.multipleDayEventsFlag) {
					if (!previousEvent || event.startTime.toDateString() != previousEvent.startTime.toDateString()) {
						
						// different month detection
						if (!previousEvent) {
							if (!params.prepend) {
								var lastEventData = $agendaEvents.find(".agendaDay").last().data();
								if (lastEventData) {
									previousEvent = lastEventData.event;
									console.log("previous event", previousEvent.summary);
								}
							}
						}
						
						if (previousEvent && previousEvent.startTime.isBefore(event.startTime) && (previousEvent.startTime.getMonth() != event.startTime.getMonth() || previousEvent.startTime.getYear() != event.startTime.getYear())) {
							console.log("prev event: ", previousEvent.summary, event.startTime.format("mmm"));
							
							var agendaMonthHeaderFormat;
							if (event.startTime.getYear() == new Date().getYear()) {
								agendaMonthHeaderFormat = "mmm";
							} else {
								agendaMonthHeaderFormat = "mmm yyyy";
							}
							$agendaEventsForThisFetch.append( $("<div class='agendaMonthHeader'/>").append(event.startTime.format(agendaMonthHeaderFormat)) );
						}
						
						var $agendaDateWrapper = $("<div class='agendaDateWrapper'/>");
						var $agendaDate = $("<div class='agendaDate'/>");

						if (params.showPastEvents) {
							$agendaDate.text( event.startTime.format("mmm d yyyy") );
							$agendaDateWrapper.append( $agendaDate );
						} else {
							$agendaDate.text( event.startTime.getDate() );
							$agendaDateWrapper.append( $agendaDate );
							var $agendaDateDay = $("<div/>").append( dateFormat.i18n.dayNamesShort[event.startTime.getDay()] );
							$agendaDateWrapper.append( $agendaDateDay );
						}
						
						$agendaDay = $("<div class='agendaDay horizontal layout'/>");
						$agendaDay.append($agendaDateWrapper);
						$agendaDay.append( $("<div class='agendaDayEvents flex'/>") );
						$agendaDay.data({event:event});
						if (event.startTime.isToday()) {
							$agendaDay.addClass("today");
						} else if (event.startTime.isBefore() && !params.showPastEvents) {
							//$agendaDay.attr("hidden", "");
						}
						
						$agendaEventsForThisFetch.append($agendaDay);
						
						if (!params.hideMultipleDayEvents) {
							// find any previous multiple day events
							var multipleDayEvents = [];
							for (var a=index-1; a>=0; a--) {
								var thisEvent = events[a];
								if (isCalendarSelectedInExtension(thisEvent.calendar, email, selectedCalendars) && thisEvent.endTime.isAfter(event.startTime)) {
									//console.log("multiple day: " + event.startTime.getDate() + " " + event.startTime + " " + thisEvent.summary + " " + thisEvent.startTime + " " + thisEvent.endTime);
									//console.log("same day: " + thisEvent.endTime.isSameDay(event.startTime) + " after endtime: " + thisEvent.endTime.isAfter(event.startTime))
									multipleDayEvents.push(thisEvent);
								}
							}
							displayAgendaEvents({events:multipleDayEvents, multipleDayEventsFlag:true});
						}
					}
				}
				
				var $agendaEventTitleWrapper = $("<div class='agendaEventTitleWrapper'/>");
				var $eventIcon = $("<span class='eventIcon'/>");
				
				if (event.startTime.diffInDays() >= 0 && event.startTime.diffInDays() <= 3) { // only 3 days because the regex filtering for words slows down the display
					setEventIcon(customIconsDocument, event, $eventIcon);
					$agendaEventTitleWrapper.append( $eventIcon );
				}
				
				$agendaEventTitleWrapper.append( $("<span class='agendaEventTitle'/>").text(eventTitle) );
				if (eventParams.multipleDayEventsFlag) {
					$agendaEventTitleWrapper.append( $("<span/>").text("cont.") );
				}
				
				if (event.allDay) {
					if (event.location) {
						$agendaEventTitleWrapper.append( $("<div class='agendaEventLocation'/>").text(event.location) );
					}
				} else {
					$agendaEventTitleWrapper.append( $("<div class='agendaEventTime'/>").text(generateTimeDurationStr({event:event, hideStartDay:true})) );
					if (event.location) {
						$agendaEventTitleWrapper.append( $("<div class='agendaEventLocation'/>").text(event.location) );
					}
				}
				if (event.hangoutLink) {
					$agendaEventTitleWrapper.append( $("<div class='agendaEventVideo'/>").text("Video call") );
				}

				var $eventNode = $("<div>");
				if (hasUserDeclinedEvent(event)) {
					$eventNode.addClass("declined");
				}
				$eventNode.append( $agendaEventTitleWrapper );
				if (event.placeHolderForToday) {
					$eventNode.addClass("placeHolderForToday");
					$eventNode.append($("<paper-ripple>"));
				} else {
					$eventNode
						.addClass("agendaEvent")
						.css("background-color", eventColor)
					;
				}
				$eventNode.click(function() {
					if (event.placeHolderForToday) {
						var eventEntry = new EventEntry();
						eventEntry.allDay = true;
						eventEntry.startTime = today();
						showCreateBubble({event:eventEntry});
					} else {
						if (document.body.clientWidth >= 500) {
							showDetailsBubble({event:event, $eventNode:$eventNode});
						} else {
							openUrl(getEventUrl(event));
						}
					}
				})
				
				if (!params.showPastEvents && event.startTime.isToday() && event.endTime && event.endTime.isBefore()) {
					if (event.allDay) {
						// ignore today events
					} else {
						$eventNode.addClass("pastEvent");
					}
				}
				
				$agendaDay.find(".agendaDayEvents").append($eventNode);
				
				if (!$firstEventOfTheDay && (event.startTime.isToday() || event.startTime.isAfter())) { // (realEndDay.isToday() || event.endTime.isAfter())
					$firstEventOfTheDay = $agendaDay;
				}
				
				previousEvent = event;
			}
		});
	}
	
	console.time("displayAgendaEvents");
	displayAgendaEvents({events:eventsToDisplay});
	console.timeEnd("displayAgendaEvents");
	
	var BUFFER = 0;
	
	if (params.prepend) {
		$agendaEvents.prepend($agendaEventsForThisFetch);
		$('[main]')[0].scroller.scrollTop += $agendaEventsForThisFetch.height() + BUFFER;
	} else {
		$agendaEvents.append($agendaEventsForThisFetch);
	}
	
	// only scroll into view first time (when no data().events) exist)
	if ((!$agendaEvents.data().events && $firstEventOfTheDay && $firstEventOfTheDay.length) || params.scrollToToday) {
		window.autoScrollIntoView = true;
		
		$firstEventOfTheDay[0].scrollIntoView();
		// patch: seems that .scrollIntoView would scroll the whole body up and out of frame a bit so had to execute a 2nd one on the panel
		$("#drawerPanel")[0].scrollIntoView();
		
		// commented because using padding-top on .today event instead
		/*
		var currentScrollTop = $('[main]')[0].scroller.scrollTop;
		if (currentScrollTop >= BUFFER) {
			$('[main]')[0].scroller.scrollTop -= BUFFER;
		}
		*/
		
		// patch: seems that in the detached window the .scrollIntoView would scroll the whole body up and out of frame a bit, so just repaint the body after a little delay and the issue is fixed
		/*
		$("html").hide();
		setTimeout(function() {
			$("html").show();
		}, 1)
		*/
		
		// make sure the .scroll event triggers before i set it to false
		setTimeout(function() {
			window.autoScrollIntoView = false;
		}, 50);
	}
	
	$agendaEvents
		.data({events:eventsToDisplay})
	;
}

function initCalendarView(viewName) {
	var calendarViewValue;
	
	if (viewName == CalendarView.AGENDA) {
		calendarViewValue = "agenda";
	} else {
		calendarViewValue = viewName;
	}
	$("html").attr("calendarView", calendarViewValue);
}

function changeCalendarView(viewName) {
	console.log("previous: " + getCalendarView() + " new view: " + viewName);
	var previousCalendarView = getCalendarView();

	if (viewName != getCalendarView()) {
		storage.set("calendarView", viewName)
		
		// patch if previous view was basicDay (ie. my custom agenda view) then we must reload the betaCalendar because it was hidden and not properly initialized
		if (previousCalendarView == CalendarView.AGENDA && viewName != CalendarView.AGENDA) {
			location.reload(true);
		} else {
			
			initCalendarView(viewName);
			
			if (viewName == CalendarView.AGENDA) {
				initAgenda();
			} else {
				$("#betaCalendar").fullCalendar("changeView", viewName);
			}
		}
	}
	
	initOptionsMenu();
}

function initOptionsMenu() {
	$("#options-menu paper-icon-item").removeClass("iron-selected");
	
	var calendarView = getCalendarView();
	
	if (calendarView == CalendarView.AGENDA) {
		$("#viewAgenda").addClass("iron-selected");
	} else if (calendarView == CalendarView.DAY) {
		$("#viewDay").addClass("iron-selected");
	} else if (calendarView == CalendarView.WEEK) {
		$("#viewWeek").addClass("iron-selected");
	} else if (calendarView == CalendarView.MONTH) {
		$("#viewMonth").addClass("iron-selected");
	} else if (calendarView == CalendarView.FOUR_WEEKS) {
		$("#view4Weeks").addClass("iron-selected");
	}
}

function showDetailsBubble(params) {
	console.log("showdetailsbubble", params);
	
	var event = params.event;
	var isSnoozer;
	
	if (params.calEvent && params.calEvent.isSnoozer) {
		isSnoozer = true;
	}
	
	var $dialog = initTemplate("clickedEventDialogTemplate");
	
	var title = getSummary(event);
	
	if (isSnoozer) {
		title += " (snoozed)";
	}
	
	var $editingButtons = $dialog.find("#clickedEventDelete, #clickedEventEdit, #clickedEventColor");
	if (isCalendarWriteable(event.calendar)) {
		$editingButtons.show();
	} else {
		$editingButtons.hide();
		
		// exeption we can delete snoozes
		if (isSnoozer) {
			$dialog.find("#clickedEventDelete").show();
		}
	}
	
	var $eventIcon = $dialog.find(".eventIcon");
	$eventIcon.empty();
	setEventIcon(customIconsDocument, event, $eventIcon);
	
	$dialog.find("#clickedEventTitle")
		.text(title)
		.css("color", getEventColor(event))
		.off().click(function() {
			$dialog.find("#clickedEventEdit").click();
		})
	;
	
	$dialog.find("#clickedEventDate").text(generateTimeDurationStr({event:event}));

	if (event.calendar.primary) {
		$dialog.find("#clickedEventCalendarWrapper").attr("hidden", "");
	} else {
		$dialog.find("#clickedEventCalendar").text(event.calendar.summary);
		$dialog.find("#clickedEventCalendarWrapper").removeAttr("hidden");
	}

	// event.calendar.accessRole == "owner"
	if (event.creator && event.creator.self) {
		$dialog.find("#clickedEventCreatedByWrapper").attr("hidden", "");
	} else {
		var displayName = event.creator.displayName;
		if (!displayName) {
			displayName = event.creator.email;
		}
		var $creator = $("<a/>")
			.text(displayName)
			.attr("href", "mailto:" + event.creator.email)
			.attr("target", "_blank")
			.attr("title", event.creator.email)
		;
		$dialog.find("#clickedEventCreatedBy").empty().append($creator);
		$dialog.find("#clickedEventCreatedByWrapper").removeAttr("hidden");
	}

	var eventSource = getEventSource(event);

	var locationUrl;
	var locationTitle;
	
	var eventSourceUrl;
	
	// if source and location are same then merge them
	if (eventSource && eventSource.url == event.location) {
		locationUrl = eventSource.url;
		locationTitle = eventSource.title;
		$dialog.find("#clickedEventSourceWrapper").attr("hidden", "");
	} else {
		if (event.location) {
			locationUrl = event.location;
			locationTitle = event.location;
		}
		
		if (eventSource) {
			// show logo for this type of source 
			var $fieldIcon = $dialog.find("#clickedEventSourceWrapper .fieldIcon");
			$fieldIcon
				.removeAttr("icon")
				.removeAttr("src")
			;
			if (eventSource.isGmail) {
				$fieldIcon.attr("icon", "mail");
			} else if (event.extendedProperties && event.extendedProperties.private.favIconUrl) {
				$fieldIcon.attr("src", event.extendedProperties.private.favIconUrl);
			} else {
				$fieldIcon.attr("icon", "maps:place");
			}
			
			$dialog.find("#clickedEventSourceLink")
				.text(eventSource.title)
				.attr("href", eventSource.url)
				.attr("title", eventSource.url)
			;
			$dialog.find("#clickedEventSourceWrapper").removeAttr("hidden");
		} else {
			$dialog.find("#clickedEventSourceWrapper").attr("hidden", "");
		}
	}

	if (locationUrl) {
		$dialog.find("#clickedEventLocationMapLink")
			.text(locationTitle)
			.attr("href", generateLocationUrl(event))
		;
		$dialog.find("#clickedEventLocationWrapper").removeAttr("hidden");
	} else {
		$dialog.find("#clickedEventLocationWrapper").attr("hidden", "");
	}

	var hangoutLink = event.hangoutLink;
	if (hangoutLink) {
		$dialog.find("#clickedEventVideoLink").attr("href", hangoutLink);
		$dialog.find("#clickedEventVideoWrapper").removeAttr("hidden");
	} else {
		$dialog.find("#clickedEventVideoWrapper").attr("hidden", "");
	}

	if (event.attendees) {
		var $attendees = $dialog.find("#clickedEventAttendeesWrapper .clickedEventSubDetails");
		$attendees.empty();
		
		$.each(event.attendees, function(index, attendee) {
			console.log("attendee", attendee)
			var displayName = attendee.displayName;
			if (!displayName) {
				displayName = attendee.email;
			}
			var $attendee = $("<a/>")
				.text(displayName)
				.attr("href", "mailto:" + attendee.email)
				.attr("target", "_blank")
				.attr("title", attendee.email)
			;
			if (index >= 1) {
				$attendees.append($("<span>, </span>"));
			} else if (index >= 10) {
				$attendees.append($("<span>...</span>"));
				return false;
			}
			$attendees.append($attendee);
		});
		
		$dialog.find("#clickedEventGoingWrapper .goingStatusHighlighted").removeClass("goingStatusHighlighted");
		
		var eventAttendee;
		// fill out "Going" status etc.
		$.each(event.attendees, function(index, attendee) {
			console.log("attendee", attendee);
			if (attendee.email == event.calendar.id) {
				eventAttendee = attendee;
				if (attendee.responseStatus == "accepted") {
					$dialog.find("#goingYes").addClass("goingStatusHighlighted");
				} else if (attendee.responseStatus == "tentative") {
					$dialog.find("#goingMaybe").addClass("goingStatusHighlighted");
				} else if (attendee.responseStatus == "declined") {
					$dialog.find("#goingNo").addClass("goingStatusHighlighted");
				}
				$dialog.find("#clickedEventGoingWrapper").removeAttr("hidden");
				return false;
			}
		});
		
		$dialog.find("#goingYes, #goingMaybe, #goingNo").off().on("click", function() {
			var $goingNode = $(this);

			var responseStatus = $goingNode.attr("responseStatus");
			eventAttendee.responseStatus = responseStatus;

			var patchFields = {};
			patchFields.attendees = [];
			patchFields.attendees.push(eventAttendee);
			
			console.log("patch fields", patchFields, eventAttendee);
			
			showSaving();
			updateEvent({event:event, patchFields:patchFields}).then(function(response) {
				// success
				$dialog.find("#clickedEventGoingWrapper .goingStatusHighlighted").removeClass("goingStatusHighlighted");
				$goingNode.addClass("goingStatusHighlighted");
				
				if (params.jsEvent) {
					$(params.jsEvent.target).toggleClass("fcDeclinedEvent", responseStatus == "declined");
				}
				console.log(response);
				hideSaving();
			}).catch(error => {
				showError("Error: " + error);
				hideSaving();
			});

		});
	
		$dialog.find("#clickedEventAttendeesWrapper").removeAttr("hidden");
	} else {
		$dialog.find("#clickedEventAttendeesWrapper").attr("hidden", "");
		$dialog.find("#clickedEventGoingWrapper").attr("hidden", "");
	}
	
	if (event.description) {
		var description = event.description;
		if (description) {
			description = description.replaceAll("\n", "<br>");
		}
		$dialog.find("#clickedEventDescriptionWrapper .clickedEventSubDetails")
			.val(htmlToText(description))
			.attr("title", event.description.summarize(100))
		;
		$dialog.find("#clickedEventDescriptionWrapper").removeAttr("hidden");
	} else {
		$dialog.find("#clickedEventDescriptionWrapper").attr("hidden", "");
	}

	$dialog.find("#clickedEventClose").off().click(function() {
		$dialog[0].close();
	});

	$dialog.find("#clickedEventDelete").off().on("click", function(e) {
		console.log("del event", e);
		
		$dialog[0].close();

		if (isSnoozer) {
			var snoozers = storage.get("snoozers");
			for (var a=0; a<snoozers.length; a++) {
				var snoozer = snoozers[a];
				console.log("snooze found")
				if (isSameEvent(event, snoozer.event)) {
					console.log("remove snooze");
					// remove it in local context here of popup
					snoozers.splice(a, 1);
					// remove it also from storage also!
					chrome.runtime.sendMessage({name:"removeSnoozer", eventId:snoozer.event.id}, function() {
						$("#betaCalendar").fullCalendar('removeEvents', params.calEvent.id);
					});
					break;
				}
			}
		} else {
			ensureSendNotificationDialog(event, true).then(sendNotifications => {
				showSaving();
				deleteEvent(event, sendNotifications).then(function(response) {
					setStatusMessage({message:getMessage("eventDeleted")});
	
					if (response.changeAllRecurringEvents) {
						reloadCalendar({source:"eventDeleted", bypassCache:true, refetchEvents:true});
					} else {
						$("#betaCalendar").fullCalendar('removeEvents', event.id);
					}
	
					if (getCalendarView() == CalendarView.AGENDA) {
						initAgenda();
					}
					
					if ($("html").hasClass("searchInputVisible")) {
						params.$eventNode.remove();
					}
				}).catch(error => {
					showCalendarError(error);
				}).then(() => {
					hideSaving();
				});
			});
		}
	});

	$dialog.find("#clickedEventColor").off().on("click", function(e) {
		var $dialog = showEventColors(colors, event.calendar);
		$dialog.on("iron-overlay-opened", function() {
			$(".colorChoice").click(function() {
				var newColorId = $(this).data("colorId");

				var patchFields = {};
				patchFields.colorId = newColorId;
				
				if (newColorId) {
					event.colorId = newColorId;
				} else {
					delete event.colorId;
				}
				
				showSaving();
				updateEvent({event:event, patchFields:patchFields}).then(function(response) {
					if (getCalendarView() == CalendarView.AGENDA) {
						initAgenda();
					} else {
						$("#betaCalendar").fullCalendar( 'refetchEvents' );
						setTimeout(function() {
							reloadCalendar({source:"editEventColor", bypassCache:true, refetchEvents:true});
						}, 100);
					}
					hideSaving();
				});
			});
		});
	});

	$dialog.find("#clickedEventEdit").off().on("click", function(e) {
		$dialog[0].close();
		if (isSnoozer) {
			openReminders({notifications:[{event:event}]}).then(function() {
				close();
			});
		} else {
			showCreateBubble({event:event, editing:true});
		}
	});
	
	$dialog.find("#clickedEventOpenInCalendar").off().click(function() {
		if (isSnoozer) {
			openReminders({notifications:[{event:event}]}).then(function() {
				close();
			});
		} else {
			openUrl(getEventUrl(event));
		}
	});
	
	openDialog($dialog).then(function(response) {
		if (response == "ok") {
			
		}
	});
}

function displayAgendaHeaderDetails(date) {
	$("#calendarTitle").text(date.format("mmmm yyyy"));
}

function popout() {
	openUrl("popup.html");
}

function openOptions() {
	if (inWidget) {
		openUrl("options.html?ref=popup#widget");
	} else {
		openUrl("options.html?ref=popup");
	}
}

function openContribute() {
	openUrl("donate.html?ref=CalendarCheckerOptionsMenu");
}

function openHelp() {
	openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar?ref=CalendarCheckerOptionsMenu");
}

function calculateCalendarHeight() {
	return document.body.clientHeight - 64; // v3: back to 64 - had empty space i could use at bottom v2: 82 v1: zoom issue was stuck and i had to reload extension or else use 64??; // 82 = header       $("#main paper-toolbar").height() + 18
}

function initCalendarDropDown($template) {
	// template will only exist the first time because i overwrite it with the dom once initiated
	if ($template.length) {
		var template = $template[0];
		var paperMenuDiv = template.content.querySelector("paper-menu");
		
		writeableCalendars.forEach(function(calendar) {
			var calendarName = getCalendarName(calendar);
			var paperItem = document.createElement("paper-item");
			var textNode = document.createTextNode(calendarName);
			paperItem.appendChild(textNode);
			paperItem.setAttribute("value", calendar.id);
			
			paperMenuDiv.appendChild(paperItem);
		});
		
		var node = document.importNode(template.content, true);
		$template.replaceWith(node);
	}
}

function initQuickAdd() {
	// patch: because auto-bind did not work when loading polymer after the dom (and we I use a 1 millison second timeout before loading polymer to load the popup faster)
	// note: we are modifying the template and not the importedDom because that wouldn't work, polymer wouldn't process the paper-item nodes proplerly
	// note2: I moved this code from startup to the .click event because it was consuming more and more memory everytime I opened the popup window
	initCalendarDropDown( $("#quickAddCalendarsTemplate") );
	
	$("html").addClass("quickAddVisible");
	$("#quickAdd").focus();
}

function openGoogleCalendarEventPage(eventEntry) {
	var actionLinkObj = generateActionLink("TEMPLATE", eventEntry);
	var url = actionLinkObj.url + "?" + actionLinkObj.data;
	openUrl(url);
}

function ensureSendNotificationDialog(event, eventDeletionFlag) {
	return new Promise(function(resolve, reject) {
		if (event.attendees && event.attendees.length && event.organizer && event.organizer.self) {
			openGenericDialog({
				content: eventDeletionFlag ? getMessage("sendUpdateAboutCancelingEvent") : getMessage("sendUpdateToExistingGuests"),
				okLabel: getMessage("sendUpdates"),
				cancelLabel: getMessage("dontSend")
			}).then(function(response) {
				if (response == "ok") {
					resolve(true);
				} else {
					resolve();
				}
			});
		} else {
			resolve();
		}
	});
}

function init() {
	
	bgObjectsReady = new Promise(function(resolve, reject) {
		getBGObjects().then(response => {
			resolve(response);
		});
	});
	
	return bgObjectsReady.then(() => {
		// before jquery
	}).then(() => {
		return $.when( $.ready );
	}).then(() => {
		polymerPromise.then(() => {
			
			if (isDetached && storage.firstTime("popoutMessage")) {
				setTimeout(function() {
					var $dialog = initTemplate("popoutDialogTemplate");
					openDialog($dialog).then(function(response) {
						if (response == "ok") {
							// nothing
						} else if (response == "other") {
							openUrl("https://jasonsavard.com/wiki/Popout?ref=calendarPopoutDialog");
							$dialog[0].close();
						}
					});
				}, 500)
			}
			
			$("#title, #menu, #closeDrawer").click(function() {
				$("#drawerPanel")[0].togglePanel();
			});
			
			// was getting clone of undefined error if I called this render object without waiting for polymer to load (only happens because the #betaCalendar is inside the polymer tags) 
			//$('#betaCalendar').fullCalendar('render');
			
			// calling this right now because it's faster than waiting for the viewRender to load
			var view = $("#betaCalendar").fullCalendar( 'getView' );
			$("#calendarTitle").text(view.title);
			
			$.each(arrayOfCalendars, function(index, calendar) {
				var calendarName = getCalendarName(calendar);		
				var bgColor = colors.calendar[calendar.colorId].background;

				if (isCalendarWriteable(calendar)) {
					if (!calendar.hidden) {
						writeableCalendars.push(calendar);
					}
				}
				
				if (isGadgetCalendar(calendar)) {
					// exclude the weather etc. because i am not integrating it into calendar display
				} else {
					var $li = $("<paper-checkbox><div class='visibleCalendarLabel'></div></paper-checkbox>");
					$li.data("calendar", calendar);
					$li.attr("color-id", calendar.colorId);
					
					$li.click(function() {
						var selectedCalendars = storage.get("selectedCalendars");
						var calendar = $(this).data("calendar");
						
						if (!selectedCalendars[email]) {
							selectedCalendars[email] = {};
						}
						selectedCalendars[email][calendar.id] = !isCalendarSelectedInExtension(calendar, email, selectedCalendars);
						storage.set("selectedCalendars", selectedCalendars);

						showLoading();
						reloadCalendar({source:"selectedCalendars", refetchEvents:true});
					});
					
					if (isCalendarSelectedInExtension(calendar, email, storage.get("selectedCalendars"))) {
						$li.attr("checked", true);
					}
					
					$li.find(".visibleCalendarLabel")
						.text(calendarName)
						.attr("title", calendarName)
					;
					
					$("#visibleCalendars").append($li);
				}

			});
			
			setTimeout(function() {
				Polymer({
					is: "event-reminders",
					properties: {
						data: {
							type: Array,
							notify: true,
							value: []
						}
					}
				});

				var $createEventDialog = initTemplate("createEventDialogTemplate");
			}, 300);
			
			if (isDND()) {
				polymerPromise2.then(function() {
					showError(getMessage("DNDisEnabled"), {
						text: getMessage("turnOff"),
						onClick: function() {
							setDND_off();
							hideError();
						}
					});
				});
			}
		}).catch(error => {
			showLoadingError(error);
		});
		
		initCalendarView(getCalendarView());
		
		var $calendarColors = $("#calendarColors");
		var calendarColors = cachedFeeds["colors"];
		console.log("colors", calendarColors);
		if (calendarColors) {
			for (key in calendarColors.calendar) {
				var colorObj = calendarColors.calendar[key];
				$calendarColors.append("[color-id='" + key + "'] .checked.paper-checkbox {background-color:" + colorObj.background + " !important}\n");
				$calendarColors.append("[color-id='" + key + "'] .checked.paper-checkbox {border-color:" + colorObj.background + " !important}\n");
			}
		}

		if (storage.get("skinsEnabled")) {
			storage.get("skins").forEach(function(skin) {
				addSkin(skin);
			});
			addSkin(storage.get("customSkin"));
		}
		
		initialCalendarHeight = calculateCalendarHeight();
		
		if (openingSite) {
			return;
		} else {
			$("body").show();
		}

		if (inWidget) {
			$("html").addClass("widget");
		}
		
		var issueFixed = new Date(2014, 5, 29, 23);
		var maxDateToKeepNotice = issueFixed.addDays(5);
		// localStorage value was used for yay fixed issue "_quotaIssueDismissed"
		if (new Date().isBefore(maxDateToKeepNotice)) {
			if (!storage.get("_quotaIssueDismissed") && getInstallDate().isBefore(issueFixed)) {
				$("#notice").show();
				$("#dismissNotice").click(function() {
					storage.setDate("_quotaIssueDismissed");
					$("#notice").slideUp();
				});
			}
		} else {
			storage.remove("_quotaIssueDismissed");
		}
		
		var msgKey;
		if (Math.random() * 5 < 3) {
			msgKey = "quickAddDefaultText";
		} else {
			msgKey = "quickAddTitle";
		}
		$("#quickAdd").attr("placeholder", getMessage(msgKey));

		if (storage.get("pastDays")) {
			$("#betaCalendar").addClass("highlightPastDays");
		}
		if (storage.get("highlightWeekends")) {
			$("#betaCalendar").addClass("highlightWeekends");
		}
		
		if (storage.get("removeShareLinks") || getCalendarView() == CalendarView.AGENDA) {
			// hide actual share button
			$(".share-button").closest("paper-menu-button").remove();
			// hide share button (placeholder)
			$(".share-button").remove();
		}
		
		console.log("logout state: " + loggedOut);
		if (!loggedOut) {
			
			loadingTimer = setTimeout(function() {
				chrome.runtime.sendMessage({name:"oauthDeviceFindTokenResponse", email:email}, function(tokenResponse) {
					if (tokenResponse) {
						showLoading();
					}
				});
			}, 900);
			
			$("#wrapper").show();
			$("#calendarWrapper").hide();
			
			var date = new Date();
			var d = date.getDate();
			var m = date.getMonth();
			var y = date.getFullYear();
			
			var sources = [];
			source = {};
			
			source.events = function(start, end, timezone, callback) {
				console.log("source.events");
				
		    	// look if this date range not been added yet... 
				if (start == "Invalid Date") {
					console.log("invvvvvv");
					return;
				}
				
				var localStart = fcMomentDateToLocalDate(start);
				var localEnd = fcMomentDateToLocalDate(end);

		    	console.log("requested start/stop: " + events.length + " start: " + localStart + " end: " + localEnd);
				if (events.first() && events.last()) {
					console.log("current events: " + events.first().startTime + " " + events.last().startTime);
				} 
		    	
				console.time("getAllEvents");
				getAllEvents(events, localStart, localEnd).then(allEvents => {
					console.timeEnd("getAllEvents");
					hideLoading();
		    		
		    		if (storage.get("showSnoozedEvents")) {
			    		// includes snoozes
			    		var futureSnoozes = getSnoozes(storage.get("snoozers"), {includeAlreadyShown:true, excludeToday:true});
			    		console.log("future snoozes", futureSnoozes);
			    		allEvents = allEvents.concat(futureSnoozes);
		    		}

		    		console.time("convertEventsToFullCalendarEvents");
		    		var fcEvents = convertEventsToFullCalendarEvents(allEvents);
		    		console.timeEnd("convertEventsToFullCalendarEvents");
		    		
		    		//fcEvents = fcEvents.slice(-2);
		    		callback(fcEvents);
				});
		    	
		    }
			sources.push(source);
			
			var timeFormatStrNoDuration;
			var timeFormatStrWithDuration;
			
			var slotLabelFormat;
			
			if (storage.get("24hourMode")) {
				slotLabelFormat = "H:mm";
				timeFormatStrNoDuration = "H:mm";
				timeFormatStrWithDuration = "H:mm";
			} else {
				slotLabelFormat = "h(:mm)t";
				timeFormatStrNoDuration = "h(:mm)t";
				timeFormatStrWithDuration = "h(:mm)t";
			}
			
			var columnFormat = "M/D";
			if (storage.get("calendarSettings").dateFieldOrder == "MDY") {
				columnFormat = "M/D";
			} else if (storage.get("calendarSettings").dateFieldOrder == "DMY") {
				columnFormat = "D/M";
			} else if (storage.get("calendarSettings").dateFieldOrder == "YMD") {
				columnFormat = "M/D";
			}
			
			var minTime;
			var maxTime;
			
			try {
				minTime = storage.get("hideMorningHoursBefore").parseTime().format("HH:MM:00");
				var hideNightHoursAfter = storage.get("hideNightHoursAfter");
				if (hideNightHoursAfter == "24") {
					hideNightHoursAfter = "23:59";
				}
				maxTime = hideNightHoursAfter.parseTime().format("HH:MM:00");
			} catch (e) {
				logError("could not parse 'hide morning' hours: " + e);
			}
			
			polymerPromise.then(function() {
				
				if (getCalendarView() == CalendarView.AGENDA) {
					initAgenda();
		        	clearTimeout(loadingTimer);
		        	hideLoading();
				} else {
					$('#betaCalendar').fullCalendar({
						//eventSources: sources,
						lang: storage.get("lang"),
						views: {
					        fourWeeks: {
					            type: 'month',
					            duration: { weeks: storage.get("customView") },
					            buttonText: getMessage("Xweeks", storage.get("customView"))
					        }
					    },
						timeFormat: timeFormatStrNoDuration, // uppercase H for 24-hour clock, before it was {agenda:timeFormatStrWithDuration, '': timeFormatStrNoDuration
						columnFormat: {
						    month: 'ddd',    // Mon
						    week: 'ddd ' + columnFormat, // Mon 9/7
						    day: 'dddd ' + columnFormat  // Monday 9/7
						},
						nowIndicator: true,
						eventOrder: function(a, b) {
							if (a.jEvent.calendar.primary && !b.jEvent.calendar.primary) {
								return -1;
							} else if (!a.jEvent.calendar.primary && b.jEvent.calendar.primary) {
								return 1;
							} else {
								if (a.color == b.color) {
									return a.title.localeCompare(b.title);
								} else {
									if (a.color < b.color) {
										return -1;
									} else {
										return +1;
									}
								}
							}
						},
						slotLabelFormat: slotLabelFormat,
						fixedWeekCount: storage.get("weeksInMonth") == "auto" || getCalendarView() == CalendarView.FOUR_WEEKS ? false : true,
						height: calculateCalendarHeight(),
						eventLimit: true,
						eventLimitText: getMessage("more"),
						slotDuration: "00:" + storage.get("slotDuration") + ":00",
						//snapDuration: "00:60:00",
						defaultTimedEventDuration: "00:30:00",
						weekends: !storage.get("calendarSettings").hideWeekends,
						firstDay: storage.get("calendarSettings").weekStart,
						selectable: true,
						selectHelper: true,
						select: function(start, end, jsEvent, view) {
							console.log("args", arguments);
							
							var localStart = fcMomentDateToLocalDate(start);
							var localEnd = fcMomentDateToLocalDate(end);
							
							console.log("local: ", localStart, localEnd);

							console.log("select args", arguments);
							console.log("start: ", start.format('MMMM Do YYYY, h:mm:ss a'));
							console.log("start todate: ", start.toDate());
							console.log("getTimezoneOffset: " + new Date().getTimezoneOffset());
							
							var allDay = !start.hasTime();
							
							// patch because fc was set exclusive end date meaning if select only today the end date is tomorrow - so let's subtract 1 day
							if (allDay && (localEnd.getTime() - localStart.getTime() <= ONE_DAY)) { // means: all day and one day selection only (note: on DST day itself it seems i had to use <= ONE_DAY in the case of a rolling clock back 1 hour)
								var event = {startTime:localStart, allDay:allDay};
								showCreateBubble({event:event, mouseX:jsEvent.pageX, mouseY:jsEvent.pageY});
							} else {
								var event = {startTime:localStart, endTime:localEnd, allDay:allDay};
								showCreateBubble({event:event, mouseX:jsEvent.pageX, mouseY:jsEvent.pageY});
							}
						},
						editable: true,
						buttonText: {
					        today:    getMessage("today"),
					        month:    getMessage("month"),
					        week:     getMessage("week"),
					        day:      getMessage("day"),
					        basicDay: getMessage("agenda")
					    },
					    allDayText: getMessage("allDayText"),
					    scrollTime: (new Date().getHours()-1) + ':00:00',
					    minTime: minTime,
					    maxTime: maxTime,
					    isRTL: getMessage("dir") == "rtl",
					    weekNumbers: storage.get("showWeekNumbers"),
					    weekNumberCalculation: storage.get("weekNumberCalculation"),
					    monthNames: dateFormat.i18n.monthNames,
					    monthNamesShort: dateFormat.i18n.monthNamesShort,
					    dayNames: dateFormat.i18n.dayNames,
					    dayNamesShort: dateFormat.i18n.dayNamesShort,
						defaultView: getCalendarView(),
						viewRender: function(view, element) {
							clearTimeout(loadingTimer);
							setTimeout(function() {
								$("#calendarTitle").text(view.title);
							}, 1);
					    },
					    eventAfterAllRender: function(view) {
					    	// patch: seems i had to wait for this after all event render before calling  .fullCalendar('addEventSource', source)  (or alternative was to wait 200ms)
					    	console.log("eventAfterAllRender");

					    	if (betaCalendarFirstLoad) {
					    		betaCalendarFirstLoad = false;
					    		
								setTimeout(function() {
									showLoading();
									console.log("startsource");
									console.time("addeventsource");
									$("#betaCalendar").fullCalendar('addEventSource', source);
									console.timeEnd("addeventsource");
									
									if (storage.get("pastDays")) {
										setTimeout(function() {
											var todayCellOffset = $(".fc-today").offset();
											$(".fc-more-cell").each(function() {
												if ($(this).offset().top < todayCellOffset.top) {
													$(this).addClass("pastEvent");
												}
											});
										}, 1);
									}
								}, 1);
					    	}
					    },
					    dayRender: function( date, cell ) {
					    	if (storage.get("showDayOfYear")) {
					    		var $div = $("<div class='dayOfYear'/>")
					    		$div.text(date.format('DDDD'));
					    		cell.empty().append($div);
					    	}
					    },
						eventRender: function(fcEvent, element, view) {
							
							var localStart = fcMomentDateToLocalDate(fcEvent.start);
							var localEnd = fcMomentDateToLocalDate(fcEvent.end);
							
							element.on('dblclick', function() {
								setTimeout(function() {
									$("#clickedEventDialog")[0].close();
								}, 500);
								showCreateBubble({event:fcEvent.jEvent, editing:true});
							});
							
							var title;
							if (fcEvent.isSnoozer) {
								title = fcEvent.title + " (snoozed)";
								element.addClass("snoozedEvent");
							} else {
								title = fcEvent.title;
							}
							element.attr("title", title);
							
							var timedEvent;
							if (view.name == CalendarView.MONTH || view.name == CalendarView.FOUR_WEEKS) {
								// inverse fore/background colors (EXCEPT if the event spans on 2+ days)
								//console.log(title + " " + fcEvent.allDay + " " + localStart + " " + localEnd)
								if (!fcEvent.allDay && (!localEnd || localStart.isSameDay(localEnd))) {
									element.addClass("timedEvent");
									timedEvent = true;
									if (fcEvent.jEvent) {
										element.css("color", darkenColor(fcEvent.jEvent.calendar.backgroundColor));
										if (fcEvent.jEvent.colorId && colors) {
											var color = colors.event[fcEvent.jEvent.colorId].background;
											element.find(".fc-time").after("<span class='eventColorIndicator' style='background-color:" + color + "'>&nbsp;</span>");
										}
									} else {
										console.warn("color not found because jEvent not associated to event:", fcEvent);
									}
								}
							} else {
								var allDay = !fcEvent.start.hasTime();
								if (!allDay) {
									element
										//.css("background-color", darkenColor(fcEvent.jEvent.calendar.backgroundColor))
									;
								}
							}
							
							if (localEnd) {
								if (localEnd.isBefore()) {
									element.addClass("pastEvent");
								}
							} else {
								if (localStart && localStart.isBefore() && !localStart.isToday()) {
									element.addClass("pastEvent");
								}
							}
							
							if (fcEvent.isDeclined) {
								element.addClass("fcDeclinedEvent");
							}
							
							// test for jEvent because when doing a drag & drop to creat an event in day view the jEvent does not exist.
							if (fcEvent.jEvent) {
								element.attr("calendar", getCalendarName(fcEvent.jEvent.calendar));

								if (view.name == CalendarView.DAY) {
									var $eventIcon = $("<span class='eventIcon'></span>");
									if (setEventIcon(customIconsDocument, fcEvent.jEvent, $eventIcon)) {
										if (!timedEvent) {
											$eventIcon.css("fill", fcEvent.textColor);
										}
										element.find(".fc-title").prepend($eventIcon);
									}
								}
							}
							
						},
						eventClick: function(calEvent, jsEvent, view) {
							showDetailsBubble({event:calEvent.jEvent, calEvent:calEvent, jsEvent:jsEvent});
							// prevents href or url from clicked which caused issue in widget - more info: http://fullcalendar.io/docs/mouse/eventClick/
							return false;
						},
						eventDrop: function(fcEvent, delta, revertFunc, jsEvent, ui, view) {
							console.log("eventDrop", arguments);
							
							var localStart = fcMomentDateToLocalDate(fcEvent.start);
							var localEnd = fcMomentDateToLocalDate(fcEvent.end);

							var allDay = !fcEvent.start.hasTime();
							
							if (fcEvent.isSnoozer) {
								// do nothing seems to work because of rereence
								console.log("snooze dropped");
								
								storage.get("snoozers").some(function(snoozer) {
									if (snoozer.event.id == fcEvent.jEvent.id) {
										snoozer.time = localStart;
										chrome.runtime.sendMessage({name:"updateSnoozer", eventId:snoozer.event.id, time:localStart.toJSON()}, function() {});
										return true;
									}
								});
							} else {

								var eventEntry = clone(fcEvent.jEvent);

								if (isCtrlPressed(jsEvent)) {
									// copy event
									revertFunc();
									
									eventEntry.quickAdd = false;
									eventEntry.startTime = new Date(eventEntry.startTime.getTime() + delta.asMilliseconds()); //eventEntry.startTime.addDays(delta.days());
									if (eventEntry.endTime) {
										eventEntry.endTime = new Date(eventEntry.endTime.getTime() + delta.asMilliseconds()); //eventEntry.endTime.addDays(delta.days());
									}
									
									saveAndLoadInCalendar(false, eventEntry);
								} else {
									eventEntry.allDay = allDay;
									eventEntry.startTime = localStart;
									eventEntry.endTime = localEnd;
									
									ensureSendNotificationDialog(fcEvent.jEvent).then(function(sendNotifications) {
										showSaving();

										var updateEventParams = {eventEntry:eventEntry, event:fcEvent.jEvent};
										updateEventParams.sendNotifications = sendNotifications;
										
										updateEvent(updateEventParams).then(function(response) {
											setTimeout(function() {
												setStatusMessage({message:getMessage("eventUpdated")});
											}, 500);
											reloadCalendar({source:"dragDrop"});
											hideSaving();
										}).catch(function(error) {
											showCalendarError(error);
											revertFunc();
										});
									});
								}
							}
						},
						eventResize: function( fcEvent, delta, revertFunc, jsEvent, ui, view) { 
							var localStart = fcMomentDateToLocalDate(fcEvent.start);
							var localEnd = fcMomentDateToLocalDate(fcEvent.end);
							
							var eventEntry = {allDay:false, startTime:localStart, endTime:localEnd};
							
							ensureSendNotificationDialog(fcEvent.jEvent).then(function(sendNotifications) {
								
								var updateEventParams = {eventEntry:eventEntry, event:fcEvent.jEvent};
								updateEventParams.sendNotifications = sendNotifications;
								
								updateEvent(updateEventParams).then(function(response) {
									// also update the gEvent if you want to move this event again in the same popup session 
									setTimeout(function() {
										setStatusMessage({message:getMessage("eventUpdated")});
									}, 500);
									reloadCalendar({source:"eventResize"});
								}).catch(function(error) {
									showCalendarError(error);
									revertFunc();
								});
							});
						},
						windowResize: function(view) {
							console.log("windowResize");
							$('#betaCalendar').fullCalendar('option', 'height', calculateCalendarHeight());
						}
					});
					
					$("#betaCalendar").on("mousedown", function(e) {
						if (e.buttons == 1 && isCtrlPressed(e)) {
							openGenericDialog({
								content: "To copy an event drag first then hold Ctrl"
							});
						}
					});

					$("#betaCalendar").show();
					
					if (getInstallDate().isToday() && storage.firstTime("changeViewGuide")) {
						openGenericDialog({
							content: getMessage("useTheXToChangeViews", "<paper-icon-button style='vertical-align:middle' icon='more-vert'></paper-icon-button>")
						});
					}
				}
			}).catch(error => {
				showLoadingError(error);
			});

			$("#prev").click(function() {
				$("#betaCalendar").fullCalendar("prev");
			});

			$("#next").click(function() {
				$("#betaCalendar").fullCalendar("next");
			});
			
			$("#calendarTitle, #calendarTitleDropdown").click(function() {
				if (getCalendarView() == CalendarView.AGENDA) {
					
					var dayNamesVeryShort = [];
					dateFormat.i18n.dayNamesShort.forEach(function(dayName) {
						dayNamesVeryShort.push(dayName.charAt(0));
					});
					
					if (!$("#datepicker").hasClass("hasDatepicker")) {
						var datePickerStartParams = generateDatePickerParams(storage);
						datePickerStartParams.onSelect = function(dateText, inst) {
							var eventEntry = {};
							eventEntry.allDay = true;
							eventEntry.startTime = new Date(inst.selectedYear, inst.selectedMonth, inst.selectedDay).toJSON();
							chrome.runtime.sendMessage({name:"generateActionLink", eventEntry:eventEntry}, function(response) {
								if (inWidget) {
									top.location.href = response.url;
								} else {
									showCreateBubble({event:eventEntry});
								}
							});

							/*
							var start = $("#datepicker").datepicker( "getDate" );
							var end = start.addDays(21);
							
							displayAgendaHeaderDetails(start);
							
							fetchAgendaEvents({start:start, end:end, forceEmpty:true}).then(function() {
								// do nothing
							});
							*/
						};
						datePickerStartParams.onChangeMonthYear = function(year, month, inst) {
							var start = new Date(year, month-1, 1);
							var end = start.addDays(21);
							
							displayAgendaHeaderDetails(start);
							
							fetchAgendaEvents({start:start, end:end, forceEmpty:true}).then(function() {
								// do nothing
							});
						};
						$("#datepicker").datepicker(datePickerStartParams);
					}
					
					if ($("#datepickerWrapper").is(":visible")) {
						$("#mainToolbar").removeClass("tall");
						$("#datepickerWrapper").hide();
					} else {
						$("#mainToolbar").addClass("tall");
						//$('[main]')[0].scroller.scrollTop = 0;
						$("#datepickerWrapper").fadeIn();
					}
					
				} else {
					$("#betaCalendar").fullCalendar("today");
				}
			});
		}
		
		var futureSnoozes = getSnoozes(storage.get("snoozers"));
		
		if (futureSnoozes.length) {
			console.log("snozzes", futureSnoozes);
			
			var snoozesTitles = "";
			$.each(futureSnoozes, function(index, futureSnooze) {
				snoozesTitles += "\n- " + getSummary(futureSnooze.event);
			});
			
			$(".openSnoozedEvents").click(function() {
				openReminders({notifications:futureSnoozes.shallowClone()}).then(function() {
					close();
				});
			});
		} else {
			$(".openSnoozedEvents").prev(".separator").hide();
			$(".openSnoozedEvents").hide();
		}

		$(".skins")
			.click(function() {
				
				showLoading();
				
				var skinsSettings = storage.get("skins");
				
				bg.Controller.getSkins().then(function(skins) {
					
					var listWithFocus;
					var attemptedToAddSkin = false;
					
					var $dialog = initTemplate("skinsDialogTemplate");
					
					var $availableSkins = $dialog.find("#availableSkins");
					$availableSkins.empty();
					$availableSkins.off()
						.on("focus", function() {
							listWithFocus = "availableSkins";
						})
						.on("change", function() {
							$("#skinWatermark").removeClass("visible");
							var skin = $(this).find(":selected").data();
							addSkin(skin, "previewSkin");
							setSkinDetails($dialog, skin);
							
							$dialog.addClass("previewBackground");
							setTimeout(function() {
								$dialog.removeClass("previewBackground");
							}, 700);
						})
						.dblclick(function() {
							$dialog.find("#swapSkin").click();
						})
					;
					
					var $addedSkins = $dialog.find("#addedSkins");
					$addedSkins.empty();
					$addedSkins.off()
						.on("focus", function() {
							listWithFocus = "addedSkins";
						})
						.on("change", function() {
							var skin = $(this).find(":selected").data();
							setSkinDetails($dialog, skin);
						})
						.dblclick(function() {
							$dialog.find("#swapSkin").click();
						})
					;
					
					skins.forEach(function(skin) {
						var $option = $("<option/>");
						$option
							.text(skin.name)
							.attr("title", skin.name)
							.val(skin.id)
							.data(skin)
						;
						
						var skinAdded = skinsSettings.some(function(thisSkin) {
							if (skin.id == thisSkin.id) {
								return true;
							}
						});
						
						if (skinAdded) {
							$addedSkins.append($option);
						} else {
							$option.click(function() {
								//addSkin(skin, "previewSkin");
							});
							$availableSkins.append($option);
						}
					});
					
					if (storage.get("donationClicked")) {
						$dialog.find("#swapSkinToolTip").remove();
					} else {
						$dialog.find("#swapSkinToolTip #tooltip").text(getMessage("donationRequired"));
					}
					
					$dialog.find("#swapSkin").off().on("click", function(e) {
						attemptedToAddSkin = true;
						
						if (donationClicked("skins")) {
							if (listWithFocus == "availableSkins") {
								$("#previewSkin").remove();
								$availableSkins.find(":selected").each(function() {
									var skin = $(this).data();
									addSkin(skin);
									$addedSkins[0].selectedIndex = -1;
									$addedSkins.append( $(this) );
									$addedSkins.focus();
									skinsSettings.push(skin);
									storage.set("skins", skinsSettings);
									bg.Controller.updateSkinInstalls(skin.id, 1);
								});
							} else {
								$addedSkins.find(":selected").each(function() {
									var skin = $(this).data();
									removeSkin(skin);
									$availableSkins[0].selectedIndex = -1;
									$availableSkins.append( $(this) );
									$availableSkins.focus();
									skinsSettings.some(function(thisSkin, index) {
										if (skin.id == thisSkin.id) {
											skinsSettings.splice(index, 1);
											return true;
										}
									});
									storage.set("skins", skinsSettings);
									bg.Controller.updateSkinInstalls(skin.id, -1);
								});
							}
						}
					});
					
					if (storage.get("skinsEnabled")) {
						$dialog.find(".disableSkins").show();
						$dialog.find(".enableSkins").hide();
					} else {
						$dialog.find(".disableSkins").hide();
						$dialog.find(".enableSkins").show();
					}
					
					$dialog.find(".disableSkins").off().on("click", function() {
						storage.disable("skinsEnabled");
						location.reload();
					});
	
					$dialog.find(".enableSkins").off().on("click", function() {
						storage.enable("skinsEnabled");
						location.reload();
					});
	
					$dialog.find(".updateSkins").off().on("click", function() {
						skinsSettings.forEach(function(skinSetting) {
							skins.forEach(function(skin) {
								if (skinSetting.id == skin.id) {
									copyObj(skin, skinSetting);
									//skinSetting.css = skin.css;
									//skinSetting.image = skin.image;
									
									// refresh skin
									addSkin(skin);
								}
							});
						});
						storage.set("skins", skinsSettings);
						showMessage(getMessage("done"));
					});
					
					$dialog.find(".customSkin").off().on("click", function() {
						$("#previewSkin").remove();
						
						var $dialog = initTemplate("customSkinDialogTemplate");
	
						var customSkin = storage.get("customSkin");
	
						$dialog.find("textarea").val(customSkin.css);
						$dialog.find("#customBackgroundImageUrl").val(customSkin.image);
	
						$dialog.find(".shareSkin").off().on("click", function() {
							openUrl("https://jasonsavard.com/forum/categories/checker-plus-for-google-calendar-feedback?ref=shareSkin");
						});
	
						$dialog.find(".updateSkin").off().on("click", function() {
							$("#customSkin").remove();
							addSkin({id:"customSkin", css:$dialog.find("textarea").val(), image:$dialog.find("#customBackgroundImageUrl").val()});
							if (!storage.get("donationClicked")) {
								showMessage(getMessage("donationRequired"));
							}
						});
						
						openDialog($dialog).then(function(response) {
							if (response == "ok") {
								if (storage.get("donationClicked")) {
									customSkin.css = $dialog.find("textarea").val();
									customSkin.image = $dialog.find("#customBackgroundImageUrl").val();
									
									addSkin(customSkin);
									storage.set("customSkin", customSkin);
								} else {
									$dialog.find("textarea").val("");
									removeSkin(customSkin);
									if (!storage.get("donationClicked")) {
										showMessage(getMessage("donationRequired"));
									}
								}
								
								$dialog[0].close();
							}
						});
					});
					
					hideLoading();
					
					openDialog($dialog).then(function(response) {
						if (response == "ok") {
							if ($("#previewSkin").length) {
								$("#previewSkin").remove();
	
								if (!attemptedToAddSkin && donationClicked("skins")) {
									openGenericDialog({
										content: "Use the <paper-icon-button disabled style='vertical-align:middle' icon='swap-horiz'></paper-icon-button> button to add the skin!"
									}).then(function(response) {
										if (response == "ok") {
											// make sure next time the skins dialog closes when clicking done
											$dialog.find(".okDialog").attr("dialog-confirm", true);
										}
									});
								} else {
									$dialog[0].close();
								}
								
							} else {
								if (!storage.get("skinsEnabled")) {
									showMessage("You disabled the skins, use the Enable button");
								}
								$dialog[0].close();
							}
						}
					});
				}).catch(response => {
					showError("There's a problem, try again later or contact the developer!");
				});
			})
		;
		
		$(".options").click(function() {
			openOptions();
		});

		$(".contribute").click(function() {
			openContribute();
		});

		$(".help").click(function() {
			openHelp();
		});
		
		$("#goToToday").click(function() {
			$(".today")[0].scrollIntoView();
			$("#drawerPanel")[0].scrollIntoView();
		});
		
		$("#showSearch").click(function() {
			initCalendarDropDown( $("#searchCalendarsTemplate") );
			
			$("#agendaEvents").empty();
			$("html").addClass("searchInputVisible");
			$("#searchInput").focus();
		});
		
		$("#search").click(function() {
			searchEvents();
		});
		
		$("#searchInput")
			.keypress(function(e) {
				// enter pressed
				if (e.which == 13) {
					searchEvents();
				}
			})
		;
		
		$("#back").click(function() {
			$("html").removeClass("searchInputVisible");
			
			if (getCalendarView() == CalendarView.AGENDA) {
				initAgenda();
			} else {
				// patch: because a top margin would appear and create vertical scrollbars??
				$("#betaCalendar").fullCalendar( 'refetchEvents' );
			}
		});

		$("#refresh").click(function() {
			showLoading();
			reloadCalendar({source:"refresh", bypassCache:true, refetchEvents:true});
		});

		$(".close").click(function() {
			window.close();
		});
	
		chrome.runtime.sendMessage({name:"oauthDeviceFindTokenResponse", email:email}, function(tokenResponse) {
			if (!tokenResponse) {
				$("#drawerPanel").hide();
				$("#bigAddEventButtonWrapper").hide();

				var $dialog = initTemplate("permissionDialogTemplate");
				$dialog.find(".okDialog").click(function(response) {
					storage.remove("tokenResponses");
					if (inWidget) {
						openUrl("options.html?accessNotGranted=true#accounts");
					} else {
						bg.oAuthForDevices.openPermissionWindow();
					}
					showLoading();
				});
				$dialog.find(".cancelDialog").click(function(response) {
					openUrl("https://jasonsavard.com/wiki/Granting_access?ref=driveChecker");
				});
				
				openDialog($dialog);
				
				setInterval(function() {
					chrome.storage.local.get("tokenResponses", response => {
						if (response && response.tokenResponses && response.tokenResponses.length) {
							location.reload();
						}
					});
				}, seconds(5));
			}
		});
		
		getActiveTab(function(tab) {
			var matches
			if (tab) {
				matches = tab.url.match(/facebook\.com\/events\/(\d*)/i); 
				if (matches) {
					var eventID = matches[1];
					if (eventID) {
						if (chrome.permissions) {
							chrome.permissions.contains({
								origins: [FACEBOOK_PERMISSION_HOST]
							}, function(result) {								
								if (result) {
									fetchAndDisplayEvent("http://www.facebook.com/ical/event.php?eid=" + eventID);
								} else {
									polymerPromise2.then(function() {

										openDialog("fbPermissionOverlayTemplate").then(function(response) {
											if (response == "ok") {
												chrome.permissions.request({
													origins: [FACEBOOK_PERMISSION_HOST]
												}, function(granted) {
													if (granted) {
														location.reload(true);
													} else {
														//$fbPermissionOverlay[0].close();
													}
												});
											} else if (response == "other") {
												openUrl("https://jasonsavard.com/wiki/Adding_Facebook_events_to_Google_Calendar");
											}
										});
									});
								}
							});
						}
					}
				} else if (tab.url.match("evite.com")) {
					var eventID = getUrlValue(tab.url, "gid");
					if (eventID) {
						fetchAndDisplayEvent("http://new.evite.com/services/guests/" + eventID + "/export/ical");
					}
				}
			}
		});
		
		$(".share-button").one("click", function() {
			//var $shareMenu = initTemplate("shareMenuTemplate");
			
			$("#share-menu paper-item").click(function() {
				var value = $(this).attr("id");
				sendGA('shareMenu', value);
				
				var urlToShare = "https://jasonsavard.com/Checker-Plus-for-Google-Calendar";
				var imageToShare = "https://jasonsavard.com/images/extensions/mediumCheckerPlusForGoogleCalendar.png";
				
				if (value == "googleplus") {
					openWindowInCenter("https://plus.google.com/share?url=" + encodeURIComponent(urlToShare), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 760);
				} else if (value == "facebook") {
					//openWindowInCenter("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(urlToShare), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 500);
					openWindowInCenter("https://www.facebook.com/dialog/share?app_id=166335723380890&display=popup&href=" + encodeURIComponent(urlToShare) + "&redirect_uri=" + encodeURIComponent("https://jasonsavard.com/tools/closePopup.htm"), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 500);
				} else if (value == "twitter") {
					openWindowInCenter("https://twitter.com/share?url=" + encodeURIComponent(urlToShare) + "&text=" + encodeURIComponent(getMessage("shareIntro") + ": " + getMessage("nameNoTM") + " @jasonsavard"), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 285);
				} else if (value == "pinterest") {
					openWindowInCenter("http://www.pinterest.com/pin/create/button/?url=" + encodeURIComponent(urlToShare) + "&media=" + encodeURIComponent(imageToShare) + "&description=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 750, 350);
				} else if (value == "tumblr") {
					openWindowInCenter("http://www.tumblr.com/share/link?url=" + encodeURIComponent(urlToShare) + "&name=" + encodeURIComponent(getMessage("nameNoTM")) + "&description=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 600);
				} else if (value == "linkedin") {
					openWindowInCenter("http://www.linkedin.com/shareArticle?mini=true&url=" + encodeURIComponent(urlToShare) + "&title=" + encodeURIComponent(getMessage("nameNoTM")) + "&summary=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 600, 540);
				} else if (value == "reddit") {
					openWindowInCenter("http://www.reddit.com/submit?url=" + encodeURIComponent(urlToShare) + "&title=" + encodeURIComponent(getMessage("nameNoTM")) + "&summary=" + encodeURIComponent(getMessage("description")), '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 900, 750);
				}
			});
		});
		
		$("#quickAddGoBack").click(function() {
			$("html").removeClass("quickAddVisible");
		});

		$("#quickAdd")
			.keypress(function(e) {
				$("#quickAddWrapper").addClass("inputEntered");
				
				// enter pressed
				if (e.which == 13) {
					console.log("13", e);
					saveQuickAdd();
				}
			})
			.on("paste", function() {
				$("#quickAddWrapper").addClass("inputEntered");
			})
			.blur(function(e) {
				var $quickAddWrapper = $(e.relatedTarget).closest("#quickAddWrapper");
				if ($quickAddWrapper.length || $("#quickAdd").val()) {
					// do nothing
				} else {
					$("html").removeClass("quickAddVisible");
				}
			})
		;
		
		$("#grantFacebookPermission").click(function() {
			chrome.permissions.request({
				origins: [FACEBOOK_PERMISSION_HOST]
			}, function(granted) {
				if (granted) {
					location.reload(true);
				} else {
					$("#eventWrapper").hide();
				}
			});
		});

		if (notificationsOpened.length) {
			$("#pendingNotifications").css("display", "inline-block");
		}
		
		$("#pendingNotifications").click(function() {
			openReminders().then(() => {
				closeWindow();
			});
		});
		
		if (shouldShowReducedDonationMsg(true)) {
			$("#newsNotificationReducedDonationMessage").show();
			$("#newsNotification")
				.removeAttr("hidden")
				.click(function() {
					openUrl("donate.html?ref=reducedDonationFromPopup");
				})
			;
		} else if (!storage.get("tryMyOtherExtensionsClicked") && daysElapsedSinceFirstInstalled() > 3) { // previous prefs: writeAboutMeClicked, tryMyOtherExtensionsClicked
			isGmailCheckerInstalled(function(installed) {
				if (!installed) {
					$("#newsNotificationGmailAdMessage").show();
					$("#newsNotification")
						.removeAttr("hidden")
						.click(function() {
							storage.enable("tryMyOtherExtensionsClicked");
							openUrl("https://jasonsavard.com/Checker-Plus-for-Gmail?ref=calpopup2");
						})
					;
				}
			});
		}
		
		
		$("#mainOptions").one("click", function() {
			var $optionsMenu = $("#options-menu");
			
			initOptionsMenu();
			
			$("#viewAgenda").click(function() {
				changeCalendarView(CalendarView.AGENDA);
			});
			$("#viewDay").click(function() {
				changeCalendarView(CalendarView.DAY);
			});
			$("#viewWeek").click(function() {
				changeCalendarView(CalendarView.WEEK);
			});
			$("#viewMonth").click(function() {
				changeCalendarView(CalendarView.MONTH);
			});
			
			$("#viewXWeeksLabel").text(getMessage("Xweeks", storage.get("customView")));
			
			$("#view4Weeks").click(function() {
				changeCalendarView(CalendarView.FOUR_WEEKS);
			});
						
			/*
			$optionsMenu.find(".options").click(function() {
				openOptions();
			});
			*/

			$optionsMenu.find(".popout").click(function() {
				popout();
			});

			$optionsMenu.find(".changelog").click(function() {
				openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog?ref=CalendarCheckerOptionsMenu");
			});

			/*
			$optionsMenu.find(".contribute").click(function() {
				openContribute();
			});
			*/

			$optionsMenu.find(".discoverMyApps").click(function() {
				openUrl("https://jasonsavard.com?ref=CalendarCheckerOptionsMenu");
			});

			$optionsMenu.find(".feedback").click(function() {
				openUrl("https://jasonsavard.com/forum/categories/checker-plus-for-google-calendar-feedback?ref=CalendarCheckerOptionsMenu");
			});

			$optionsMenu.find(".followMe").click(function() {
				openUrl("https://jasonsavard.com/?followMe=true&ref=CalendarCheckerOptionsMenu");
			});

			$optionsMenu.find(".aboutMe").click(function() {
				openUrl("https://jasonsavard.com/bio?ref=CalendarCheckerOptionsMenu");
			});

			/*
			$optionsMenu.find(".help").click(function() {
				openHelp();
			});
			*/

		});

		$("#bigAddEventButton").click(function() {
			
			initQuickAdd();

			var elem = document.querySelector("#quickAdd");
			var player = elem.animate([
		       {opacity: "0.5", transform: "scale(1.2)"},
		       {opacity: "1.0", transform: "scale(1)"}
		     ], {
		       duration: 200
		     });

		});
		
		$("#save").click(function() {
			saveQuickAdd();
		});
		
		$("#maximize").click(function(e) {
			if (isCtrlPressed(e)) {
				openWindowInCenter("popup.html", '', 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes', 800, 600);
				closeWindow();
			} else {
				openGoogleCalendarWebsite();
			}
			return false;
		});
		
		var fetchingAgendaEvents;
		
		$("[main]").on("content-scroll", function(e) {
			
			// ignore this scroll event cause it was initiated automatically by scrollIntoView
			if (window.autoScrollIntoView || $("html").hasClass("searchInputVisible")) {
				return;
			}
			
			// patch: jquery event was always returning 0 for scrollTop so must get originalevent from polymer which exposes .detail
			var target = e.originalEvent.detail.target;
			if (getCalendarView() == CalendarView.AGENDA) {
				
				if (target.scrollTop == 0) {
					var firstAgendaDayDate = $("#agendaEvents").find(".agendaDay").data();
					if (firstAgendaDayDate && firstAgendaDayDate.event) {
						displayAgendaHeaderDetails(firstAgendaDayDate.event.startTime);
					}
				}
				
				var BEFORE_END_Y_BUFFER = 800;
				
				// scrolling down
				if (target.scrollTop && target.scrollTop > target.scrollHeight - BEFORE_END_Y_BUFFER) {
					if (!fetchingAgendaEvents) {
						fetchingAgendaEvents = true;
						
						var $agendaEvents = $("#agendaEvents");
						var data = $agendaEvents.data();
						
						console.log("data", data);
						
						if (data.events.length) {
							var start = data.events.last().startTime.addDays(1);
							var end = data.events.last().startTime.addDays(31);
							fetchAgendaEvents({start:start, end:end, append:true}).then(function() {
								fetchingAgendaEvents = false;
							});
						} else {
							fetchingAgendaEvents = false;
						}
					}
				} else if (target.scrollTop && target.scrollTop < BEFORE_END_Y_BUFFER) {
					console.log("scroll up");
					if (!fetchingAgendaEvents) {
						fetchingAgendaEvents = true;
						
						var $agendaEvents = $("#agendaEvents");
						var data = $agendaEvents.data();
						
						console.log("data", data);
						
						if (data.events.length) {
							var start = data.events.first().startTime.addDays(-31);
							var end = data.events.first().startTime;
							fetchAgendaEvents({start:start, end:end, prepend:true}).then(function() {
								fetchingAgendaEvents = false;
							});
						} else {
							fetchingAgendaEvents = false;
						}
					}
				}
				
			}
		});
		
		var WHEEL_THRESHOLD = 100;
		
		$("body")
			.keypress(function(e) {
				if (!isFocusOnInputElement()) {
					console.log("keypress", e);
					initQuickAdd();
					// patch because sometimes when the keypress happens to quickly while the popup/polymer is loading it would not be communicated to the input tag
					$("#quickAdd").val( $("#quickAdd").val() + String.fromCharCode(e.keyCode) );
					return false;
				}
			})
			.on("wheel", function(e) {
				if (getCalendarView() == CalendarView.MONTH || getCalendarView() == CalendarView.FOUR_WEEKS) {
					if (!isFocusOnInputElement() && !$(e.originalEvent.toElement).hasVerticalScrollbar() && !$(e.originalEvent.toElement).hasHorizontalScrollbar()) {
						console.log("wheel", e);
						if (e.originalEvent.deltaX <= -WHEEL_THRESHOLD || e.originalEvent.deltaY <= -WHEEL_THRESHOLD) {
							$("#betaCalendar").fullCalendar("prev");
						} else if (e.originalEvent.deltaX >= WHEEL_THRESHOLD || e.originalEvent.deltaY >= WHEEL_THRESHOLD) {
							$("#betaCalendar").fullCalendar("next");
						}
					}
				}
			})
		;
	});
}

init();