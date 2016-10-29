// Copyright 2016 Jason Savard

var localeMessages;
var RED = [208, 0, 24, 255];
var BLUE = [0, 24, 208, 255];
var GRAY = [150, 150, 150, 255];

var CHECK_EVENTS_INTERVAL = seconds(60);
var MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH = 7;
var lastPollTime = 0;
var lastCheckEventsTime = 0;

// Clear this info
var cachedFeeds = {};
var events = [];

var notificationWindow; // handler for single window like text or html
var notificationsOpened = []; // notifications wrapper objects for each event that is displayed in a notification (not necessarily notification handlers - because of grouped notifications option)
var notificationsQueue = [];
var lastNotificationShownDate = new Date();
var lastExtensionUpdateNotificationShownDate = new Date(1);
var eventsShown = [];
var loggedOut = true;
var email;

var lastBadgeIcon;
var menuIDs = [];
var contextMenuLastUpdated;
var drawAttentionDate = new Date(1);
var lastWindowOnFocusDate = new Date();
var lastWindowOnFocusID;
var notificationAudio;
var lastNotificationAudioSource;
var pokerListenerLastPokeTime = new Date(1);
var oAuthForDevices;
var primaryCalendar;
var signedInEmails = [];
var lastBadgeDate = new Date();
var GROUPED_NOTIFICATION_ID = "GROUPED_NOTIFICATION";
var remindersWindow;
var remindersWindowClosedByDismissingEvents;
var forgottenReminderAnimation;
var remindersWindowParams;
var MENU_ITEM_CONTEXTS = ["page", "frame", "selection", "link", "editable", "image", "video", "audio"];
var DND_displayed = false;
var uninstallEmail;
var eventsIgnoredDueToCalendarReminderChangeByUser;

var storage = new ChromeStorage(STORAGE_DEFAULTS, STORAGE_ITEMS_TO_COMPRESS);
var storagePromise = storage.load();

// wakeup from sleep callback
var detectSleepMode = new DetectSleepMode(function() {
	updateContextMenuItems();
});

var IDLE_DETECTION_INTERVAL = 120; // in seconds
var notificationsOpenedCountWhenIdle;

ChromeTTS();
Controller();

function formatTimeForBadge(date) {
	var formattedTime = date.formatTime(true);
	if (formattedTime.length > 5) {
		formattedTime = formattedTime.replace("am", "").replace("pm", "");
	}
	
	if (storage.get("hideColonInTime")) {
		if (formattedTime.length >= 4) {
			formattedTime = formattedTime.replace(":", "");
		}
	}
	
	return formattedTime;
}

function initPopup() {
	if (storage.get("browserButtonAction") == BrowserButtonAction.CHECKER_PLUS_TAB) {
		chrome.browserAction.setPopup({popup:""});
	} else if (storage.get("browserButtonAction") == BrowserButtonAction.GOOGLE_CALENDAR) {
		chrome.browserAction.setPopup({popup:""});
	} else {
		chrome.browserAction.setPopup({popup:"popup.html?source=toolbar"});
	}
}

function setOmniboxSuggestion(text, suggest) {
	//var tom = /^tom:/.test(text);
	// must be same regex as other references...
	var tom = new RegExp("^" + getMessage("tom") + ":").test(text);
	var plainText = text && text.length && !tom;
	var desc = "<match><url>cal</url></match> ";
	desc += plainText ? ('<match>' + text + '</match>') : getMessage("omniboxDefault");
	desc += "<dim> " + getMessage("or") + " </dim>";
	desc += tom ? ('<match>' + text + '</match>') : getMessage("tom") + ":" + getMessage("omniboxDefaultTom");
	if (chrome.omnibox) {
		chrome.omnibox.setDefaultSuggestion({
			description: desc
		});
	}
}

function fetchCalendarSettings(params) {
	return new Promise((resolve, reject) => {
		params = initUndefinedObject(params);
		
		var calendarSettings = storage.get("calendarSettings");
		if (params.grantingAccess || params.bypassCache || calendarSettings.email != params.email) {
			console.log("Fetching setttings")	
			oAuthForDevices.send({userEmail:params.email, url: "/users/me/settings", roundtripArg:params.email}).then(response => {
				var settings = response.data.items;
				
				calendarSettings.email = params.email;
				calendarSettings.calendarLocale = getSetting(settings, "locale", "en");
				calendarSettings.showDeclinedEvents = getSetting(settings, "showDeclinedEvents", true);
				calendarSettings.hideWeekends = getSetting(settings, "hideWeekends");
				calendarSettings.weekStart = getSetting(settings, "weekStart", 0);
				calendarSettings.timeZone = getSetting(settings, "timezone", "America/Montreal");
				calendarSettings.format24HourTime = getSetting(settings, "format24HourTime", false);
				calendarSettings.dateFieldOrder = getSetting(settings, "dateFieldOrder");
				calendarSettings.defaultEventLength = getSetting(settings, "defaultEventLength");
				
				// sync "my" 24 hour format extension option from calendar setting
				if (storage.get("24hourMode") == undefined && calendarSettings.format24HourTime) {
					storage.enable("24hourMode");
				}
				
				storage.set("calendarSettings", calendarSettings);
				resolve(response);
			}).catch(error => {
				logError("error fetching calendar in settings: " + error);
				reject(error);
			});
		} else {
			console.log("Fetching setttings [CACHE]");
			resolve();
		}
	});
}

function fetchColors(params) {
	return new Promise((resolve, reject) => {
		params = initUndefinedObject(params);

		if (params.bypassCache != true && cachedFeeds.colors && feedUpdatedWithinTheseDays(cachedFeeds.colors, 30) && cachedFeeds.colors.email == params.email) {
			console.log("Fetching colors... [CACHE]");
			resolve();
		} else {
			console.log("Fetching colors...")
			oAuthForDevices.send({userEmail:params.email, url: "/colors"}).then(response => {
				// adding my custom additional attribute
				response.data.CPlastFetched = new Date();
				cachedFeeds.colors = response.data;
				cachedFeeds.colors.email = params.email;
				resolve(response);
			}).catch(error => {
				reject(error);
			});
		}
	});
}

function shortcutNotApplicableAtThisTime(title) {
	var body = "Click here to remove this shortcut.";
	var notif = new Notification(title, {body:body, icon:"/images/icons/icon-48.png"});
	notif.onclick = function() {
		openUrl("https://jasonsavard.com/wiki/Keyboard_shortcuts");
		this.close();
	}
}

function closeNotifications(notifications, params) { // lastAction, skipNotificationClear
	params = initUndefinedObject(params);
	
	updateNotificationEventsShown(notifications, eventsShown, params.lastAction);
	
	var notificationsCloned = notifications.shallowClone(); // because sometimes the notificationsOpened is passed in as notifications and when looping inside the next loop we modify the notificationsOpened which creates sync issues 
	
	console.log("notificationsCloned length: " + notificationsCloned.length)
	console.log("notificationsCloned: ", notificationsCloned)
	$.each(notificationsCloned, function(index, notification) {
		// remove from queue
		for (var a=0; a<notificationsQueue.length; a++) {
			if (isSameEvent(notificationsQueue[a].event, notification.event)) {				
				console.log("removed from queue: " + notification.event.summary);
				notificationsQueue.splice(a, 1);
				a--;
				break;
			}
		}

		// remove from array of opened notifs
		console.log("notificationsOpened length: " + notificationsOpened.length)
		for (var a=0; a<notificationsOpened.length; a++) {
			console.log("notificationsOpened[a].id: " + notificationsOpened[a].id)
			console.log("notificationsOpened[a]: ", notificationsOpened[a])
			console.log("notification.id: " + notification.id);
			if (notificationsOpened[a].id == notification.id) {
				console.log("removed from opened", notification.id);
				notificationsOpened.splice(a, 1);
				a--;
				break;
			}
		}
	});
	
	if (storage.get("desktopNotification") == "rich" && !params.skipNotificationClear) {
		if (isGroupedNotificationsEnabled()) {
			if (notificationsOpened.length == 0) {
				chrome.notifications.clear(GROUPED_NOTIFICATION_ID, function(wasCleared) {
					// patch to force close the notification by unfocusing the notification window
					// Because the notification.clear is not working when the notification has been retoasted by clicking on the bell in the tray
					if (params.source == "notificationButton") {						
						if (lastNotificationShownDate.diffInSeconds() < -25) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
							openTemporaryWindowToRemoveFocus();
						}
					}
				});
			} else {
				updateNotifications();
			}
		} else {
			$.each(notifications, function(index, notification) {
				chrome.notifications.clear(notification.id, function(wasCleared) {});
			});
		}
	}
}

function closeNotificationsDelayed(notifications) {
	setTimeout(function() {
		closeNotifications(notifications);
	}, 500);
}

function performActionOutsideOfPopupCallback(eventEntry) {
	var title = eventEntry.summary;
	
	var message = formatEventAddedMessage(getMessage("event").toLowerCase(), eventEntry);
	if (!message) {
		message = "";
	}
	
	var options = {
			type: "basic",
			title: title,
			message: message,
			iconUrl: "images/icons/icon-128.png"
	}
	
	if (DetectClient.isChrome()) {
		options.buttons = [{title:"Undo", iconUrl:"images/trash.svg"}];
	}

	// if no title found in the result of the quick add then open the edit page
	if (eventEntry.summary) {
		
		var desktopNotification = storage.get("desktopNotification");
		if (desktopNotification == "text") {
			// text notificaiton
			var omniboxBoxNotification = new Notification(title, {body:message, icon:'images/icons/icon-128.png'});
			omniboxBoxNotification.eventEntry = eventEntry;
			omniboxBoxNotification.onclick = function() {
				var url = getEventUrl(this.eventEntry);
				if (url) {
					openUrl(url, {urlToFind:this.eventEntry.id});
				}
				this.close();
			}
		} else {
			var notification = {id:generateNotificationIdFromEvent(eventEntry, NotificationType.ADDED_OUTSIDE), event:eventEntry};
			chrome.notifications.create(notification.id, options, function(notificationId) {
				// close it after a few seconds
				setTimeout(function() {
					chrome.notifications.clear(notification.id, function(wasCleared) {});
				}, seconds(6));
			});
		}
	} else {
		openUrl(getEventUrl(eventEntry));
	}						
	pollServer();
}

function performActionOutsideOfPopup(eventEntry) {
	return new Promise(function(resolve, reject) {
		var progress = new ProgressNotification();
		progress.show();
		saveEvent(eventEntry).then(response => {
			return new Promise((resolve, reject) => {
				var saveEventResponse = response;
				// if title is small, empty or just useless than try getting the page details to fill the title
				var shortestTitleLength = 3;
				if (/zh|ja|ko/i.test(storage.get("calendarSettings").calendarLocale)) {
					shortestTitleLength = 1;
				}
				if (eventEntry.fromContextMenu && $.trim(eventEntry.summary).length <= shortestTitleLength) {
					getActiveTab(function(tab) {
						getEventDetailsFromPage(tab, function(response) {
							eventEntry.summary = response.title;
							eventEntry.description = response.description;
							
							var patchFields = {};
							patchFields.summary = response.title;
							patchFields.description = response.description;
							
							updateEvent({eventEntry:eventEntry, event:saveEventResponse.data, patchFields:patchFields}).then(function(response) {
								resolve();
							}).catch(function(error) {
								reject(error);
							});
						});
					});
				} else {
					resolve();
				}
			});
		}).then(response => {
			progress.cancel();
			performActionOutsideOfPopupCallback(eventEntry);
			resolve();
		}).catch(error => {
			progress.cancel();
			showMessageNotification("Error with last action", "Try using the quick add from the popup!", error);
			reject(error);
		});
	});
}

function retoastNotifications() {
	console.log("retoast " + new Date());
	updateNotifications({retoast:true})
}

function updateNotifications(params) {
	if (!params) {
		params = {};
	}
	
	if (notificationsOpened.length) {
		
		sortNotifications(notificationsOpened);
		
		if (isGroupedNotificationsEnabled()) {
			// grouped
			var notificationsOpenedForDisplay = notificationsOpened.shallowClone();
			//notificationsOpenedForDisplay.reverse();
			var options = generateNotificationOptions(notificationsOpenedForDisplay);
			if (params.retoast) {
				chrome.notifications.clear(GROUPED_NOTIFICATION_ID, function(wasCleared) {
					chrome.notifications.create(GROUPED_NOTIFICATION_ID, options, function(notificationId) {
						if (chrome.runtime.lastError) {
							logError("update create notif: " + chrome.runtime.lastError.message);
						} else {
							lastNotificationShownDate = new Date();
						}
					});
				});
			} else {
				chrome.notifications.update(GROUPED_NOTIFICATION_ID, options, function(wasUpdated) {});
			}
		} else {
			// dont retoast individual notifs
			if (!params.retoast) {
				// individual
				$.each(notificationsOpened, function(index, notification) {
					var options = generateNotificationOptions([notification]);
					// note: chrome.notifications.update calls the notification.onClosed
					chrome.notifications.update(notification.id, options, function(wasUpdated) {});
				});
			}
		}
	}
}

function menuItemOnClick(info, tab) {
	console.log("menuItemOnClick", info, tab);
	
	var params = menuIDs[info.menuItemId];
	if (params.template) {
		if (info.selectionText) {
	    	var actionLinkObj = generateActionLink("TEMPLATE", {summary:info.selectionText, startTime:new Date(), allDay:true});
	    	chrome.tabs.create({url: actionLinkObj.url + "?" + actionLinkObj.data});
		} else {
			// page selected
			getEventDetailsFromPage(tab, function(response) {
		    	var actionLinkObj = generateActionLink("TEMPLATE", {summary:response.title, description:response.description, startTime:new Date(), allDay:true});
		    	chrome.tabs.create({url: actionLinkObj.url + "?" + actionLinkObj.data});
			});
		}
		
		// let's sync in this event after we left the user a good amount of time to save the event on the page
		setTimeout(function() {
			pollServer({source:"afterRightClickSetDate..."});
		}, seconds(30));
	} else {
		var eventEntry = new EventEntry();
		eventEntry.fromContextMenu = true;
		
		if (!params.quickAdd) {
			eventEntry.startTime = new Date(params.date.getTime());
			eventEntry.quickAdd = false;
		}
		eventEntry.allDay = params.allDay;  
		
		getEventDetailsFromPage(tab, function(response) {
			if (info.selectionText) {
				// Text selected
				eventEntry.summary = info.selectionText;
				performActionOutsideOfPopup(eventEntry);
			} else if (info.linkUrl) {
				console.log("linkurl details", response);
				var title = prompt("Enter a title for this link", response.title);
				if (title) {
					eventEntry.summary = title;
					eventEntry.source = {title:title, url:info.linkUrl};
					eventEntry.description = info.linkUrl;
					performActionOutsideOfPopup(eventEntry);
				}
			} else {
				eventEntry.extendedProperties = {};
				eventEntry.extendedProperties.private = {favIconUrl:tab.favIconUrl};
				
				eventEntry.summary = response.title;
		    	if (!params.quickAdd) {
		    		eventEntry.description = response.description;
		    	}
		    	
		    	// possibly found url in microformat so use it instead
		    	if (response.url) {
		    		eventEntry.source = {title:response.title, url:response.url};
		    	} else if (tab && tab.url) {
		    		eventEntry.source = {title:response.title, url:tab.url};
		    	}
		    	performActionOutsideOfPopup(eventEntry);
			}
		});
	}	
		
	var gaAction;
	if (info.selectionText) {
		gaAction = "selectedText";
	} else {
		gaAction = "rightClickOnPage";
	}
	sendGA('contextMenu', gaAction, getHost(tab.url));
}

function setMenuItemTimes(parentId, startTime) {
	var offsetTime = new Date(startTime); 
	for (var a=0; a<48 && offsetTime.getHours() <= 23 && offsetTime.getMinutes() <= 30 && offsetTime.diffInDays(startTime) == 0; offsetTime.setMinutes(offsetTime.getMinutes()+30), a++) {		
		var timeStr;
		if (storage.get("24hourMode")) {
			timeStr = offsetTime.format("HH:MM");
		} else {
			timeStr = offsetTime.format("h:MM tt");
		}
		menuID = chrome.contextMenus.create({title: timeStr, contexts: MENU_ITEM_CONTEXTS, parentId: parentId, onclick: menuItemOnClick});
		menuIDs[menuID] = {date:new Date(offsetTime)}; // MUST instantiate a new date
	}
}

function updateContextMenuItems() {
	if (storage.get("showContextMenuItem")) {
		console.log("addchange conextmenu: " + new Date())
		addChangeContextMenuItems();
		contextMenuLastUpdated = new Date();
	}
}

function addChangeContextMenuItems() {
	var menuID;
	menuIDs = [];
	
	// remove past menu items first
	if (chrome.contextMenus && chrome.contextMenus.removeAll) {
		chrome.contextMenus.removeAll(function() {
			
			// View full calendar
			chrome.contextMenus.create({title: getMessage("openCalendar"), contexts: ["browser_action"], onclick:function() {
				openGoogleCalendarWebsite();
			}});
			chrome.contextMenus.create({title: getMessage("refresh"), contexts: ["browser_action"], onclick:function() {
				pollServer({source:"refresh"});
			}});
			
			chrome.contextMenus.create({contexts: ["browser_action"], type:"separator"});
			
			// DND menus
			var doNotDisturbMenuId = chrome.contextMenus.create({title: getMessage("doNotDisturb"), contexts: ["browser_action"]});
			chrome.contextMenus.create({title: getMessage("turnOff"), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_off();
			}});
			
			chrome.contextMenus.create({contexts: ["browser_action"], parentId:doNotDisturbMenuId, type:"separator"});
			
			chrome.contextMenus.create({title: getMessage("Xminutes", 30), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_minutes(30);
			}});
			chrome.contextMenus.create({title: getMessage("Xhour", 1), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_minutes(60);
			}});
			chrome.contextMenus.create({title: getMessage("Xhours", 2), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_minutes(120);
			}});
			chrome.contextMenus.create({title: getMessage("Xhours", 4), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_minutes(240);
			}});
			chrome.contextMenus.create({title: getMessage("today"), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_today();
			}});
			//chrome.contextMenus.create({title: getMessage("schedule") + "...", contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				//openDNDScheduleOptions();
			//}});
			chrome.contextMenus.create({title: getMessage("indefinitely"), contexts: ["browser_action"], parentId:doNotDisturbMenuId, onclick:function() {
				setDND_indefinitely();
			}});

			
			// quick add menus
			
			// If a selection then add this before the other menu items
			menuID = chrome.contextMenus.create({title: getMessage("quickAdd") + "  '%s'", contexts: ["selection"], onclick: menuItemOnClick});
			menuIDs[menuID] = {quickAdd:true, allDay:true};
			
			chrome.contextMenus.create({contexts: MENU_ITEM_CONTEXTS, type:"separator"});
			
			// Today all day
			menuID = chrome.contextMenus.create({title: getMessage("today"), contexts: MENU_ITEM_CONTEXTS, onclick: menuItemOnClick});
			menuIDs[menuID] = {date:new Date(), allDay:true};
			
			// Today times...
			var offsetTime = new Date();
			if (offsetTime.getMinutes() <= 29) {
				offsetTime.setMinutes(30)
			} else {
				offsetTime.setHours(offsetTime.getHours()+1);
				offsetTime.setMinutes(0);
			}
			offsetTime.setSeconds(0, 0);
			
			if (offsetTime.getHours() <= 23 && offsetTime.getMinutes() <= 30) {
				menuID = chrome.contextMenus.create({title: getMessage("todayAt"), contexts: MENU_ITEM_CONTEXTS});
				setMenuItemTimes(menuID, offsetTime);
			}
			
			chrome.contextMenus.create({contexts: MENU_ITEM_CONTEXTS, type:"separator"});
			
			// Tomorrow
			menuID = chrome.contextMenus.create({title: getMessage("tomorrow"), contexts: MENU_ITEM_CONTEXTS, onclick: menuItemOnClick});
			menuIDs[menuID] = {date:tomorrow(), allDay:true}; // MUST instantiate a new date
			
			// Tomorrow times...
			menuID = chrome.contextMenus.create({title: getMessage("tomorrowAt"), contexts: MENU_ITEM_CONTEXTS});
			offsetTime = tomorrow();
			offsetTime.setHours(1);
			offsetTime.setMinutes(0);
			offsetTime.setSeconds(0, 0);
			setMenuItemTimes(menuID, offsetTime);
			
			// Days of week
			offsetTime = tomorrow();
			for (var a=2; a<=7; a++) {
				chrome.contextMenus.create({contexts: MENU_ITEM_CONTEXTS, type:"separator"});
				
				offsetTime.setDate(offsetTime.getDate()+1);
				menuID = chrome.contextMenus.create({title: dateFormat.i18n.dayNames[offsetTime.getDay()], contexts: MENU_ITEM_CONTEXTS, onclick: menuItemOnClick});
				var offsetDate = new Date(offsetTime);
				menuIDs[menuID] = {date:offsetDate, allDay:true}; // MUST instantiate a new date
				
				menuID = chrome.contextMenus.create({title: getMessage("somedayAt", dateFormat.i18n.dayNames[offsetTime.getDay()]), contexts: MENU_ITEM_CONTEXTS});
				offsetDate.setHours(1);
				offsetDate.setMinutes(0);
				offsetTime.setSeconds(0, 0);
				setMenuItemTimes(menuID, offsetDate);
			}
			
			chrome.contextMenus.create({contexts: MENU_ITEM_CONTEXTS, type:"separator"});
			
			// Other date
			menuID = chrome.contextMenus.create({title: getMessage("setDateTime") + "...", contexts: MENU_ITEM_CONTEXTS, onclick: menuItemOnClick});
			menuIDs[menuID] = {template:true};
			
		});
	}
}

function playNotificationSoundFile(source, reminder, callback) {
	return new Promise(function(resolve, reject) {
		if (!notificationAudio) {
			notificationAudio = new Audio();
		}
		
		var audioEventTriggered = false;
		
		if (isDND() || source == null || source == "") {
			resolve();
		} else  {
			
			var changedSrc = lastNotificationAudioSource != source;
			
			// patch for ogg might be crashing extension
			// patch linux refer to mykhi@mykhi.org
			if (DetectClient.isLinux() || changedSrc) {
				if (source == "custom") {
					notificationAudio.src = storage.get("notificationSoundCustom");
				} else {
					notificationAudio.src = "sounds/" + source;
				}
				
			}
			lastNotificationAudioSource = source;
			
			var volume = storage.get("notificationSoundVolume");
		   
			// if reminder than lower the volume by 50%
			if (reminder) {
				volume = volume * 0.75;
			}
		   
			$(notificationAudio).off().on("ended abort error", function(e) {
				// ignore the abort event when we change the .src
				if (!(changedSrc && e.type == "abort") && !audioEventTriggered) {
					audioEventTriggered = true;
					resolve();
				}
			});
			
			notificationAudio.volume = volume / 100;		   
			notificationAudio.play();
		}
	});
}

function playVoiceNotification(textToSpeak) {
	if (storage.get("notificationVoice") && !isDND()) {
		if (storage.get("voiceNotificationOnlyIfIdleInterval")) {
			chrome.idle.queryState(parseInt(storage.get("voiceNotificationOnlyIfIdleInterval")), function(state) {
				// check if idle rules
				if (state != "active" && !detectSleepMode.isWakingFromSleepMode()) {
					if (storage.get("notificationVoice").indexOf("Multilingual TTS Engine") != -1 && !isOnline()) {
						// fetch default machine voice by passing false as 2nd parameter to getDefaultVoice
						chrome.tts.getVoices(function(voices) {
							var voiceIndexMatched = getDefaultVoice(voices, false);
							if (voiceIndexMatched != -1) {
								var voice = voices[voiceIndexMatched];
								ChromeTTS.queue(textToSpeak, voice);
							}
						});
					} else {
						ChromeTTS.queue(textToSpeak);
					}
				}
			});
		} else {
			ChromeTTS.queue(textToSpeak);
		}
	}
}

function playNotificationSound(notification) {
	
	if (!isDND()) {
		var textToSpeak;
		textToSpeak = notification.event.summary;
		
		if (notification.audioPlayedCount) {
			notification.audioPlayedCount++;
		} else {
			notification.audioPlayedCount = 1;
		}
		if (storage.get("notificationSound")) {
			playNotificationSoundFile(storage.get("notificationSound"), false).then(() => {
				playVoiceNotification(textToSpeak);
			});
		} else {
			playVoiceNotification(textToSpeak);
		}
	}
	
}

function showLoggedOut() {
	chrome.browserAction.setBadgeBackgroundColor({color:GRAY});
	chrome.browserAction.setBadgeText({text : "X"});
	chrome.browserAction.setTitle({title : getMessage("notLoggedIn")});
}

function getStartDateOfPastEvents() {
	return new Date(Date.now()-(ONE_DAY*4));
}

function getStartDateBeforeThisMonth() {
	var date = new Date();
	date.setDate(1);
	date.setHours(1);
	date.setMinutes(1);
	date.setDate(date.getDate()-MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH);
	return date; 
}

// usage: params.badgeText = undefined (don't change anything) badgeText = "" then remove badgeText etc...
function updateBadge(params) {
	if (!params) {
		params = {};
	}

	var badgeIcon = storage.get("badgeIcon");
	var state = isOnline() ? "" : "_offline";
	var imageSrc = getBadgeIconUrl(state);
	
	if (isDND()) {
		DND_displayed = true;
		params.badgeText = getMessage("DND");
		params.badgeColor = [0,0,0, 255];
		chrome.browserAction.setTitle({ title: getMessage("doNotDisturb") });
	} else {
		// Should probably force the checkEvents() to restore counter, but I opted to let the interval call it so as to not cause double checkevents calling possible issues
		if (DND_displayed) {
			params.badgeText = "";
		}
		DND_displayed = false;
		
		if (storage.get("showButtonTooltip") && params.toolTip) {
			chrome.browserAction.setTitle({title:params.toolTip});
		} else {
			chrome.browserAction.setTitle({title:""});
		}
	}

	if (params.badgeColor) {
		chrome.browserAction.setBadgeBackgroundColor({color:params.badgeColor});
	}
	
	chrome.browserAction.getBadgeText({}, function(previousBadgeText) {
		var badgeTextVisibilityToggled = false;
		if ((params.forceRefresh && params.badgeText) || (params.badgeText != undefined && params.badgeText != previousBadgeText)) {
			badgeTextVisibilityToggled = true;
			chrome.browserAction.setBadgeText({text:params.badgeText});
		}
		
		// if icon changed from last time or badgeTextVisibilityToggled then update it icon
		if (params.forceRefresh || imageSrc != lastBadgeIcon || badgeTextVisibilityToggled || !lastBadgeDate.isToday()) {
			var image = new Image();
			image.src = imageSrc;
			image.onload = function() {
				var badgeIconCanvas = document.getElementById('badgeIconCanvas');
				// the onload loads again after changing badeicon and document.body is empty, weird, so check for canvas
				if (badgeIconCanvas) {
					badgeIconCanvas.width = image.width;
					badgeIconCanvas.height = image.height;
					context = badgeIconCanvas.getContext('2d');
					context.drawImage(image, 0, 0);
					
					if (badgeIcon.indexOf("WithDate") != -1) {
						//context.font = 'bold 11px "helvetica", sans-serif';
						//context.font = "20px Times New Roman";
						//context.shadowOffsetX = 1;
						//context.shadowOffsetY = 1;
						//context.shadowBlur = 1;
						//context.shadowColor = "rgba(0, 0, 0, 0.2)";

						var heightOffset;

						if (badgeIcon == "default3WithDate" || badgeIcon == "default_monochromeWithDate") {
							heightOffset = 15;
							context.font = 'normal 11px "arial", sans-serif';
							context.fillStyle = '#FFF'
						} else if (badgeIcon == "newWithDate" || badgeIcon == "new2WithDate") {
							heightOffset = 13;
							context.font = 'bold 12px "arial", sans-serif';
							context.fillStyle = '#FFF'
						} else {
							heightOffset = 13;
							context.font = 'bold 10px "arial", sans-serif';
							context.fillStyle = "#333"
						}
						context.textAlign = "center";
						var day = (new Date).getDate();
						
						var hasBadgeText = false;
						if (params.badgeText == undefined) {
							if (previousBadgeText) {
								hasBadgeText = true;
							}
						} else {
							if (params.badgeText) {
								hasBadgeText = true;
							}
						}						
						
						if (hasBadgeText) {
							heightOffset -= 2;
						}
							
						context.fillText(day, (badgeIconCanvas.width / 2) - 0, heightOffset);
						lastBadgeDate = new Date();
					}
					chrome.browserAction.setIcon({imageData: context.getImageData(0, 0, 19, 19)});
				}
			}
		}
		lastBadgeIcon = imageSrc;
	});
	
}

function getNodeValue(elements, key, defaultValue) {
	var value = null;
	if (elements) {
		$.each(elements, function(a, element) {
			if (element.getAttribute("name") == key) {
				value = element.getAttribute("value");
			}
		});
	}
	if (defaultValue == undefined) {
		defaultValue = false;
	}
	return value == null ? defaultValue : toBool(value);
}

function getSetting(settings, key, defaultValue) {
	var value = null;
	if (settings) {
		$.each(settings, function(a, setting) {
			if (setting.id == key) {
				value = setting.value;
				return false;
			}
		});
	}
	if (defaultValue == undefined) {
		defaultValue = false;
	}
	return value == null ? defaultValue : toBool(value);
}

function getSignedInEmails() {
	return new Promise(function(resolve, reject) {
		// look to see if calendar is signed into first
		getDefaultSignedInCalendarEmail().then(function(email) {
			if (email) {
				resolve([email]);
			} else {
				// not signed into calendar, but maybe they are signed into their gmail
				getSignedInGmailEmails({}, function(params) {
					if (params.error) {
						resolve();
					} else {
						console.log("gmail emails: ", params.emails);
						resolve(params.emails);
					}
				});
			}
		}).catch(function(error) {
			resolve();
		});
	});
}

function getDefaultSignedInCalendarEmail() {
	return new Promise(function(resolve, reject) {
		chrome.cookies.getAll({domain:"www.google.com", name:"OL_SESSION"}, function (cookies) {
			if (chrome.extension.lastError) {
				// Sometimes happens on chrome/extenion startup: No accessible cookie store found for the current execution context.
				logError("getDefaultSignedInCalendarEmail error: " + chrome.extension.lastError.message);
				resolve();
			} else {
				var email;
				if (cookies) {
					$.each(cookies, function(index, cookie) {
						if (cookie.path == "/calendar") { // the rest are /calendar/b/1 etc.
							email = cookie.value.match(/(.*)-cal/i)[1]; // ie. "test%40gmail.com-cal2"
							try {
								email = unescape(email);
							} catch (e) {
								logError("could not decode email: " + email);
								email = null;
							}
							return false;
						}
					});
				}
				resolve(email);
			}
		});
	});
}

function getSignedInGmailEmails(params, callback) {
	var MAX_ACCOUNTS = 10;
	if (params.accountIndex == undefined) {
		params.accountIndex = 0;
	} else {
		params.accountIndex++;
	}
	if (!params.emails) {
		params.emails = [];
	}
	
	if (params.accountIndex < MAX_ACCOUNTS && isOnline()) {
		console.log("fetch emails for index: " + params.accountIndex);
		$.ajax({
			type: "GET",
			dataType: "text",
			url: "https://mail.google.com/mail/u/" + params.accountIndex + "/feed/atom?timestamp=" + Date.now(),
			timeout: 5000,
			complete: function(jqXHR, textStatus) {
				if (textStatus == "success") {			
					
					var parser = new DOMParser();
				   	parsedFeed = $(parser.parseFromString(jqXHR.responseText, "text/xml"));
				   
				   	var titleNode = parsedFeed.find('title');
				   	if (titleNode.length >= 1) {
					   	var mailTitle = $(titleNode[0]).text().replace("Gmail - ", "");
					   	// patch because <title> tag could contain a label with a '@' that is not an email address ie. Gmail - Label '@test@' for blahblah@gmail.com
					   	var emails = mailTitle.match(/([\S]+@[\S]+)/ig);
					   	if (emails) {
					   		var email = emails.last();
					   		
					   		// if found same email/duplicate then we can exit loop - assuming we found them all
					   		if (params.emails.indexOf(email) != -1) {
					   			console.log("found same email exiting loop");
					   			callback(params);
					   		} else {
					   			params.emails.push(email);
					   			getSignedInGmailEmails(params, callback);
					   		}
					   	} else {
					   		var error = "Could not find email in: " + mailTitle;
					   		logError(error);
					   		callback({error:error});
					   	}
				   	} else {
				   		var error = "Could not find title node from feed: " + jqXHR.responseText;
				   		logError(error);
				   		callback({error:error});
				   	}				
				} else {
					if (jqXHR.status == 401 || textStatus.toLowerCase() == "unauthorized") {
						// finally reached an unauthorized account so should be the end, let's exit recursion
						callback(params);
					} else {						
						// could be timeout so skip this one and keep going
						console.warn("could be timeout so skip this one and keep going: ", textStatus, jqXHR);
						getSignedInGmailEmails(params, callback);
					}
				}
			}
		});
	} else {
		var error = "max accounts reached or not online";
		logError(error);
		callback({error:error});
	}
}

function feedUpdatedToday(feed) {
	if (feed) {
		var lastFetched = new Date(feed.CPlastFetched);
		return lastFetched.isToday();
	}
}

function feedUpdatedWithinTheseDays(feed, days) {
	if (feed) {
		var lastFetched = new Date(feed.CPlastFetched);
		return lastFetched.diffInDays() >= -days;
	}
}

function feedUpdatedWithinTheseHours(feed, hours) {
	if (feed) {
		var lastFetched = new Date(feed.CPlastFetched);
		return lastFetched.diffInHours() >= -hours;
	}
}

function getArrayOfCalendars() {
	if (cachedFeeds["calendarList"]) {
		cachedFeeds["calendarList"].items.sort(function(calendar1, calendar2) {
			if (calendar1.primary) return -1;
			if (calendar2.primary) return 1;
			
			var summary1;
			var summary2;
			
			if (calendar1.summaryOverride) {
				summary1 = calendar1.summaryOverride;
			} else {
				summary1 = calendar1.summary;
			}
			
			if (calendar2.summaryOverride) {
				summary2 = calendar2.summaryOverride;
			} else {
				summary2 = calendar2.summary;
			}

			if (summary1 < summary2) return -1;
		    if (summary1 > summary2) return 1;
		    return 0;
		});
		return cachedFeeds["calendarList"].items;
	} else {
		return [];
	}
}

function fetchCalendarList(params) {
	return new Promise((resolve, reject) => {
		params = initUndefinedObject(params);
		
		var feedFromCache = cachedFeeds.calendarList;
		
		if (params.bypassCache != true && feedFromCache && feedUpdatedToday(feedFromCache) && feedFromCache.email == params.email) {
			console.log("Fetching calendarlist [CACHE]");
			resolve(params);
		} else {
			console.log("Fetching calendarlist");
			oAuthForDevices.send({userEmail:params.email, url: "/users/me/calendarList"}).then(response => {
				response.data.CPlastFetched = new Date();
				cachedFeeds.calendarList = response.data;
				cachedFeeds.calendarList.email = params.email;
				resolve(params);
			}).catch(error => {
				logError("Error fetching feed: ", error);
				if (feedFromCache) {
					console.log("instead we are fetching from cache");
					resolve(params);
				} else {
					reject(error);
				}
			});
		}
	});
}

function processCalendarListFeed(params) {
	return new Promise((resolve, reject) => {
		var calendarList = getArrayOfCalendars();
		var primaryCalendar = getPrimaryCalendar(calendarList);
		calendarList.sort(function(a, b) {
			if (primaryCalendar && a.id == primaryCalendar.id) {
				return -1;
			} else if (primaryCalendar && b.id == primaryCalendar.id) {
				return +1;
			} else if (a.accessRole == "owner") {
				return -1;
			} else if (b.accessRole == "owner") {
				return +1;
			} else if (a.summary.toLowerCase() < b.summary.toLowerCase()) {
				return -1;
			} else {
				return +1;
			}
		});
		resolve();
	}).then(() => {
		return fetchAllCalendarEvents(params).then(response => {
			events = response.events;
			return checkEvents(params);
		});
	}).then(() => {
		setTimeout(function() {
			storage.set("cachedFeeds", cachedFeeds);
		}, seconds(10));
	});
}

function fetchAllCalendarEvents(params) {
	return new Promise((resolve, reject) => {
		var startDate;
		var endDate;
		
		if (params.startDate) { // override defaults if passed here
			startDate = params.startDate;
			endDate = params.endDate;
		} else { // default dates...
			startDate = getStartDateBeforeThisMonth();

			var maxDaysAhead;
			if (storage.get("calendarView") == CalendarView.FOUR_WEEKS) {
				maxDaysAhead = 7 * 4; // 7 days * 4 weeks
			} else {
				// Must pull all events visible in month view so that the drag drop for moving events can locate the event ids
				maxDaysAhead = (31-new Date().getDate()) + MAX_POSSIBLE_DAYS_FROM_NEXT_MONTH;
			}
			// if pref: maxDaysAhead is larger than this than use it instead
			maxDaysAhead = Math.max(maxDaysAhead, parseInt(storage.get("maxDaysAhead"))+1);
			console.log("maxDaysAhead", maxDaysAhead);
			
			endDate = new Date(Date.now()+(ONE_DAY*(maxDaysAhead)));
			// must do this because or else enddate is always seconds off and i use this enddate diff to determine if i should fetch more feeds
			endDate.setHours(23);
			endDate.setMinutes(0);
			endDate.setSeconds(0, 0);
		}
		
		console.log("startdate: " + startDate);
		
		oAuthForDevices.ensureTokenForEmail(params.email).then(() => {
			// nothing
		}).catch(error => {
			// forward on because we want to return cached feeds
		}).then(response => {
			var promises = [];
			var theseEvents = [];
			
			$.each(getArrayOfCalendars(), function(index, calendar) {
				// must clone because .calendar for instance is alway set as the last iterated calendar after looping here
				var moreParams = clone(params);
				
				moreParams.calendar = calendar;
				moreParams.startDate = startDate;
				moreParams.endDate = endDate;
				
				var promise = fetchCalendarEvents(moreParams, storage.get("selectedCalendars"));
				promises.push(promise);		
			});

			// using my custom alwaysPromise which returns all success and failures
			alwaysPromise(promises).then(response => {
				var allResponses = response.successful.concat(response.failures);
				allResponses.forEach(response => {
					// keep going to return cached calendars
					if (response.data && response.data.items) {
						response.data.items.forEach(event => {
							// jason add calendar to event and add defaultreminders to event for reference 
							event.calendar = response.roundtripArg;
							event.calendar.defaultReminders = response.data.defaultReminders;
							initEventObj(event);
						});
						theseEvents = theseEvents.concat(response.data.items);
					}
				});
				
				if (response.successful.length == 0) {
					loggedOut = true;
				} else {
					loggedOut = false;
				}
				
				// Sort
				var allDayVStimeSpecific = storage.get("showTimeSpecificEventsBeforeAllDay") ? -1 : 1;
				theseEvents.sort(function(e1, e2) {
					if (e1.allDay && !e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
						return allDayVStimeSpecific * -1;
					} else if (!e1.allDay && e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
						return allDayVStimeSpecific * +1
					} else {
						var retValue = null;
						try {
							retValue = e1.startTime.getTime() - e2.startTime.getTime();
						} catch (e) {
							logError("time diff error: " + e1 + "_" + e2);
						}
						if (e1.allDay && e2.allDay && e1.startTime.isSameDay(e2.startTime)) {
							// make sure no null summaries "Untitled event"
							if (e1.summary && e2.summary) {
								if (e1.summary.toLowerCase() < e2.summary.toLowerCase()) {
									return -1;
								} else if (e1.summary.toLowerCase() > e2.summary.toLowerCase()) {
									return +1; 
								} else {
									return 0;
								}
							} else {
								return -1;
							}
						} else {
							return retValue;
						}
					}
				});
				
				var returnObj = {events:theseEvents};
				if (response.failures.length) {
					returnObj.error = "Error fetching " + response.failures.length + " calendars";
				}
				
				resolve(returnObj);
			});
		});		
	});
}

function fetchCalendarEvents(params, selectedCalendars) {
	return new Promise((resolve, reject) => {
		var feedFromCache = cachedFeeds[params.calendar.id];
		// simulate fetchEventsObj and pass this "dummy" roundtripArg because it is fetched in .always 
		var fetchEventsObj = {data:feedFromCache, roundtripArg:params.calendar};
	
		if (isCalendarSelectedInExtension(params.calendar, email, selectedCalendars) || (storage.get("desktopNotification") && !isCalendarExcluded(params.calendar) && !isGadgetCalendar(params.calendar))) {
		
			var calendarThatShouldBeCached =
				params.calendar.id.indexOf("holiday.calendar.google.com") != -1 ||
				params.calendar.id.indexOf("import.calendar.google.com") != -1 ||
				params.calendar.id.indexOf("group.v.calendar.google.com") != -1 || // includes Interesting calendars "more" section ie. Contacts's bdays, Day of the year etc.
				params.calendar.id.indexOf("bukmn26vqdvcamgv8fdrs3hhu8@group.calendar.google.com") != -1 // manually excluded because lot of users subscribed to this one according to analytics titled: Anniversaries - owner
				
				// commented out because these are now excluded via the isGadgetCalenadar with the previous call abovee to isCalendarSelectedInExtension
				//params.calendar.id.indexOf("g0k1sv1gsdief8q28kvek83ps4@group.calendar.google.com") != -1 || 	// Week Numbers
				//params.calendar.id.indexOf("ht3jlfaac5lfd6263ulfh4tql8@group.calendar.google.com") != -1 		// Phases of the Moon
		  	;
			
			var expired = false;
			
			if (calendarThatShouldBeCached) {
				expired = !feedUpdatedWithinTheseDays(feedFromCache, 30);
			} else {
				if (isCalendarWriteable(params.calendar)) {
					// see that we are showing notifications for this calendar (high priority) and that this calendar is "active" and that it's been updated at least in the last 30 days
					var isCalendarRecentlyUpdated = !feedFromCache || new Date(feedFromCache.updated).diffInDays() >= -30;
					if (storage.get("desktopNotification") && params.calendar.defaultReminders.length && !isCalendarExcluded(params.calendar) && isCalendarRecentlyUpdated) {
						// do nothing as we should continue to fetch this calendar's events
					} else {
						// let's reduce it's polling a bit to save quota (successfully reduced quota by 20% !)
						calendarThatShouldBeCached = feedUpdatedWithinTheseHours(feedFromCache, 2); // only fetch every 2 hours
					}
				} else {
					// Pushed Feb 8th - reduced quota by about 30% we used to check every hour, now only once a day 
					// for non main calendars (ie. not owner/writer) let's reduce the polling to 1 day (ie. once per day)
					calendarThatShouldBeCached = feedUpdatedWithinTheseDays(feedFromCache, 1);
				}
			}
			
			// one time such as browsing calendar next/prev (let's use cache if possible and NOT override cache with these results)
			var oneTimeFetch = params.source == "popup" || params.source == "agenda" || params.source == "selectedCalendars";
	
			if (params.bypassCache != true && (calendarThatShouldBeCached || oneTimeFetch) && feedFromCache && !expired && params.startDate.isEqualOrAfter(feedFromCache.CPstartDate) && params.endDate.isEqualOrBefore(feedFromCache.CPendDate)) {
				console.log("Fetching " + params.calendar.summary + " [CACHED]");
				resolve(fetchEventsObj);
			} else {
				console.log("Fetching " + params.calendar.summary);
				
				var moreParams = clone(params);
				moreParams.userEmail = params.email;
				moreParams.roundtripArg = params.calendar;
				moreParams.url = "/calendars/" + encodeURIComponent(params.calendar.id) + "/events";
				// Max resutls is set by API at 2500 https://developers.google.com/google-apps/calendar/v3/reference/events/list
				moreParams.data = {orderBy:"startTime", maxResults:2500, singleEvents:true, timeMin:params.startDate.toRFC3339(), timeMax:params.endDate.toRFC3339()};
				
				oAuthForDevices.send(moreParams).then(response => {
					fetchEventsObj = response;
					if (!oneTimeFetch) {
						// adding my custom additional attribute
						fetchEventsObj.data.CPlastFetched = new Date();
						fetchEventsObj.data.CPstartDate = params.startDate;
						fetchEventsObj.data.CPendDate = params.endDate;
						// update cache
						cachedFeeds[params.calendar.id] = response.data;
					}
					
					resolve(fetchEventsObj);
		
					// metrics
					var calendarSource;
					var label;
					
					if (params.calendar.primary) {
						calendarSource = "mainCalendar";
						label = cachedFeeds["calendarList"].items.length;
						if (label) {
							// seems analtics was not accepting int but only strings
							label = label.toString();
						}
					} else {
						calendarSource = "other calendars";
						label = params.calendar.id + ": " + params.calendar.summary + " - " + params.calendar.accessRole;
						sendGA('fetchCalendarEvents', calendarSource, label);
					}
				}).catch(error => {
					logError("error in oauth send:" + error);
					// must return cached feeds but append error (if needed)
					fetchEventsObj.error = error;
					reject(fetchEventsObj);
				});
			}
		} else {
			console.log("Fetching " + params.calendar.summary + " [invisible + (notifs off OR excluded OR isGadget]");
			resolve(fetchEventsObj);
		}
	});
}

function pollServer(params) {
	return new Promise((resolve, reject) => {
		console.log("pollServer");
	
		params = initUndefinedObject(params);
		
		lastPollTime = Date.now();
		
		var emailToFetch;
		var mustLogout = false;
		
		var tokenResponses = storage.get("tokenResponses");
		if (tokenResponses.length) {
			// get most recent token used
			var mostRecentTokenUsed;
			$.each(tokenResponses, function(index, tokenResponse) {
				if (!mostRecentTokenUsed || tokenResponse.expiryDate.isAfter(mostRecentTokenUsed.expiryDate)) {
					mostRecentTokenUsed = tokenResponse;
				}
			});
			
			email = mostRecentTokenUsed.userEmail
			emailToFetch = email;
		} else {
			console.log("no tokens saved");
			mustLogout = true;
		}
		
		if (emailToFetch && !mustLogout) {
			params.email = emailToFetch;
			
			if (loggedOut) {
				chrome.browserAction.setBadgeBackgroundColor({color:[180, 180, 180, 255]});
				updateBadge({badgeText:"..."});
				chrome.browserAction.setTitle({title:getMessage("loading")});
			}
			
			if (isOnline()) {
				fetchCalendarSettings(params).then(response => {
					return fetchColors(params).then(response => {
						return fetchCalendarList(params).then(response => {
							return processCalendarListFeed(response);
						});
					});
				}).then(response => {
					resolve(response);
				}).catch(error => {
					reject(error);
				});
			} else {
				console.log("offline: so skip ALL fetches");
				resolve();
			}
			
			// update the uninstall url caused we detected an email
			if (email != uninstallEmail) {
				setUninstallUrl(email);
			}
		} else {
			console.log("no email found");
			resolve();
		}
	});
}

function isEventShownOrSnoozed(event, reminderTime) {
	
	if (isCurrentlyDisplayed(event)) {
		return true;
	}
	
	// Must check snoozers before eventsshown because a snoozed event has remindertime passed as a param
	var snoozers = storage.get("snoozers");
	for (var a=0; a<snoozers.length; a++) {
		if (isSameEvent(event, snoozers[a].event)) {
			return true;
		}
	}
	for (var a=0; eventShown=eventsShown[a], a<eventsShown.length; a++) {
		if (isSameEvent(event, eventShown)) {
			if (event.startTime.getTime() == eventShown.startTime.getTime()) {
				// Check that this particular reminder time has not been shown (may have other reminder times due to the ability to set multiple popup reminder settings per event)
				if (reminderTime) {
					if (eventShown.reminderTimes) {
						for (var b=0; thisReminderTime=eventShown.reminderTimes[b], b<eventShown.reminderTimes.length; b++) {
							if (thisReminderTime.time.getTime() == reminderTime.getTime()) {
								return thisReminderTime.shown;
							}
						}
					}
				} else {
					return true;
				}
			} else {
				return false;
			}
		}
	}
	return false;
}

function isTimeToShowNotification(event, reminderTime, lastUpdated) {
	var pastDoNotShowPastNotificationsFlag = true;
	if (storage.get("doNotShowPastNotifications")) {

		// get minimum buffer which is equal to check interval
		var bufferInSeconds = CHECK_EVENTS_INTERVAL / ONE_SECOND;
		// than add double that buffer (just to make sure)
		bufferInSeconds += bufferInSeconds * 2;
		var bufferDate = new Date().subtractSeconds(bufferInSeconds);
		
		//if (reminderTime.isBefore(extensionStartTime)) {
		// ** using endTime instead of reminderTime (because if the event is still in progress than still show notification)
		if (event.endTime && event.endTime.isBefore(bufferDate)) {
			pastDoNotShowPastNotificationsFlag = false;
		}
	}
	
	// the journal exception: do not show notification for events created in the past, like when marieve puts past events for the purpose of journaling
	var createdDate;
	var updatedDate;
	if (event.created) {
		createdDate = new Date(event.created);
	}
	if (event.updated) {
		updatedDate = new Date(event.updated);
	}
	
	var isTimeToShow = false;
	if (pastDoNotShowPastNotificationsFlag && reminderTime && reminderTime.isEqualOrBefore()) {
		// don't show if timed events created in past
		// don't show if all day event is created today
		// don't show if recurring events were created before now
		
		function failCreateUpdateCheck(createUpdateDate) {
			return (createUpdateDate && (reminderTime.isEqualOrBefore(createUpdateDate) || (event.allDay && reminderTime.isToday() && createUpdateDate.isToday())));
		}
		
		if (failCreateUpdateCheck(createdDate)) {
			console.log("DON'T SHOW - because created after reminder passed: " + event.summary, event);
			isTimeToShow = false;
		} else if (failCreateUpdateCheck(updatedDate)) {
			console.log("DON'T SHOW - because updated today or ealier: " + event.summary, event);
			isTimeToShow = false;
		} else {
			isTimeToShow = true;
		}
	} else {
		isTimeToShow = false;
	}
	
	// patch: seems Google+ birthday contacts were changing IDs and thus reappering all the time so lets not show them
	var passedGooglePlusContactsBug = true;
	if (event.calendar && event.calendar.id == "#contacts@group.v.calendar.google.com") {
		if (event.gadget && event.gadget.preferences && event.gadget.preferences["goo.contactsIsMyContact"] == "false") {
			//console.warn("google+ contacts bug: ", event);
			passedGooglePlusContactsBug = false;
		}
	}
	
	if (!passedGooglePlusContactsBug) {
		return false;
	}
	
	// we probably just updated the calendar's defaultreminder time in the extension so let's ignore this reminder and store it as shown
	if (isTimeToShow && lastUpdated && reminderTime.isEqualOrBefore(lastUpdated)) {
		//console.log("eventsIgnoredDueToCalendarReminderChangeByUser: ", reminderTime, lastUpdated);
		updateEventShown(event, eventsShown);
		eventsIgnoredDueToCalendarReminderChangeByUser = true;
		isTimeToShow = false;
	}
	
	return isTimeToShow;
}

function generateNotificationButton(buttons, buttonsWithValues, value, event) {
	if (value) {
		
		var button;
		
		if (value == "dismiss") {
			// dismiss
			
			var title;
			if (isGroupedNotificationsEnabled() && notificationsOpened.length >= 2) {
				title = getMessage("dismissAll");
			} else {
				title = getMessage("dismiss");
			}
			button = {title:title, iconUrl:"images/cancel.png"};
			
		} else if (value == "snoozeTimes") {
			button = {title:"Snooze times...", iconUrl:"images/snooze.png"};
		} else if (value == "location|hangout") {
			if (!isGroupedNotificationsEnabled() || (isGroupedNotificationsEnabled() && notificationsOpened.length == 1)) {
				if (event) {
					var eventSource = getEventSource(event);
					//eventSource = {title:"Hello", url:"https://mail.google.com"};
					
					if (event.hangoutLink) {
						button = {title:getMessage("joinVideoCall"), iconUrl:"images/Google+.png"};
					} else if (eventSource) {
						var iconUrl;
						if (eventSource.isGmail) {
							iconUrl = "images/gmail.png";
						} else {
							iconUrl = "images/link.png";
						}
						button = {title:eventSource.title, iconUrl:iconUrl};
					} else if (event.location) {
						button = {title:event.location, iconUrl:"images/pin_map.png"};
					}
				}
			}
		} else if (value == "reducedDonationAd") {
			button = {title:getMessage("reducedDonationAd_notification", "50¢")};
			//button = {title:"Extras are only 50c click to see/hide this.", iconUrl:"images/thumbs_up.png"};
		} else {
			// snooze
			var unit = value.split("_")[0];
			var delay = value.split("_")[1];
			
			var msgId;
			if (unit == "minutes") {
				msgId = "Xminutes"
			} else if (unit == "hours") {
				if (delay == 1) {
					msgId = "Xhour";
				} else {
					msgId = "Xhours";
				}
			} else if (unit == "days") {
				if (delay == 1) {
					msgId = "Xday";
				} else {
					msgId = "Xdays";
				}
			} else {
				console.error("no unit in snooze: " + unit);
			}
			
			var title;
			if (isGroupedNotificationsEnabled() && notificationsOpened.length >= 2) {
				title = getMessage("snoozeAll");
			} else {
				title = getMessage("snooze");
			}
			title += ": " + getMessage(msgId, delay) + "";
			button = {title:title, iconUrl:"images/snooze.png"};
		}

		if (button) {
			buttons.push(button);
			
			var buttonWithValue = clone(button);
			buttonWithValue.value = value;
			buttonsWithValues.push(buttonWithValue);
		}
	}
}

function getEventNotificationDetails(event) {
	// if not signed in then set a default calendar so the rest doesn't get undefined
	if (!event.calendar) {
		event.calendar = {};
		event.calendar.main = true;
	}
	
	var title = getSummary(event);
	
	// show calendar name if not the main one
	var calendarName;
	var showCalendarInNotification = storage.get("showCalendarInNotification");
	if ((showCalendarInNotification == "onlyNonPrimary" && !event.calendar.primary) || showCalendarInNotification == "always") {
		calendarName = getCalendarName(event.calendar);
		if (!calendarName) {
			calendarName = "";
		}
	}

	var timeElapsed = getTimeElapsed(event);
	
	return {title:title, calendarName:calendarName, timeElapsed:timeElapsed};
}

function generateNotificationItem(event) {
	var eventNotificationDetails = getEventNotificationDetails(event);
	var item = {};
	item.title = eventNotificationDetails.title;
	item.message = "";
	if (eventNotificationDetails.timeElapsed) {
		item.message = " " + eventNotificationDetails.timeElapsed;
	}
	if (eventNotificationDetails.calendarName) {
		if (item.message) {
			item.message += " ";
		}
		item.message += "(" + eventNotificationDetails.calendarName + ")";
	}
	return item;
}

function generateNotificationOptions(notifications) {
	
	var options = {
		type: "",
		title: "",
		message: "",
		items: [],
		iconUrl: "images/bell-middle.png",
		buttons: []
	}
	
	// seems linux user are getting empty notifications when using the type='image' (refer to denis sorn) so force them to use type="basic"
	if (true) { // pref("richNotificationFontSize", "small") == "small" || DetectClient.isLinux()
		 
		if (notifications.length == 1) {
			options.type = "list";
			var eventNotificationDetails = getEventNotificationDetails(notifications[0].event);
			options.title = eventNotificationDetails.title;
			
			var item = {title: "", message: ""}			
			if (eventNotificationDetails.timeElapsed) {
				item.message = eventNotificationDetails.timeElapsed;
			}
			if (eventNotificationDetails.calendarName) {
				if (item.message) {
					item.message += " ";
				}
				item.message += "(" + eventNotificationDetails.calendarName + ")";
			}
			options.items.push(item);			
		} else {
			options.type = "list";
			var startOfOldNotifications = 0;
			
			// if only 1 new recent event among the old ones than highlight it (bigger font) by putting it in the title of the notification
			if (notifications.length >= 2 && notifications[0].recent && !notifications[1].recent) {
				
				var eventNotificationDetails = getEventNotificationDetails(notifications[0].event);
				options.title = eventNotificationDetails.title;
				if (eventNotificationDetails.timeElapsed) {
					options.title += " (" + eventNotificationDetails.timeElapsed + ")";
				}
				if (eventNotificationDetails.calendarName) {
					options.title += " (" + eventNotificationDetails.calendarName + ")";
				}
				
				startOfOldNotifications = 1;
			} else {
				if (DetectClient.isLinux()) {
					// patch because linux gave empty notification unless the title was not empty or not empty string ""
					options.title = notifications.length + " reminders";
				}
			}
			
			var MAX_ITEM_LINES = 5;
			$.each(notifications, function(index, notification) {
				// skip those that have been highlighted already above
				if (index >= startOfOldNotifications) {
					// if on last available line and but there still 2 or more events than put the "more notice"
					if (options.items.length == MAX_ITEM_LINES - 1 && notifications.length - index >= 2) {
						//options.items.push({title:(notifications.length - options.items.length - startOfOldNotifications) + " " + getMessage("more") + "...", message:""});
						options.contextMessage = (notifications.length - options.items.length - startOfOldNotifications) + " " + getMessage("more") + "...";
						return false;
					} else {
						var item = generateNotificationItem(notification.event);
						options.items.push(item);
					}
				}
			});
			
		}
	} else {
		options.type = "image";
		
		console.log("useragent", navigator);
		if (DetectClient.isLinux()) {
			// patch because linux gave empty notification unless the title was not empty or not empty string ""
			options.title = "Reminder";
			options.message = "";
		} else if (navigator.platform && navigator.platform.toLowerCase().indexOf("win") != -1) {
			options.message = "                                    " + new Date().formatTime() + " " + new Date().format(getMessage("notificationDateFormat"));
			//options.title = "Good news long time user!";
			//options.message = "Get all the latest extra features for only 50¢";
		} else {
			// on mac the message area is shorter or bigger font (i think) and it displays the text bigger to the side 
			options.title = "";
			options.message = "";
		}
		
		var tempCanvas = document.getElementById("tempCanvas");
		var notificationCanvas = document.getElementById("notificationCanvas");
		var context = notificationCanvas.getContext("2d");
		
		var MAX_NOTIFICATION_WIDTH = 360;
		var MAX_NOTIFICATION_HEIGHT = 160;
		var EVENT_X_LEFT_BUFFER = 18;
		var EVENT_X_LEFT_BUFFER_WITH_DASHES = 8;
		var EVENT_X_RIGHT_BUFFER = 8;
		var EVENT_Y_SPACING = 10;
		var SMALL_FONT_X_BUFFER = 7;
		var TITLE_FONT = "18px Georgia";
		
		var MAX_TITLE_WIDTH_PERCENT = 0.88; // with no time elapsed
		var MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT = 0.75; // with time elapsed
		
		var x;
		var y = -4;
		var y = 10;

		// note: changing width/height after will blank out the canvas
		notificationCanvas.width = tempCanvas.width = MAX_NOTIFICATION_WIDTH;
		notificationCanvas.height = tempCanvas.height = 2000;
	
		$.each(notifications, function(index, notification) {
			var eventNotificationDetails = getEventNotificationDetails(notification.event);
			
			// test
			//eventNotificationDetails.title = "where did all the people find apples";
			//eventNotificationDetails.timeElapsed = "25 minutes ago";
			//eventNotificationDetails.calendarName = "Small things";
			
			context.textBaseline = "top";
			context.font = TITLE_FONT;
			
			if (notifications.length == 1) {
				x = EVENT_X_LEFT_BUFFER;
			} else { // 2 or more
				x = EVENT_X_LEFT_BUFFER_WITH_DASHES;
				var titlePrefix = "- ";
				context.fillStyle = "#ccc";
				context.fillText(titlePrefix, x, y);
				x += context.measureText(titlePrefix).width;
			}
			
			//context.fillStyle = "black";
			
			// calculate how much text we can fit on the line
			var title = eventNotificationDetails.title;
			var maxLetters = title.length * (MAX_NOTIFICATION_WIDTH / (context.measureText(title).width + x));
			if (x + context.measureText(title).width >= MAX_NOTIFICATION_WIDTH * MAX_TITLE_WIDTH_PERCENT && !eventNotificationDetails.timeElapsed) {
				title = title.substring(0, maxLetters * MAX_TITLE_WIDTH_PERCENT) + "…";
			} else if (x + context.measureText(title).width >= MAX_NOTIFICATION_WIDTH * MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT && eventNotificationDetails.timeElapsed) {
				title = title.substring(0, maxLetters * MAX_TITLE_WITH_TIME_ELAPSED_WIDTH_PERCENT) + "…";
			}
			
			//context.fillStyle = getEventColor(notification.event);
			context.fillStyle = "white";
			
			context.fillText(title, x, y);
			x += context.measureText(title).width + EVENT_X_RIGHT_BUFFER;
			
			if (eventNotificationDetails.timeElapsed) {
				context.font = "10px arial";
				context.fillStyle = "gray";
				context.textBaseline = "top";
				
				context.fillText(eventNotificationDetails.timeElapsed, x, y + SMALL_FONT_X_BUFFER);
				x += context.measureText(eventNotificationDetails.timeElapsed).width + EVENT_X_RIGHT_BUFFER;
			}
			
			if (eventNotificationDetails.calendarName) {
				context.font = "10px arial";
	
				//context.fillStyle = getEventColor(notification.event);
				context.fillStyle = "gray";
				
				context.fillText(eventNotificationDetails.calendarName, x, y + SMALL_FONT_X_BUFFER);
				x += context.measureText(eventNotificationDetails.calendarName).width + EVENT_X_RIGHT_BUFFER;
			}
	
			y += getTextHeight(TITLE_FONT).height + EVENT_Y_SPACING;
			
			var remainingEvents = notifications.length - index - 1;
			if (y + getTextHeight(TITLE_FONT).height + EVENT_Y_SPACING >= MAX_NOTIFICATION_HEIGHT && remainingEvents >= 2) {
				console.log("more...")
				context.font = "15px arial italic";
				context.fillStyle = "gray";
				context.textBaseline = "top";
				context.fillText(remainingEvents + " " + getMessage("more") + "...", EVENT_X_LEFT_BUFFER, y);
				y += getTextHeight(context.font).height + EVENT_Y_SPACING;
				return false;
			}
		});
		
		// save canvas to temp (because changing width/height after will blank out the canvas)
		var tempCanvasContext = tempCanvas.getContext('2d');
		
		tempCanvasContext.fillStyle = "#222";
		tempCanvasContext.fillRect(0,0, notificationCanvas.width, notificationCanvas.height);

		tempCanvasContext.drawImage(notificationCanvas, 0, 0);
		
		// resize new canvas
		var BOTTOM_BUFFER = 5;
		notificationCanvas.height = y + BOTTOM_BUFFER;
		//notificationCanvas.height = 240;
		
		// copy temp canvas to new canvas
		context.drawImage(tempCanvas, 0, 0, tempCanvas.width, notificationCanvas.height, 0, 0, notificationCanvas.width, notificationCanvas.height);
		options.imageUrl = notificationCanvas.toDataURL("image/png");
		
		/*
		var testcanvas = document.getElementById("testcanvas");
		var context = testcanvas.getContext("2d");
		
		context.width = 200;
		context.height = 200;
	
		context.textBaseline = "top";
		context.font = TITLE_FONT;
		context.fillStyle = 'yellow';
		context.fillRect(0,0,200,200);
		context.fillStyle = "#ccc";
		context.fillText("test", 0, 0);
		
		options.imageUrl = testcanvas.toDataURL("image/png");
		*/
	}

	var buttonsWithValues = []; // used to associate button values inside notification object
	var buttonValue;
	
	var event = notifications.first().event;
	
	buttonValue = storage.get("notificationButton1");
	generateNotificationButton(options.buttons, buttonsWithValues, buttonValue, event);

	if (shouldShowReducedDonationMsg()) {
		buttonValue = "reducedDonationAd";
	} else {
		buttonValue = storage.get("notificationButton2");
	}
	generateNotificationButton(options.buttons, buttonsWithValues, buttonValue, event);
	
	if (notifications.length) {
		$.each(notifications, function(index, notification) {
			notification.buttons = buttonsWithValues;
		});
	}

	if (DetectClient.isWindows()) {
		options.appIconMaskUrl = "images/icons/notificationMiniIcon.png";
	}
	
	if (!options.items.length) {
		delete options.items;
	}
	
	var showNotificationDuration = storage.get("showNotificationDuration");
	if (showNotificationDuration == "7") {
		options.priority = 0;
	} else if (showNotificationDuration == "never") {
		options.requireInteraction = true;
	} else {
		options.priority = 2;
	}
	
	return options;
}

function generateNotificationIdFromEvent(event, type) {
	var notificationIdObj = {eventId:event.id, summary:event.summary, type:type, uniqueIdForNotificationId:Math.floor(Math.random() * 1000000)};
	return JSON.stringify(notificationIdObj);
}

function getNotificationObj(notificationId) {
	return JSON.parse(notificationId);
}

function openNotification(notifications, callback) {
	var options = generateNotificationOptions(notifications);
	//options.isClickable = true;
	
	console.log("create notif: ", notifications, options);
	
	var notificationId;
	if (isGroupedNotificationsEnabled()) {
		notificationId = GROUPED_NOTIFICATION_ID;
	} else {
		notificationId = notifications.first().id;
	}
	chrome.notifications.create(notificationId, options, function(notificationId) {
		var cbParams = {};
		if (chrome.extension.lastError) {
			logError("create notif error: " + chrome.extension.lastError.message);
			cbParams.error = chrome.extension.lastError.message;
		} else {
			lastNotificationShownDate = new Date();
			
			chrome.idle.queryState(IDLE_DETECTION_INTERVAL, function(newState) {
				console.log("idle state when show notif: " + newState);
				if (newState != "active") {
					notificationsOpenedCountWhenIdle = notificationsOpened.length;
				}
			});
			
			var pendingNotificationsInterval = storage.get("pendingNotificationsInterval");
			if (pendingNotificationsInterval) {
				pendingNotificationsInterval = minutes(parseInt(pendingNotificationsInterval));
				// test
				//pendingNotificationsInterval = 10000;
				ForgottenReminder.start(pendingNotificationsInterval);
			}
		}
		callback(cbParams);
	});
}

var ForgottenReminder = (function() {
	var reminderCount;
	var interval;
	return { // public interface
		start: function(intervalTime) {
			// all private members are accesible here
			ForgottenReminder.stop();
			reminderCount = 0;
			interval = setIntervalSafe(function() {				
				reminderCount++;
				if (chrome.notifications.getAll) {
					chrome.notifications.getAll(function(notifications) {
						if ($.isEmptyObject(notifications)) {
							// no reminders let's stop interval
							ForgottenReminder.stop();
						} else {
							ForgottenReminder.execute();
						}
					});
				} else {
					ForgottenReminder.stop();
				}
			}, intervalTime);
		},
		execute: function(params) {
			if (!params) {
				params = {};
			}
			
			if (params.test || reminderCount == 1) {
				if (storage.get("notificationSound")) {
					console.log("forgotten reminder sound: " + new Date());
					chrome.idle.queryState(15, function(newState) {
						if (newState == "active") {
							playNotificationSoundFile(storage.get("notificationSound"), true);
						}
					});					
				}
			}
			
			forgottenReminderAnimation.animate(function(previousBadgeText) {
				updateBadge({forceRefresh:true, badgeText:previousBadgeText});
			});			
		},
		stop: function() {
			clearInterval(interval);			
		}
	};
})();

function gatherNotifications() {
	var newNotifications = [];
	var oldNotifications = [];
	$.each(notificationsQueue, function(a, notification) {
		
		// patch for issue when notification was not being removed when snoozed within remindersWindow because id's were mismatched
		if (!notification.id) {
			notification.id = generateNotificationIdFromEvent(notification.event);						
		}
		
		var found = false;
		$.each(notificationsOpened, function(index, notificationOpened) {
			if (isSameEvent(notification.event, notificationOpened.event)) {
				found = true;
				return false;
			}
			return true;
		});
		
		if (found) {
			notification.recent = false;
			oldNotifications.push(notification);
		} else {
			notification.recent = true;
			newNotifications.push(notification);
		}
	});
	
	// re-initialize eventsInGroupNotification *after performing code above to identify new notifications
	notificationsOpened = notificationsQueue.shallowClone();
	
	var notificationsInOrder = [];
	notificationsInOrder = notificationsInOrder.concat(newNotifications, oldNotifications);

	sortNotifications(notificationsInOrder);
	
	return {notificationsInOrder:notificationsInOrder, newNotifications:newNotifications, oldNotifications:oldNotifications};
}

function showNotifications(params, callback) {
	if (!params) {
		params = {};
	}
	
	callback = initUndefinedCallback(callback);
	
	if (isDND()) {
		callback({error:"DND enabled! So cannot show notifications"});
	} else {
		if (notificationsQueue.length >= 1) {
			
			var desktopNotification = storage.get("desktopNotification");
			
			var textNotification = params.testType == "text" || (params.testType == undefined && desktopNotification == "text");
			var richNotification = params.testType == "rich" || (params.testType == undefined && desktopNotification == "rich");
			var popupWindowNotification = params.testType == "popupWindow" || (params.testType == undefined && desktopNotification == "popupWindow");
			
			if (textNotification || !chrome.notifications) {
				
				if (window.Notification) {

					var notificationError = null;

					// text window
					$.each(notificationsQueue, function(a, notification) {
						var eventNotificationDetails = getEventNotificationDetails(notification.event);
						
						var title = eventNotificationDetails.title;
						var message = "";
						if (eventNotificationDetails.calendarName) {
							message = "from " + eventNotificationDetails.calendarName;
						}
		
						notificationWindow = new Notification(title, {body:message, icon:'images/bell-48.png', requireInteraction: true});
						notificationWindow.notification = notification;
						
						notificationWindow.onclick = function() {
							var url = getEventUrl(this.notification.event);
							if (url) {
								openUrl(url, {urlToFind:this.notification.event.id});
							}
							this.close();
						}
						
						notificationWindow.onshow = function() {
							/*
							var thisNotification = this;
							if (storage.get("closePopupsAfterAWhile")) {
								setTimeout(function() {
									thisNotification.close();
								}, ONE_SECOND * parseInt(storage.get("closePopupsAfterAWhileInterval")));
							}
							*/
						}			
						notificationWindow.onclose = function() {
							notificationWindow = null;
						}
						notificationWindow.onerror = function(e) {
							notificationError = "Error displaying notification: " + e.type + " " + e.detail;
							logError(notificationError);
						}

						// clear queue
						updateNotificationEventsShown([notification], eventsShown);
						notificationsQueue = [];
					});
					
					// let's wait to see if notification.onerror is called before concluding a successful callback here
					setTimeout(function() {
						if (notificationError) {
							callback({error:notificationError});
						} else {
							callback();
						}
					}, 200);

				} else {
					var warning = "Notifications not supported!";
					console.warn(warning);
					callback({error:warning});
				}

			} else if (richNotification) {
				// rich notification
				
				// notificationsQueue = notifications that should be launched and are acculumated each time checkEvents is passed
				if (isGroupedNotificationsEnabled()) {
					// group notifications

					var gatheredNotifications = gatherNotifications();
					
					var notificationsInOrder = gatheredNotifications.notificationsInOrder;
					var newNotifications = gatheredNotifications.newNotifications;
					var oldNotifications = gatheredNotifications.oldNotifications;
					
					console.log("new notifs", newNotifications);
					if (newNotifications.length || params.testType) {
						console.log("clear", newNotifications);
						chrome.notifications.clear(GROUPED_NOTIFICATION_ID, function(wasCleared) {
							openNotification(notificationsInOrder, function(notificationResponse) {
								if (notificationResponse.error) {
									// reset opened notification flags
									closeNotifications(notificationsOpened);
								}
								callback(notificationResponse);
							});
						});
					} else {
						var warning = "No new notifications";
						console.log(warning, newNotifications);
						callback({warning:warning});
					}
					
				} else {
					// Individual Notifications
					// notificationOpened = notification that HAVE been launched
					// this method is used to make we don't relaunch notification that have already been displayed
					
					$.each(notificationsQueue, function(a, notification) {
		
						var found = false;
						$.each(notificationsOpened, function(index, notificationOpened) {
							if (isSameEvent(notification.event, notificationOpened.event)) {
								found = true;
								return false;
							}
							return true;
						});
						if (found) {
							// commented because were inside a loop so only callback at end
							//callback();
						} else {
							notification.id = generateNotificationIdFromEvent(notification.event);
							
							openNotification([notification], function(response) {
								if (!response.error) {
									notificationsOpened.push(notification);
								}
								// commented because were inside a loop so only callback at end
								//callback(response);
							});
						}
					});

					// callback only after done.
					callback();
				}
			} else if (popupWindowNotification) {
				var gatheredNotifications = gatherNotifications();
				
				var notificationsInOrder = gatheredNotifications.notificationsInOrder;
				var newNotifications = gatheredNotifications.newNotifications;
				var oldNotifications = gatheredNotifications.oldNotifications;
				
				notificationsOpened = notificationsQueue.shallowClone();
				
				if (newNotifications.length || params.testType) {
					var useIdle;
					if (!params.testType) {
						useIdle = true;
					}
					openReminders({useIdle:useIdle});
					
					chrome.idle.queryState(IDLE_DETECTION_INTERVAL, function(newState) {
						console.log("idle state when show notif: " + newState);
						if (newState != "active") {
							notificationsOpenedCountWhenIdle = notificationsOpened.length;
						}
					});

				}
				
			} else {
				// html window
				// Handle exists
				// not used anymore...
				callback({error:"Notification system not recognized!"});
			}
		} else {
			callback({error:"No events in the queue"});
		}
	}
	
}

function getPollingInterval() {
	// note2 - refer to: feedUpdatedWithinTheseHours ... because we use 2 hours if the calendars don't have notifications 
	return hours(1);
}

function getChromeWindowOrBackgroundMode() {
	return new Promise((resolve, reject) => {
		if (chrome.permissions) {
			chrome.permissions.contains({permissions: ["background"]}, function(result) {
				resolve(result);
			});
		} else {
			resolve(false);
		}
	}).then(result => {
		return new Promise((resolve, reject) => {
			if (result) {
				resolve();
			} else {
				chrome.windows.getAll(null, function(windows) {
					if (windows && windows.length) {
						resolve();
					} else {
						reject("No windows exist");
					}
				});
			}
		});
	});
}

function queueNotification(params) {
	// checkEvents might have been called several times so let's make sure not to add duplicate entries
	var found = notificationsQueue.some(function(notificationInQueue) {
		if (notificationInQueue.event.id == params.event.id && notificationInQueue.reminderTime.isEqual(params.reminderTime)) {
			console.warn("already queued this event (bug?)", params);
			return true;
		}
	});
	
	if (!found) {
		notificationsQueue.push(params);
	}
}

function ensurePollServer() {
	return new Promise(function(resolve, reject) {
		var pollingInterval = getPollingInterval();
		var elapsedTime = Date.now() - lastPollTime;
		if (elapsedTime >= pollingInterval) {
			// logic here: make sure any events added between the 30 min intervals get loaded so idle time should be larger than 30min+buffer
			// because pollinginterval is in MILLIseconds and idle uses seconds!
			var pollingIntervalInSeconds = pollingInterval / ONE_SECOND;
			var idleBuffer = 5 * 60; // 5 minutes;
			var idleSeconds = pollingIntervalInSeconds + idleBuffer
			
			chrome.idle.queryState(idleSeconds, function(state) {
				// only poll if active or user just returned from standby is at login screen (note the encapsulating method above must also pass ie. can't poll faster than polling interval)
				if (state == "active" || (state == "locked" && detectSleepMode.isWakingFromSleepMode())) {
					pollServer().then(function() {
						resolve();
					}).catch(function() {
						resolve(); // return resolve anyways for caller to be able to use .then
					});
				} else {
					console.log("state: " + state + " don't poll");
					resolve();
				}
			});
		} else {
			resolve();
		}
	});
}

function checkEvents(params) {
	
	params = initUndefinedObject(params);
	
	return getChromeWindowOrBackgroundMode().then(() => {
		var selectedCalendars = storage.get("selectedCalendars");
		
		// Update context menus on the hour and atleast every hour
		if (!contextMenuLastUpdated || ((new Date().getMinutes() == 0 || new Date().getMinutes() == 30) && contextMenuLastUpdated.diffInMinutes() <= -30)) {
			updateContextMenuItems();
		}
		
		// SKIP because interval to short
		if (params.source == "interval") {
			if ((Date.now() - lastCheckEventsTime) < seconds(5)) {
				console.log("skip checkevents");
				return;
			}
			lastCheckEventsTime = Date.now();
		}
		
		console.log("checkEvents");
		//console.log("checkEvents: " + new Date + " " + params.source);
		
		// fetch any new or deleted events before updating visuals
		return ensurePollServer().then(function() {
			if (!loggedOut) {
				var nextEvent = null;
				var badgeText = "";
				var badgeColor = null;
				var toolTip = "";
				var previousNextEvent = null;
				var unitOfTimeLeftOnBadge;
				var oldestEventDateToFetch = getStartDateBeforeThisMonth();
				eventsIgnoredDueToCalendarReminderChangeByUser = false;
				
				$.each(events, function(a, event) {
					
					// make sure not excluded AND do not include notifications for free busy calendar (since we have no event titles to display for these events)
					if (!isCalendarExcluded(event.calendar) && event.calendar.accessRole != "freeBusyReader") {
						
						if (event.startTime.isEqualOrAfter(oldestEventDateToFetch) && !hasUserDeclinedEvent(event)) {
							
							var nextEventMin = Math.ceil((event.startTime.getTime() - Date.now()) / ONE_MINUTE);
							
							var passedDoNotShowNotificationsForRepeatingEvents = true;
							// if a recurring event (aka. 'originalEvent' because it points to the recurring event) and user set to exclude recurring events then fail this test
							if (event.recurringEventId && storage.get("doNotShowNotificationsForRepeatingEvents")) {
								passedDoNotShowNotificationsForRepeatingEvents = false
							}
							
							// created this flag to skip this part because it is a CPU intensive loop when there are many events or eventsShown particularly the method isEventShownOrSnoozed()
							if ((params.ignoreNotifications == undefined || !params.ignoreNotifications) && passedDoNotShowNotificationsForRepeatingEvents) {
								var reminders = getEventReminders(event);
								
								var eventHasAPopupReminder = false;
								if (reminders) {
									$.each(reminders, function(index, reminder) {
										
										if (reminder.method == "popup") {
											eventHasAPopupReminder = true;
										}
										
										var reminderTime = getReminderTime(event, reminder);
										
										if (reminder.method == "popup" && !isEventShownOrSnoozed(event, reminderTime)) {
											if (isTimeToShowNotification(event, reminderTime, reminder.lastUpdated)) {
												queueNotification({event:event, reminderTime:reminderTime});
											}
										}
									});
								}
							}
							
							//if (!isGadgetCalendar(event.calendar)) {
								
								var passedExcludeRecurringEventsButtonIcon = true;
								// if a recurring event (aka. 'originalEvent' because it points to the recurring event) and user set to exclude recurring events then fail this test
								if (event.recurringEventId && storage.get("excludeRecurringEventsButtonIcon")) {
									passedExcludeRecurringEventsButtonIcon = false
								}
								
								var passedHiddenCalendarsFromButtonTest = true;
								var selected = isCalendarSelectedInExtension(event.calendar, email, selectedCalendars);
								
								if (event.calendar && !selected && storage.get("excludeHiddenCalendarsFromButton")) {
									passedHiddenCalendarsFromButtonTest = false;
								}
								
								if (passedExcludeRecurringEventsButtonIcon && passedHiddenCalendarsFromButtonTest && (event.startTime.getTime() - Date.now() >= 0 || event.allDay && isToday(event.startTime)) && nextEventMin < 60*24*storage.get("maxDaysAhead")) {
									if (!nextEvent) {					
										if (event.allDay) {
											if (!isToday(event.startTime)) {
												nextEvent = event;
												var startOfToday = today();
												var eventDay = new Date(event.startTime);
												eventDay.resetTime();
												var daysAway = Math.ceil((eventDay.getTime() - startOfToday.getTime()) / ONE_MINUTE / 60 / 24);
												
												if (storage.get("showDaysLeftInBadge")) {
													badgeText = daysAway + getMessage("d");
													badgeColor = GRAY;
												}
												
												unitOfTimeLeftOnBadge = "d";
											}
										} else {
											if (nextEventMin < 60) {
												if (storage.get("showMinutesLeftInBadge")) {
													badgeText = nextEventMin + getMessage("m");
													badgeColor = RED;
												} else {
													badgeText = $.trim(formatTimeForBadge(event.startTime));
													badgeColor = BLUE;
												}
												unitOfTimeLeftOnBadge = "m";
											} else if (nextEventMin < 60*12) {
												if (storage.get("showHoursLeftInBadge")) {
													badgeText = Math.round(nextEventMin/60) + getMessage("h");
												} else {
													badgeText = $.trim(formatTimeForBadge(event.startTime));
												}
												badgeColor = BLUE;
												unitOfTimeLeftOnBadge = "h";
											} else if (nextEventMin < 60*24) {
												if (storage.get("showHoursLeftInBadge")) {
													badgeText = Math.round(nextEventMin/60) + getMessage("h");
												} else {
													badgeText = $.trim(formatTimeForBadge(event.startTime));
												}			
												badgeColor = GRAY;
											} else {
												if (storage.get("showDaysLeftInBadge")) {
													badgeText = event.startTime.diffInDays() + getMessage("d");
													badgeColor = GRAY;
												}
												unitOfTimeLeftOnBadge = "d";
											}
											nextEvent = event;
										}
									}
									if (event.summary) {
										if (!previousNextEvent || event.startTime.toDateString() != previousNextEvent.startTime.toDateString()) {
											if (toolTip != "") {
												toolTip += "\n\n";
											}
											if (isToday(event.startTime)) {
												toolTip += getMessage("today") + ":";
											} else if (isTomorrow(event.startTime)) {
												toolTip += getMessage("tomorrow") + ":";
											} else {
												//toolTip += dateFormat.i18n.dayNames[event.startTime.getDay()] + ":";
												toolTip += dateFormat.i18n.dayNamesShort[event.startTime.getDay()] + ", " + dateFormat.i18n.monthNamesShort[event.startTime.getMonth()] + " " + event.startTime.getDate() + ":";
											}
										}
										toolTip += "\n";
										if (event.allDay) {
											toolTip += event.summary;
										} else {
											toolTip += event.startTime.formatTime() + " " + event.summary;
										}
										toolTip = toolTip.replace(/&amp;/ig, "&");
										previousNextEvent = event;
									}
								}
							//}
						}
					}
				});
				
				if (eventsIgnoredDueToCalendarReminderChangeByUser) {
					console.log("eventsIgnoredDueToCalendarReminderChangeByUser so serialize")
					serializeEventsShown();
				}
				
				// Check snoozers
				$.each(storage.get("snoozers"), function(b, snoozer) {
					if ((!snoozer.email || snoozer.email == email) && snoozer.time && snoozer.time.isEqualOrBefore()) {
						if (!isCurrentlyDisplayed(snoozer.event)) {
							queueNotification({event:snoozer.event, reminderTime:snoozer.reminderTime});
						}
					}
				});
				
				if (storage.get("showDayOnBadge")) {
					if (!unitOfTimeLeftOnBadge || (unitOfTimeLeftOnBadge == "m" && !storage.get("showDayOnBadgeExceptWhenMinutesLeft")) || (unitOfTimeLeftOnBadge == "h" && !storage.get("showDayOnBadgeExceptWhenHoursLeft")) || (unitOfTimeLeftOnBadge == "d" && !storage.get("showDayOnBadgeExceptWhenDaysLeft"))) {
						var forceEnglish = isAsianLangauge(); 
						badgeText = new Date().format("ddd", {forceEnglish:forceEnglish});
						badgeColor = [150,150,150, 255];
					}		
				}
				
				chrome.browserAction.getBadgeText({}, function(previousBadgeText) {
					if (storage.get("showEventTimeOnBadge") || storage.get("showDayOnBadge")) {
						// badgetext stays the same
					} else {
						badgeText = "";
					}
					
					updateBadge({badgeText:badgeText, badgeColor:badgeColor, toolTip:toolTip});

				});

				// must be done before sound and desktop notifications
				filterNotifications(notificationsQueue);

				$.each(notificationsQueue, function(a, notification) {
					if (!notification.audioPlayedCount) {
						playNotificationSound(notification);					
					}
				});
				
				if (storage.get("desktopNotification") && notificationsQueue.length >= 1) {
					showNotifications();
				}
			}
		});
		
	}, error => { // Note this the 2nd error parameter in Promise 
		console.error("Maybe NO chromeWindowOrBackgroundMode - so do not check events, possible error: " + error);
	});
}

function filterNotifications(notifications) {
	var removedNotifications = [];
	
	for (var a=0; notification=notifications[a], a<notifications.length; a++) {
		var allDayEventRulesPassed = false;
		if (!storage.get("doNotShowNotificationsForAlldayEvents") || (storage.get("doNotShowNotificationsForAlldayEvents") && !notification.event.allDay)) {
			allDayEventRulesPassed = true;
		}
		if (!allDayEventRulesPassed) {
			// when splicing in a for loop must a-- the index or else it will skip the item after the deleted item
			notifications.splice(a, 1);
			a--;
		} else {
			// remove any deleted events
			if (events.length) { // make sure we have some events because they could be empty if we're offline or there was a temporary connection issue
				var foundEvent = findEventById(notification.event.id);
				if (!foundEvent) {
					console.log("remove event from notifications because it was probably deleted", notification);
					removedNotifications.push(notification);
					//notifications.splice(a, 1);
					//a--;
				}
			}
		}
	}
	
	if (removedNotifications.length) {
		closeNotifications(removedNotifications);
		// send to reminders popup
		chrome.runtime.sendMessage({action: "removeNotifications", notifications:removedNotifications});
	}
}

function serializeEventsShown() {
	// put a timer because this process freezes UI because of the size of eventsShown in localstorage
	setTimeout(function() {
		storage.set("eventsShown", eventsShown).catch(error => {
			// try removing cachefeeds to make room and then try the eventsShown (becuase its more important)
			logError("error serializing eventsShown: " + error + " eventsShown: " + eventsShown.length + " now trying to remove cachedFeeds to make space...");
			storage.remove("cachedFeeds").then(() => {
				storage.set("eventsShown", eventsShown).catch(error => {
					logError("error serialized eventsShown again: " + error + " now show message to user");
					openUrl("https://jasonsavard.com/wiki/Calendar_extension_storage_issue");
				});
			}).catch(error => {
				logError("error removing cachedFeeds: " + error);
				openUrl("https://jasonsavard.com/wiki/Calendar_extension_storage_issue");
			});
		});
	}, seconds(2));
}

function initOAuth() {
	var tokenResponses = storage.get("tokenResponses");
	oAuthForDevices = new OAuthForDevices(tokenResponses);
	oAuthForDevices.setOnTokenChange(function(params, allTokens) {
		tokenResponses = allTokens;
		storage.set("tokenResponses", tokenResponses);
	});
	oAuthForDevices.setOnTokenError(function(tokenResponse, response) {
		// logout();
	});
}

function openUnstableWarningPage() {
	openUrl("https://jasonsavard.com/wiki/Unstable_channel_of_Chrome");
}

function firstInstall() {
	// Note: Install dates only as old as implementation of this today, April 11th 2011
	storage.setDate("installDate");
	storage.set("installVersion", chrome.runtime.getManifest().version);
	var optionsUrl = chrome.extension.getURL("options.html?action=install");
	chrome.tabs.create({url: "https://jasonsavard.com/thankYouForInstalling?app=calendar&optionsUrl=" + encodeURIComponent(optionsUrl)});
}

// DO NOT place onInstalled in any async callbacks because the "update" event would not trigger for testing when reloading extension
if (chrome.runtime.onInstalled) {
	chrome.runtime.onInstalled.addListener(function(details) {
		console.log("onInstalled: " + details.reason);

		storagePromise.then(() => {
			if (details.reason == "install") {
				firstInstall();
			} else if (details.reason == "update") {
				// seems that Reloading extension from extension page will trigger an onIntalled with reason "update"
				// so let's make sure this is a real version update by comparing versions
				if (details.previousVersion != chrome.runtime.getManifest().version) {
					console.log("version changed");
					// extension has been updated to let's resync the data and save the new extension version in the sync data (to make obsolete any old sync data)
					// but let's wait about 60 minutes for (if) any new settings have been altered in this new extension version before saving syncing them
					chrome.alarms.create("extensionUpdatedSync", {delayInMinutes:60});
				}
				
				var previousVersionObj = parseVersionString(details.previousVersion)
				var currentVersionObj = parseVersionString(chrome.runtime.getManifest().version);
				if (!storage.get("disabledExtensionUpdateNotifications") && (previousVersionObj.major != currentVersionObj.major || previousVersionObj.minor != currentVersionObj.minor)) {
					var options = {
							type: "basic",
							title: getMessage("extensionUpdated"),
							message: "Checker Plus for Google Calendar " + chrome.runtime.getManifest().version,
							iconUrl: "images/icons/icon-128_whitebg.png",
							buttons: [{title: getMessage("seeUpdates"), iconUrl: "images/open.svg"}, {title: getMessage("doNotNotifyMeOfUpdates"), iconUrl: "images/DND.svg"}]
					}
					
					chrome.notifications.create("extensionUpdate", options, function(notificationId) {
						if (chrome.runtime.lastError) {
							console.error(chrome.runtime.lastError.message);
						} else {
							lastExtensionUpdateNotificationShownDate = new Date();
						}
					});
				}
				
			}
			sendGA("extensionVersion", chrome.runtime.getManifest().version, details.reason);
		});
	});	
} else {
	storagePromise.then(() => {
		if (!storage.get("installDate")) {
			firstInstall();
		}
	});
}

if (chrome.alarms) {
	chrome.alarms.create("updateSkins", {periodInMinutes:60*24}); // = 24 hours (used to be every 48 hours)
}

function setUninstallUrl(email) {
	if (chrome.runtime.setUninstallURL) {
		var url = "https://jasonsavard.com/uninstalled?app=calendar";
		url += "&version=" + encodeURIComponent(chrome.runtime.getManifest().version);
		url += "&daysInstalled=" + daysElapsedSinceFirstInstalled();
		if (email) {
			url += "&e=" + encodeURIComponent(btoa(email));
			uninstallEmail = email;
		}
		console.log("setUninstallUrl: " + url);
		chrome.runtime.setUninstallURL(url);
	}
}

// set this initially in case we never get more details like email etc.
setUninstallUrl();
sendFVDInfo();

if (chrome.runtime.onMessageExternal) {	
	chrome.runtime.onMessageExternal.addListener(function(message, sender, sendResponse) {
		if (message === "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-poke") {

			var info = {
					  "poke"    :   2,              // poke version 2
					  "width"   :   1,              // 406 px default width
					  "height"  :   2,              // 200 px default height
					  "path"    :   "popup.html?source=widget",
					  "v2"      :   {
					                  "resize"    :   true,  // Set to true ONLY if you create a range below.
					                  "min_width" :   1,     // 200 px min width
					                  "max_width" :   3,     // 406 px max width
					                  "min_height":   1,     // 200 px min height
					                  "max_height":   3      // 200 px max height
					                }
					};
			
			pokerListenerLastPokeTime = new Date();
			chrome.runtime.sendMessage(
				sender.id, {
					head: "mgmiemnjjchgkmgbeljfocdjjnpjnmcg-pokeback",
					body: info
				}
			);
		} else if (message.action == "turnOffDND") {
			setDND_off(true);
		} else if (message.action == "setDNDEndTime") {
			var endTime = new Date(message.endTime);
			setDNDEndTime(endTime, true);
		} else if (message.action == "createEvent") {
			if (isGmailExtension(sender.id)) {
				var createEvent = JSON.parse(message.event);
				
				var eventEntry = new EventEntry();
				console.log("createevent", message);
				eventEntry.quickAdd = false;
				eventEntry.allDay = createEvent.allDay;  
				eventEntry.startTime = new Date(createEvent.startTime);
				if (createEvent.endTime) {
					eventEntry.endTime = new Date(createEvent.endTime);
				}
				eventEntry.summary = createEvent.summary;
				eventEntry.source = createEvent.source;
				//eventEntry.source = {title:title, url:info.linkUrl};
				eventEntry.description = createEvent.description;
				performActionOutsideOfPopup(eventEntry).then(function(response) {
					console.log("createevent response", response);
					sendResponse({success:true});
				}).catch(function(error) {
					console.log("createevent error: " + error);
					sendResponse({error:error});
				});
				//  return true to indicate I wish to send a response asynchronously (this will keep the message channel open to the other end until sendResponse is called)
				return true;
			} else {
				console.warn("Message not sent from a recognized extension: " + sender.id);
			}
		} else if (message.action == "generateActionLink") {
			// used externall from gmail extension
			var eventEntry = JSON.parse(message.eventEntry);
			var actionLinkObj = generateActionLink("TEMPLATE", eventEntry);
			var url = actionLinkObj.url + "?" + actionLinkObj.data;
			sendResponse({url:url});
		} else if (message.action == "getInfo") {
			sendResponse({installed:true});
  		}
	});
}

$(document).ready(function() {
	
	try {
		if (!localStorage.detectedChromeVersion) {
			localStorage.detectedChromeVersion = true;
			DetectClient.getChromeChannel().then(result => {
				if (result && result.channel != "stable") {
					var title = "You are not using the stable channel of Chrome";
					var body = "Click for more info. Bugs might occur, you can use this extension, however, for obvious reasons, these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome.";
					var notification = new Notification(title, {body:body, icon:"images/icons/icon-48.png"});
					notification.onclick = function () {
						openUnstableWarningPage();
						this.close();
					};
				}
			});
		}
	} catch (e) {
		logError("error detecting chrome version: " + e);
	}
	
	storagePromise.then(() => {
		
		return loadLocaleMessages(storage.get("lang")).then(() => {
			initCalendarNames(dateFormat.i18n);
			
			var syncExcludeList = ["eventsShown", "cachedFeeds", "lastOptionStatsSent", "notificationSoundCustom"];
			syncOptions.init(syncExcludeList);

			// BEGIN LEGACY CODE
			
			// move from localStorage to chrome.storage Sep. 14 2016
			if (localStorage.installDate) {
				for (var key in localStorage) {
					console.log("transfer: " + key);
					if (key == "console_messages" || key == "lsid") {
						// ignore it
					} else if (localStorage[key] === "true" || localStorage[key] === "false" || key == "donationClicked" || key == "eventsShown" || key == "excludedCalendars" || key == "tokenResponses" || key == "_remindersWindowCloseWarning" || key == "disabledExtensionUpdateNotifications" || key == "reducedDonationAdClicked" || key == "verifyPaymentRequestSent" || key == "verifyPaymentRequestSentForReducedDonation" || key == "24hourMode" || key == "detectedChromeVersion" || key == "selectedCalendars" || key == "popoutMessage" || key == "gmailCheckerInstalled" || key == "tryMyOtherExtensionsClicked" || key == "hideDelete") {
						try {
							storage.set(key, JSON.parse(localStorage[key], dateReviver));
						} catch (e) {
							console.warn("could not transfer: " + key);
						}
					} else if (key == "installDate" || key == "_changeViewGuide" || key == "_createEventTested" || key == "_quotaIssueDismissed" || key == "_lastUpdateSkins" || key == "daysElapsedSinceEligible" || key == "_createEventTested" || key == "lastOptionStatsSent" || key == "astSyncOptionsLoad" || key == "lastSyncOptionsSave" || key == "randomTimeForVerifyPayment" || key == "lastOptionStatsSent" || key == "DND_endTime") {
						var value = localStorage[key];
						if (value) {
							storage.set(key, new Date(value));
						}
					} else if (key == "cachedFeeds") {
						// do nothing
						
						/*
						console.time("compress cache feeds");
						window.cachedFeedsCompressed = LZString.compressToUTF16( JSON.stringify(localStorage.cachedFeeds) );
						console.timeEnd("compress cache feeds");
						
						console.time("decompress cache feeds")
						cachedFeeds = LZString.decompressFromUTF16(localStorage.cachedFeeds);
						console.timeEnd("decompress cache feeds")
						console.time("parse");
						cachedFeeds = JSON.parse(cachedFeeds);
						console.timeEnd("parse")
						*/
					} else {
						storage.set(key, localStorage[key]);
					}
				}
				
				function convertToObject(key) {
					try {
						storage.set(key, JSON.parse(storage.get(key), dateReviver));
					} catch (e) {
						console.warn("could not transfer: " + key);
						storage.remove(key);
					}
				}
				
				convertToObject("snoozers");
				convertToObject("calendarSettings");
				convertToObject("skins");
				convertToObject("customSkin");
				
				localStorage.clear();
			}
			
			
			// Oct 15th 2016
			if (storage.get("popupGoogleCalendarWebsite")) {
				storage.set("browserButtonAction", BrowserButtonAction.GOOGLE_CALENDAR);
				storage.remove("popupGoogleCalendarWebsite");
			}
			
			// END LEGACY CODE
			
	
			//email = "blahblah@gmail.com";
			//loggedOut = false;
			
			initOAuth();
			updateBadge();
			initPopup();
			
			// Add listener once only here and it will only activate when browser action for popup = ""
			chrome.browserAction.onClicked.addListener(tab => {
				if (storage.get("browserButtonAction") == BrowserButtonAction.GOOGLE_CALENDAR) {
					openGoogleCalendarWebsite();
				} else {
					openUrl(chrome.extension.getURL("popup.html"), {urlToFind:chrome.extension.getURL("popup.html")});
				}
			});
			
			// Setup omnibox...
			if (chrome.omnibox) {
				chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
					setOmniboxSuggestion(text, suggest);
				});
			}
			
			chrome.windows.onFocusChanged.addListener(function(windowId) {
				// had to remove this because apparently window focus is never regained after the drawAttention call
				//if (windowId != chrome.windows.WINDOW_ID_NONE) {
					//console.log("onfocus: " + windowId + " " + new Date() + " diff: " + (Math.abs(drawAttentionDate.getTime() - new Date().getTime())));
					// patch: it seems that when drawAttention is called it calls focus to chrome window even though it doesn't get focus set let's ignore anything within 200 milis seconds of the drawattention
					if (Math.abs(drawAttentionDate.getTime() - new Date().getTime()) > 90) {
						//console.log("onfocus2: " + drawAttentionDate + " " + new Date());
						lastWindowOnFocusDate = new Date();
						lastWindowOnFocusID = windowId;
					}
				//}
			});
			
			chrome.windows.onRemoved.addListener(function(windowId) {
				
				// detect reminders closed so we snooze it to return in 5 minutes
				if (remindersWindow && remindersWindow.id && remindersWindow.id == windowId) {
					console.log("reminders closed");
					remindersWindow = null;
					
					if (!remindersWindowClosedByDismissingEvents && !storage.get("_remindersWindowCloseWarning")) {
						storage.enable("_remindersWindowCloseWarning");
						setTimeout(function() {
							openReminders({closeWindowGuide:true});
						}, seconds(1));
					}
					
					clearTimeout(window.retoastRemindersTimeout);
					retoastRemindersTimeout = setTimeout(function() {
						bg.console.log("bg.notificationsOpened.length", bg.notificationsOpened.length);
						if (bg.notificationsOpened.length) {
							if (!bg.remindersWindow) {
								openReminders({useIdle:true});
							}
						}
					}, minutes(5));
					
				}
				
				// patch: if all browser windows closed then let's closereminders because if we leave it doesn't regisere snoozes or dimssiess??
				if (remindersWindow) {
					chrome.windows.getAll(function(windows) {
						var windowsOpened = 0;
						
						windows.forEach(function(thisWindow) {
							if (remindersWindow.id == thisWindow.id) {
								// ignore
							} else {
								windowsOpened++;
							}
						});
						
						if (windowsOpened == 0) {
							closeReminders();
						}
					});
				}
			});
			
			if (chrome.commands && DetectClient.isChrome()) {
				chrome.commands.onCommand.addListener(function(command) {
					if (command == "dismissEvent") {
						console.log("oncommand dismiss");
						var desktopNotification = storage.get("desktopNotification");
						var noEventsToDismiss = false;
						
						if (desktopNotification == "text") {
							if (notificationWindow) {
								notificationWindow.close();
							} else {
								noEventsToDismiss = true;
							}
						} else if (desktopNotification == "rich") {
							if (notificationsOpened.length) {
								closeNotifications(notificationsOpened);
							} else {
								noEventsToDismiss = true;
							}
						} else if (desktopNotification == "popupWindow") {
							chrome.runtime.sendMessage({action: "dismissAll"});
						}
						
						if (noEventsToDismiss) {
							shortcutNotApplicableAtThisTime("No events to dismiss");
						}
					}
				});
			}
	
			// check to see notifications are supported by browser			
			// html notif
			var desktopNotification = storage.get("desktopNotification"); // default is html (now it's rich)
			
			if (chrome.notifications) {
				
				// clicked anywhere
				chrome.notifications.onClicked.addListener(function(notificationId) {
					console.log("notif onclick", notificationId);
					
					if (notificationId == "extensionUpdate") {
						openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog");
						chrome.notifications.clear(notificationId, function() {});
						sendGA("extensionUpdateNotification", "clicked notification");
					} else if (isNotificationAddedOutside(notificationId)) {
						var notificationObj = getNotificationObj(notificationId);
						var event = findEventById(notificationObj.eventId);
						openUrl(getEventUrl(event));
						chrome.notifications.clear(notificationId, function() {});
					} else if (notificationId == "message") {
						// nothing
					} else if (notificationId == "error") {
						openUrl("https://jasonsavard.com/forum/categories/checker-plus-for-google-calendar-feedback?ref=errorNotification");
						chrome.notifications.clear(notificationId, function() {});
						sendGA("errorNotification", "clicked button on notification");
					} else {
						ChromeTTS.stop();
						var notification = getNotification(notificationsOpened, notificationId);
						openReminders();
						sendGA('notificationButtonValue', "snoozeTimes", "anywhere");
					}
					
				});
				
				// buttons clicked
				chrome.notifications.onButtonClicked.addListener(function(notificationId, buttonIndex) {
					console.log("notif onbuttonclick:", notificationId, buttonIndex);
					
					if (notificationId == "extensionUpdate") {
						if (buttonIndex == 0) {
							openUrl("https://jasonsavard.com/wiki/Checker_Plus_for_Google_Calendar_changelog");
							chrome.notifications.clear(notificationId, function() {});
							sendGA("extensionUpdateNotification", "clicked button - see updates");
						} else if (buttonIndex == 1) {
							storage.enable("disabledExtensionUpdateNotifications");
							chrome.notifications.clear(notificationId, function(wasCleared) {
								if (lastExtensionUpdateNotificationShownDate.diffInSeconds() < -7) { // 25 seconds is approx. the time it takes for the notification to hide, after that let's use the window technique
									openTemporaryWindowToRemoveFocus();
								}
							});
							sendGA("extensionUpdateNotification", "clicked button - do not show future notifications");
						}
					} else if (notificationId == "message") {
						// nothing
					} else if (notificationId == "error") {
						openUrl("https://jasonsavard.com/forum/categories/checker-plus-for-google-calendar-feedback?ref=errorNotification");
						chrome.notifications.clear(notificationId, function() {});
						sendGA("errorNotification", "clicked button on notification");
					} else {
	
						ChromeTTS.stop();
						
						if (isNotificationAddedOutside(notificationId)) {
							var notificationObj = getNotificationObj(notificationId);
							var event = findEventById(notificationObj.eventId);						
							if (buttonIndex == 0) {
								deleteEvent(event).then(function() {
									chrome.notifications.clear(notificationId, function(wasCleared) {});
								}).catch(function(error) {
									alert("Error deleting event: " + error);
								});
							}
						} else {
	
							// patch: user might have re-toasted the notification by clicking the bell (before the notification had time to disappear naturally and therefore bypassing the openTemporaryWindowToRemoveFocus logic, so let's force it here
							if (notificationsOpened && notificationsOpened.length == 0) {
								console.log("patch: user might have re-toasted the notification by clicking the bell so let's force call the openTemporaryWindow...");
								openTemporaryWindowToRemoveFocus();
								return;
							}
	
							var notification = getNotification(notificationsOpened, notificationId);
							if (!notification) {
								// only one notification then we aren't grouped 
								if (notificationsOpened.length == 1) {
									notification = notificationsOpened.first();
								}
							}
							
							var notificationButtonValue;
							
							var buttons;
							if (isGroupedNotificationsEnabled()) {
								buttons = notificationsOpened.first().buttons;
							} else {
								buttons = notification.buttons;
							}
							
							if (buttonIndex == 0) {
								notificationButtonValue = buttons[0].value;
							} else if (buttonIndex == 1) {
								notificationButtonValue = buttons[1].value;
							}
							
							console.log("notificationButtonValue", notificationButtonValue);
							
							if (notificationButtonValue == "dismiss") {
								// dismiss
								console.log("dismiss");
								if (isGroupedNotificationsEnabled()) {
									sendGA('notificationButtonValue', notificationButtonValue, buttonIndex, notificationsOpened.length);
									closeNotifications(notificationsOpened);
									if (remindersWindow) {
										closeReminders();
									}
								} else {
									closeNotifications([notification]);
									sendGA('notificationButtonValue', notificationButtonValue, buttonIndex, 1);
								}
							} else if (notificationButtonValue == "snoozeTimes") {
								openReminders();
								sendGA('notificationButtonValue', notificationButtonValue, buttonIndex);
							} else if (notificationButtonValue == "location|hangout") {
								var eventSource = getEventSource(notification.event);
								
								var hangoutLink = notification.event.hangoutLink;
								if (hangoutLink) {
									openUrl(hangoutLink);
								} else if (eventSource) {
									openUrl(eventSource.url);
								} else {
									openUrl(generateLocationUrl(notification.event));
								}
								sendGA('notificationButtonValue', notificationButtonValue, buttonIndex);
							} else if (notificationButtonValue == "reducedDonationAd") {
								storage.enable("reducedDonationAdClicked");
								openUrl("donate.html?ref=reducedDonationFromNotif");
								updateNotifications();
								sendGA('notificationButtonValue', notificationButtonValue, buttonIndex);
							} else {
								// snooze
								var unit = notificationButtonValue.split("_")[0];
								var delay = notificationButtonValue.split("_")[1];
								
								var snoozeParams = {};
								snoozeParams.source = "notificationButton";
								
								if (unit == "minutes") {
									snoozeParams.inMinutes = delay;
								} else if (unit == "hours") {
									snoozeParams.inHours = delay;
								} else if (unit == "days") {
									snoozeParams.inDays = delay;
								} else {
									logError("no unit in snooze: " + unit);
								}
								
								if (isGroupedNotificationsEnabled()) {
									sendGA('notificationButtonValue', "snooze", notificationButtonValue, notificationsOpened.length);
									snoozeNotifications(snoozeParams, notificationsOpened);
									if (remindersWindow) {
										closeReminders();
									}
								} else {
									snoozeNotifications(snoozeParams, [notification]);
									sendGA('notificationButtonValue', "snooze", notificationButtonValue, 1);
								}
							}
						}
					}
				});
				
				// closed notif
				chrome.notifications.onClosed.addListener(function(notificationId, byUser) {
					if (notificationId == "extensionUpdate") {
						if (byUser) {
							sendGA("extensionUpdateNotification", "closed notification");
						}
					} else if (notificationId == "message") {
						// nothing
					} else if (notificationId == "error") {
						// nothing
					} else {				
						if (byUser) { // byUser happens ONLY when X is clicked ... NOT by closing browser, NOT by clicking action buttons, NOT by calling .clear
							console.log("notif onclose", notificationId, byUser);
							ChromeTTS.stop();
							
							if (isNotificationAddedOutside(notificationId)) {
								// do nothing
							} else {
								var notification = getNotification(notificationsOpened, notificationId);
								
								if (isGroupedNotificationsEnabled()) {
									sendGA('notificationButtonValue', "dismissedByClosing", "grouped", notificationsOpened.length);
									closeNotifications(notificationsOpened, {skipNotificationClear:true});
									if (remindersWindow) {
										closeReminders();
									}
								} else {
									sendGA('notificationButtonValue', "dismissedByClosing", "individual", 1);
									closeNotifications([notification], {skipNotificationClear:true});
								}
							}
						}
					}
				});
			}
			
			setOmniboxSuggestion();
			if (chrome.omnibox) {
				chrome.omnibox.onInputEntered.addListener(function(text) {
					getActiveTab(function(tab) {
						var eventEntry = new EventEntry();			
						eventEntry.summary = text;
						eventEntry.allDay = true;  
						
						performActionOutsideOfPopup(eventEntry);
					});
				});
			}
			
			if (chrome.alarms) {
				chrome.alarms.onAlarm.addListener(function(alarm) {
					if (alarm.name == "checkEvents") {
						checkEvents({source:"interval"});
					} else if (alarm.name == "extensionUpdatedSync") {
						syncOptions.save("extensionUpdatedSync");
					} else if (alarm.name == "updateSkins") {
						console.log("updateSkins...");
						
						var skinsIds = [];
						var skinsSettings = storage.get("skins");
						skinsSettings.forEach(function(skin) {
							skinsIds.push(skin.id);
						});
						
						if (skinsIds.length) {
							Controller.getSkins(skinsIds, storage.get("_lastUpdateSkins")).then(function(skins) {
								console.log("skins:", skins);
								
								var foundSkins = false;
								skins.forEach(function(skin) {
									skinsSettings.some(function(skinSetting) {
										if (skinSetting.id == skin.id) {
											foundSkins = true;
											console.log("update skin: " + skin.id);
											copyObj(skin, skinSetting);
											//skinSetting.css = skin.css;
											//skinSetting.image = skin.image;
											return true;
										}
									});
								});
								
								if (foundSkins) {
									storage.set("skins", skinsSettings);
								}
								
								storage.setDate("_lastUpdateSkins");
							});
						}
					}
				});
			}
			
			if (chrome.storage) {
				chrome.storage.onChanged.addListener(function(changes, namespace) {
					if (namespace == "local") {
						for (key in changes) {
							var storageChange = changes[key];
							if (key != "cachedFeeds" && !key.startsWith("_")) {
								console.log('Storage key "%s" in namespace "%s" changed. ' + 'Old: "%s", New "%s".',
										key,
										namespace,
										storageChange.oldValue,
										storageChange.newValue);
							}

							// ignore tokenResponse if we are just updating the token, but do sync if it's added or removed
							if (key == "tokenResponses" && storageChange.oldValue && storageChange.newValue) {
								// do nothing
							} else {
								syncOptions.storageChanged({key:key});
							}
				        }
					}
				});
			}
			
			chrome.browserAction.setBadgeBackgroundColor({color:[180, 180, 180, 255]});
			chrome.browserAction.setBadgeText({text : "..."});
			
			forgottenReminderAnimation = new IconAnimation("images/bell_badge.png");
			
			if (chrome.idle.setDetectionInterval) {
				chrome.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL);
			}
			
			if (chrome.idle.onStateChanged) {
				chrome.idle.onStateChanged.addListener(function(newState) {
					if (newState == "active") {
						console.log("idle state change: " + newState);
						// re-toast grouped notifications if different from count when idle
						console.log("idle test: " + notificationsOpened.length + " " + notificationsOpenedCountWhenIdle);
						if (notificationsOpened.length >= 1 && notificationsOpenedCountWhenIdle >= 1) {
							console.log("new notif since idle re-toast notifs");
							if (notificationsQueue.length >= 1) {
								console.log("new notif since idle queue: " + notificationsQueue.length);
								
								if ((storage.get("desktopNotification") == "text" || storage.get("desktopNotification") == "rich") && isGroupedNotificationsEnabled()) {
									retoastNotifications();
								} else if (storage.get("desktopNotification") == "popupWindow") {
									chrome.windows.update(remindersWindow.id, {focused:true});
								}
								// reset the count
								notificationsOpenedCountWhenIdle = 0;
							}
						}
					}
				});
			}
			
			eventsShown = storage.get("eventsShown");
			initEventDates(eventsShown);
	
			cachedFeeds = storage.get("cachedFeeds");
			
			// This is used to poll only once per second at most, and delay that if
			// we keep hitting pages that would otherwise force a load.
			chrome.tabs.onUpdated.addListener(function onTabUpdated(tabId, changeInfo, tab) {
				
				//console.log("onupdated: " + tab.url + " == " + tab.title);
				if (changeInfo.status == "loading") {
					var url = changeInfo.url;
					if (!url) {
						return;
					}
				} else if (changeInfo.status == "complete") {
					// find code window and make sure its from this extension by matching the state
					if (tab.url.indexOf("https://accounts.google.com/o/oauth2/approval") != -1 && tab.title.indexOf("state=" + oAuthForDevices.getStateParam()) != -1) {
						var progress = new ProgressNotification();
						if (tab.title.match(/success/i)) {
							var code = tab.title.match(/code=(.*)/i);
							if (code && code.length != 0) {
								code = code[1];
								chrome.tabs.remove(tabId);
								progress.show();
								oAuthForDevices.getAccessToken(code).then(oauthResponse => {
									if (!storage.get("verifyPaymentRequestSent")) {
										Controller.verifyPayment(ITEM_ID, oauthResponse.tokenResponse.userEmail, function(response) {
											if (response && response.unlocked) {
												Controller.processFeatures();
											}
										});
										storage.enable("verifyPaymentRequestSent");
									}
									
									return fetchCalendarSettings({grantingAccess:true, email:oauthResponse.tokenResponse.userEmail}).then(response => {
										chrome.runtime.sendMessage({command: "grantPermissionToCalendars", email:response.roundtripArg});
										return pollServer().then(function() {
											chrome.runtime.sendMessage({command: "grantPermissionToCalendarsAndPolledServer", email:response.roundtripArg});
										});
									});
								}).then(() => {
									// only display "click popup" message if popup is not visible (ie. Mac or Windows 7 users)
									if (chrome.extension.getViews({type:"popup"}).length) {
										progress.cancel();
									} else {
										progress.complete(getMessage("accessGranted"));
									}
								}).catch(error => {
									progress.cancel();
									if (error != "Denied") {
										showCouldNotCompleteActionNotification(error);
										logError(error);
									}
								});
							} else {
								var error = "error: code not found, please try again!";
								logError(error)
								alert(error);
							}
						} else if (tab.title.match(/denied/i)) {
							chrome.tabs.remove(tabId);
							openUrl("https://jasonsavard.com/wiki/Granting_access?ref=permissionDenied&ext=calendar&state=" + encodeURIComponent(oAuthForDevices.getStateParam()) + "&title=" + encodeURIComponent(tab.title));
						} else {
							logError("oauth response title: " + tab.title);
							alert("error " + tab.title + " please try again or try later!");
						}
					}
				}				
	
			});
			
			if (!chrome.runtime.onMessage || !chrome.storage) {
				openUrl("https://jasonsavard.com/wiki/Old_Chrome_version");
			}
			
			chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
				console.log("onMessage");
				switch (request.name) {
					case "ping":
						sendResponse({message:"i'm alive"});
						break;
					case "test":
						sendResponse({test:"yes", date:new Date().toJSON()});
						break;
					case "getBGObjects":
						console.time("bg: getBGObjects");
						
						// commented out becaus $.extend cannot clone objects constructed via new SnoozerObj(args) etc. so instead i'm using json.stringify/parse 
						//var stringifiedEvents = $.extend(true, [], events);
						var stringifiedEvents = JSON.parse(JSON.stringify(events));
						//var stringifiedSnoozers = $.extend(true, [], snoozers);
						var stringifiedSnoozers = JSON.parse(JSON.stringify(storage.get("snoozers")));
						
						console.timeEnd("bg: getBGObjects");
						
						sendResponse({
							events: stringifiedEvents,
							snoozers: stringifiedSnoozers,
							email: email,
							storage: storage,
							cachedFeeds: cachedFeeds,
							arrayOfCalendars: getArrayOfCalendars(),
							notificationsQueue: notificationsQueue,
							notificationsOpened: notificationsOpened,
							loggedOut: loggedOut
						});
						break;
					case "oauthDeviceFindTokenResponse":
						sendResponse(oAuthForDevices.findTokenResponse({userEmail:request.email}));
						break;
					case "oauthDeviceSend":
						console.log("bg: oauthDeviceSend");
						oAuthForDevices.send(request.sendParams).then(response => {
							sendResponse(response);
						}).catch(error => {
							sendResponse({error:error});
						});
						break;
					case "updateSnoozer":
						var snoozers = storage.get("snoozers");
						snoozers.some(function(snoozer, index) {
							if (snoozer.event.id == request.eventId) {
								snoozer.time = request.time.parseDate();
								return true;
							}
						});
						storage.set("snoozers", snoozers);
						sendResponse();
						break;
					case "removeSnoozer":
						var snoozers = storage.get("snoozers");
						snoozers.some(function(snoozer, index) {
							if (snoozer.event.id == request.eventId) {
								snoozers.splice(index, 1);
								return true;
							}
						});
						storage.set("snoozers", snoozers);
						sendResponse();
						break;
					case "pollServer":
						pollServer(request.params).then(function(response) {
							sendResponse(response);
						}).catch(function(error) {
							sendResponse({error:error});
						});
						break;
					case "fetchEvents":
						console.time("fetchAllCalendarEvents");
						
						request.params.startDate = request.params.startDate.parseDate();
						request.params.endDate = request.params.endDate.parseDate();
						
						fetchAllCalendarEvents(request.params).then(response => {
							sendResponse(JSON.stringify(response));
						}).catch(error => {
							sendResponse({error:error});
						});
						break;
					case "openTab":
						openUrl(request.url);
						break;
					case "deleteEvent":
						console.log("bg deleteEvent", request);
						deleteEvent(request).then(function(response) {
							sendResponse(response);
						}).catch(error => {
							sendResponse({error:error});
						});
						break;
					case "generateActionLink": // used internally from widgets
						var eventEntry = request.eventEntry;
						var actionLinkObj = generateActionLink("TEMPLATE", eventEntry);
						var url = actionLinkObj.url + "?" + actionLinkObj.data;
						sendResponse({url:url});
						break;
				}
				return true;
			 });
			
		    // Check current time and calculate the delay until next interval
		    var delay = CHECK_EVENTS_INTERVAL - Date.now() % CHECK_EVENTS_INTERVAL;
		    
		    // if next minute is too close then wait for next minute
		    if (delay < seconds(5)) {
		    	delay += minutes(1);
		    }
	    	chrome.alarms.create("checkEvents", {when:Date.now() + delay, periodInMinutes:CHECK_EVENTS_INTERVAL / minutes(1)});
			
			// start this 30 seconds later so that we don't flicker the notifications immediately after displaying them
			setTimeout(function() {
				// update snooze notifiation times
				setIntervalSafe(function() {
					var desktopNotification = storage.get("desktopNotification");
					if (desktopNotification == "rich") {
						updateNotifications();
					}
				}, minutes(1));
			}, seconds(30));
			
			// is iselibigable for reduced donations than make sure user hasn't contributed before, if so do not display this eligable notice
			setIntervalSafe(function() {
				if (!storage.get("donationClicked") && !storage.get("verifyPaymentRequestSentForReducedDonation") && email) {
	
					// check sometime within 7 days (important *** reduce the load on my host)
					if (passedRandomTime("randomTimeForVerifyPayment", 7)) {
						Controller.verifyPayment(ITEM_ID, email, function(response) {
							if (response && response.unlocked) {
								Controller.processFeatures();
							}
						});
						storage.enable("verifyPaymentRequestSentForReducedDonation");
					}
				}
			}, minutes(5));
			
			// do this every day so that the daysellapsed is updated in the uninstall url
			setIntervalSafe(function() {
				setUninstallUrl(email);
			}, days(1));
			
			// collect stats on options
			if (daysElapsedSinceFirstInstalled() > 14 && (!storage.get("lastOptionStatsSent") || storage.get("lastOptionStatsSent").diffInDays() <= -7)) { // start after 2 weeks to give people time to decide and then "every" 7 days after that (to keep up with changes over time)
				console.log("collecting optstats soon...")
				setTimeout(function() { // only send after a timeout make sure ga stats loaded
					console.log("collecting optionstats")
					
					var optionStatCounter = 1;
					
					function sendOptionStat(settingName, defaultValue) {
						var settingValue = storage.get(settingName, defaultValue);
						
						// Convert booleans to string because google analytics doesn't process them
						if (settingValue === true) {
							settingValue = "true";
						} else if (settingValue === false || settingValue == null) {
							settingValue = "false";
						}
						
						// issue: seems like the 1st 10 are being logged only in Google Analytics - migth be too many sent at same time
						// so let's space out the sending to every 2 seconds
						setTimeout(function() {
							sendGA("optionStats", settingName, settingValue);
						}, optionStatCounter++ * seconds(2));
					}
					
					var calendarViewStr = storage.get("calendarView");
					if (calendarViewStr == CalendarView.AGENDA) {
						calendarViewStr = "agenda";
					}
					sendOptionStat("calendarView", calendarViewStr);
					
					sendOptionStat("notificationSound", "ding.ogg"); // sound
					sendOptionStat("notificationVoice"); // voice
					sendOptionStat("desktopNotification", true); // desktop
					sendOptionStat("donationClicked");
					sendOptionStat("badgeIcon", "default");
					
					storage.setDate("lastOptionStatsSent");
					
				}, minutes(2));
			}
			
			// must catch error here because it could just be regular timeout error that we don't want user re-installing extension for.
			return pollServer().catch(error => {
				showMessageNotification("Problem starting extension", "Open popup window to solve it", error);
			});
		});
	}, error => { // Note: this is the 2nd parameter of a promise.then(resolve, reject)
		logError("init settings error: " + error, error);
		alert("The 'Checker Plus for Google Calendar' extension could not load because your browser profile is corrupt. You can fix and remove this message by clicking Ok and follow the instructions in the tab that will open, or just uninstall this extension.");
		openUrl("https://jasonsavard.com/wiki/Corrupt_browser_profile?source=calendar_corruption_detected");
	}).catch(error => {
		logError("starting extension: " + error, error);
		showMessageNotification("Problem starting extension", "Try re-installing the extension.", error);
	});

	$(window).on("offline online", function(e) {
		console.log("offline/online detected", e);
		if (e.type == "online") {
			
		}
		updateBadge();
	});
});