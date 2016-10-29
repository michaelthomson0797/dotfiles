// Copyright 2016 Jason Savard

var ITEM_ID = "calendar";

var TEST_REDUCED_DONATION = false;

var FACEBOOK_PERMISSION_HOST = "*://*.facebook.com/*"; // MUST MATCH what is in manifest for optional_permissions

var ExtensionId = {};
ExtensionId.Gmail = "oeopbcgkkoapgobdbedcemjljbihmemj";
ExtensionId.Calendar = "hkhggnncdpfibdhinjiegagmopldibha";
ExtensionId.LocalGmail = "pghicafekklkkiapjlojhgdokkegilki";
ExtensionId.LocalCalendar = "pafgehkjhhdiomdpkkjhpiipcnmmigcp";

var CalendarView = {};
CalendarView.AGENDA = "basicDay";
CalendarView.DAY = "agendaDay";
CalendarView.WEEK = "agendaWeek";
CalendarView.MONTH = "month";
CalendarView.FOUR_WEEKS = "fourWeeks";

var NotificationType = {};
NotificationType.ADDED_OUTSIDE = "ADDED_OUTSIDE";

var JError = {};
JError.DID_NOT_CONTRIBUTE = "DID_NOT_CONTRIBUTE";

var BrowserButtonAction = {};
BrowserButtonAction.POPUP = "popup";
BrowserButtonAction.CHECKER_PLUS_TAB = "checkerPlusTab";
BrowserButtonAction.GOOGLE_CALENDAR = "googleCalendar";

var GOOGLE_API_DATE_ONLY_FORMAT_STR = "yyyy-mm-dd";

var STORAGE_DEFAULTS = {
	"browserButtonAction": "popup",		
	"cachedFeeds": {},
	"eventsShown": [],
	"tokenResponses": [],
	"selectedCalendars": {},
	"excludedCalendars": ["p#weather@group.v.calendar.google.com"],
	"notificationSound": "ding.ogg",
	"notificationSoundVolume": 100,
	"voiceNotificationOnlyIfIdleInterval": 15,
	"voiceSoundVolume": 100,
	"desktopNotification": "popupWindow",
	"calendarView": "month",
	"lang": window.navigator.language,
	"pitch": 1,
	"rate": 1,
	"notificationGrouping": "groupNotifications",
	"showNotificationDuration": "never",
	"pendingNotificationsInterval": 15,
	"notificationButton1": "hours_1",
	"notificationButton2": "location|hangout",
	"showCalendarInNotification": "onlyNonPrimary",
	"showContextMenuItem": true,
	"maxDaysAhead": 2,
	"weeksInMonth": "auto",
	"customView": "4",
	"slotDuration": 30,
	"hideMorningHoursBefore": "0",
	"hideNightHoursAfter": "24",
	"badgeIcon": "default",
	"showEventTimeOnBadge": true,
	"showMinutesLeftInBadge": true,
	"showDaysLeftInBadge": true,
	"showDayOnBadgeExceptWhenMinutesLeft": true,
	"showButtonTooltip": true,
	"excludeHiddenCalendarsFromButton": true,
	"showSnoozedEvents": true,
	"weekNumberCalculation": "ISO",
	"widgetWidth": 1,
	"widgetHeight": 2,
	"weekNumberCalculation": "ISO",
	"snoozers": [],
	"calendarSettings": {},
	"skins": [],
	"skinsEnabled": true,
	"customSkin": {id:"customSkin"},
	"END": "END"
};

var STORAGE_ITEMS_TO_COMPRESS = {
	"cachedFeeds": true
}
	
if (typeof(bg) == "undefined") {
	bg = window;
}

function isNotificationAddedOutside(notificationId) {
	return notificationId && notificationId.indexOf(NotificationType.ADDED_OUTSIDE) != -1;
}

function EventEntry(summary, startTime, description, calendar) {
	this.summary = summary;
	if (startTime) {
		this.startTime = startTime;
	} else {
		// commented out because it was prefixing my quickadd "details" attribute with the date ex. 2011/01/02 + title
		//this.startTime = new Date();
	}
	this.description = description;
	this.calendar = calendar	
	this.quickAdd = true;
}

function saveEvent(eventEntry) {
	return new Promise((resolve, reject) => {
		// If today then processing quick add entry for min or hours etc..
		if (eventEntry.quickAdd && (!eventEntry.startTime || eventEntry.startTime.isToday())) {
			var processedEventEntry = getEventEntryFromQuickAddText(eventEntry.summary);
			eventEntry.summary = processedEventEntry.summary;
			eventEntry.startTime = processedEventEntry.startTime;
		}

		postToGoogleCalendar(eventEntry).then(response => {
			console.log("postToGoogleCalendar", response);
			resolve(response);
		}).catch(error => {
			reject(error);
		});		
	});
}

// Seems when adding all day event to the CURRENT DAY - Google api would register the event as a timed event (saved to the current time) - so let's update the event to save it as an all day event
function ensureQuickAddPatchWhenAddingAllDayEvent(params) {
	return new Promise(function(resolve, reject) {
		console.log("ensureQuickAddPatchWhenAddingAllDayEvent");
		if (params.originalEventEntry.allDay && params.originalEventEntry.summary == params.eventEntry.summary && params.eventEntry.startTime && Math.abs(params.eventEntry.startTime.diffInMinutes()) <= 2) {
			
			// 1st patch: make sure it's all day
			params.eventEntry.allDay = true;
			params.patchFields = generateGoogleCalendarEvent(params.eventEntry);
			
			console.log("evententry", params.eventEntry);
			console.log("patchfields", params.patchFields);
			
			updateEvent(params).then(function(response) {
				response.secondPass = true;
				resolve(response);
			}).catch(function(error) {
				reject(error);
			});
		} else {
			console.log("2nd part", params.eventEntry);
			resolve(params.response);
		}
	});
}

function addDaysToEventEntry(eventEntry, newStartTime) {
	newStartTime.setHours(eventEntry.startTime.getHours());
	newStartTime.setMinutes(eventEntry.startTime.getMinutes());
	newStartTime.setSeconds(eventEntry.startTime.getSeconds());
	var newEndTime = calculateNewEndTime(eventEntry.startTime, eventEntry.endTime, newStartTime);
	eventEntry.startTime = newStartTime;
	eventEntry.endTime = newEndTime;
}

function ensureEventStartTimeIsNotInThePast(eventEntry, response) {
	console.log("ensureEventStartTimeIsNotInThePast");
	
	return new Promise(function(resolve, reject) {
		if (eventEntry.inputSource == "QUICK_ADD" && eventEntry.startTime.getTime() < Date.now()) {
			delete eventEntry.inputSource;
			new Promise((resolve, reject) => {
				if (eventEntry.startTime.isToday()) {
					openGenericDialog({
						content: getMessage("addedTimedEventInThePast"),
						showCancel: true
					}).then(function(response) {
						if (response == "ok") {
							addDaysToEventEntry(eventEntry, tomorrow());
						}
						resolve();
					});
				} else {
					// move it to next week
					addDaysToEventEntry(eventEntry, eventEntry.startTime.addDays(7));
					resolve();
				}
			}).then(() => {
				var patchFields = {};
				patchFields.start = {};
				if (eventEntry.allDay) {
					patchFields.start.date = eventEntry.startTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR);
				} else {
					patchFields.start.dateTime = eventEntry.startTime.toRFC3339();
				}
				if (eventEntry.endTime) {
					patchFields.end = {};
					if (eventEntry.allDay) {
						patchFields.end.date = eventEntry.endTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR);
					} else {
						patchFields.end.dateTime = eventEntry.endTime.toRFC3339();
					}
				}
				
				return updateEvent({eventEntry:eventEntry, event:response.data, patchFields:patchFields}).then(function(response) {
					response.secondPass = true;
					resolve(response);
				});
			}).catch(error => {
				reject(error);
			});
		} else {
			resolve(response);
		}
	});
}

// since we couldn't add a description with the quickadd method let's pass a 2nd time to add the description by updating the recently created event
function ensureAllEventDetailsSavedAfterQuickAdd(params) { //calendarId, eventEntry, response
	return new Promise(function(resolve, reject) {
		console.log("ensurequickadd details allday: " + params.eventEntry.allDay)
		console.log("ensurequickadd details startt: " + params.eventEntry.startTime)
		if (params.eventEntry.location || params.eventEntry.colorId || params.eventEntry.description || params.eventEntry.reminders || params.nonEnglishWithStartTime) {
			console.log("ensureAllEventDetailsSavedAfterQuickAdd", params.eventEntry);
			
			params.patchFields = generateGoogleCalendarEvent(params.eventEntry);
			
			updateEvent(params).then(function(response) {
				response.secondPass = true;
				resolve(response);
			}).catch(function(error) {
				reject(error);
			});
		} else {
			resolve(params.response);
		}
	});
}

// in minutes
function getDefaultEventLength() {
	var defaultEventLength = storage.get("calendarSettings").defaultEventLength;
	if (defaultEventLength) {
		return parseInt(defaultEventLength);
	} else {
		return 60; // 60 minutes
	}
}

function googleCalendarParseString(params, callback) {
	if (!params.text) {
		callback({error:"JERROR: text parameter missing"});
		return;
	}
	
	var data = {ctext:params.text};
	if (params.startTime) {
		data.stim = params.startTime.format("yyyymmdd");
		if (params.endTime) {
			data.etim = params.endTime.format("yyyymmdd");
		} else {
			data.etim = data.stim;
		}
	}
	
	$.ajax({
		url: "https://calendar.google.com/calendar/compose",
		type: "POST",
		data: data,
		dataType: "text",
		timeout: seconds(7),
		complete: function(request, textStatus) {
			if (textStatus == "success") {
				var result = request.responseText;
				// allday: ")]}'↵[['qa','test','','','20140618','20140618',[],'','']]
				// timed:  ")]}'↵[['qa','test','','','20140610T150000','20140610T160000',[],'','']]"
				try {
					result = result.split("'");
					
					var summary = result[4];
					summary = summary.replaceAll("\\46", "&");
					summary = htmlToText(summary);
	
					var resultObj = {summary:summary};
					
					var startTimeStr = result[10];
					
					// if NO time in string ie. 20140618 vs 20140610T150000 then this is an all day event
					if (startTimeStr.indexOf("T") == -1) {
						resultObj.allDay = true;
					}

					// if times return ????????T?????? then there is not time that was parsed
					if (startTimeStr.indexOf("??") == -1) {
						resultObj.startTime = startTimeStr.parseDate();
						// seems that end time does not get set when using this google calendar post technique
						//resultObj.endTime = result[12].parseDate();
						if (params.endTime) {
							resultObj.endTime = params.endTime;
						}
					}
					callback(resultObj);
				} catch (e) {
					callback({error:e});
				}
			} else {
				callback({error:textStatus});
			}
		}
	});
}

function generateGoogleCalendarEvent(eventEntry) {
	var data = {};
	
	data.summary = eventEntry.summary;
	data.description = eventEntry.description; //.replace(/&/ig, "&amp;")
	
	if (eventEntry.source && eventEntry.source.url && (eventEntry.source.url.indexOf("chrome://") == 0 || isInternalPage(eventEntry.source.url))) {
		console.warn("Google Calendar API does not allow chrome-extension:// in source, so excluding it");
	} else {
		data.source = eventEntry.source;
	}
	
	// if string form is passed then push direction to object (this is used for facebook event add from ics file
	// startTimeStr from ics can equal... DTSTART:20121004 or DTSTART:20121014T003000Z
	if (eventEntry.allDay) {
		data.start = {
			date: eventEntry.startTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR),
			dateTime: null
		}
		if (!eventEntry.endTime) {
			eventEntry.endTime = new Date(eventEntry.startTime);
			eventEntry.endTime.setDate(eventEntry.endTime.getDate()+1);
		}
		
		// patch seems quick add would register enddate same as startdate, for all day event it should end on the next day so let's force that
		if (eventEntry.startTime.isSameDay(eventEntry.endTime)) {
			console.log("end time patch")
			eventEntry.endTime = eventEntry.startTime.addDays(1);
		}
		
		data.end = {
			date: eventEntry.endTime.format(GOOGLE_API_DATE_ONLY_FORMAT_STR),
			dateTime: null
		}
	} else {
		data.start = {
			date: null,
			dateTime: eventEntry.startTime.toRFC3339()
			// 2012-12-17T17:54:00Z
		}
		// if none set must put it's duration atleast an 1 long
		if (!eventEntry.endTime) {
			eventEntry.endTime = new Date(eventEntry.startTime);
			eventEntry.endTime.setMinutes(eventEntry.endTime.getMinutes() + getDefaultEventLength());
		}
		data.end = {
			date: null,
			dateTime: eventEntry.endTime.toRFC3339()
		}
	}
	
	data.location = eventEntry.location;
	data.colorId = eventEntry.colorId;
	data.reminders = eventEntry.reminders;
	
	if (eventEntry.extendedProperties) {
		data.extendedProperties = eventEntry.extendedProperties;
	}
	
	return data;
}

function postToGoogleCalendar(eventEntry) {
	return new Promise((resolve, reject) => {
		if (eventEntry.quickAdd) {
			var title;
			// if no date set and it's all day then we must push the date into the quickadd to force to be an all day event
			if (!eventEntry.startTime && eventEntry.allDay) {
				eventEntry.startTime = new Date();
			}
			
			var nonEnglishWithStartTime = false;
			var originalEventEntry = clone(eventEntry);
			
			// if not today than skip this if statement because if a user types "tomorrow" or "tuesday" we can't add also the date to the quick add statement ie. conflicting statement... (tomorrow test 12/12/20012
			if (eventEntry.startTime && !eventEntry.startTime.isToday()) {
				// it seems that if we are not in english than quickAdd can only save the time or the date but not both! so let's quick add the event so quickadd recognizes the time string and then pass a 2nd time to update it to the proper date
				if (/en/.test(storage.get("calendarSettings").calendarLocale)) { // will also match en_GB
					format = "m/d/yyyy";
					// german: format = "yyyy/m/d";
					title = eventEntry.summary + " " + eventEntry.startTime.format(format);
				} else {
					nonEnglishWithStartTime = true;
					title = eventEntry.summary;
				}				
			} else {
				title = eventEntry.summary;
			}
			
			var calendarId = getCalendarId(eventEntry)
			
			console.log("allday", eventEntry.allDay)
			
			var sendParams = {
				userEmail: email,
				type: "post",
				url: "/calendars/" + encodeURIComponent(calendarId) + "/events/quickAdd",
				data: {
					text: title
				}
			};

			oauthDeviceSend(sendParams).then(function(response) {
				initEventObj(response.data);
				copyObj(response.data, eventEntry);
				console.log("start", eventEntry)
				if (nonEnglishWithStartTime) {
					console.log("non english with time")
					// determine if time was matched in the text sent to quickadd: it would be extracted from the summary in the result and thus means time was once present
					if (originalEventEntry.summary != eventEntry.summary) {
						// timed event
						eventEntry.allDay = false;
						eventEntry.startTime.setDate(originalEventEntry.startTime.getDate());
						eventEntry.startTime.setMonth(originalEventEntry.startTime.getMonth());
						eventEntry.startTime.setFullYear(originalEventEntry.startTime.getFullYear());
						if (originalEventEntry.endTime) {
							eventEntry.endTime.setDate(originalEventEntry.endTime.getDate());
							eventEntry.endTime.setMonth(originalEventEntry.endTime.getMonth());
							eventEntry.endTime.setFullYear(originalEventEntry.endTime.getFullYear());
						} else {
							eventEntry.end = null;
							eventEntry.endTime = null;
						}
					} else {
						// allday event
						eventEntry.allDay = true;
						eventEntry.startTime = originalEventEntry.startTime;
						eventEntry.endTime = originalEventEntry.endTime;
					}
					console.log("re-evententry:", eventEntry)
				}
				
				// if we passed in reminders we must set them again to the eventEntry, or else the current reminders are returned from the newy created object 
				eventEntry.reminders = originalEventEntry.reminders;
				return ensureQuickAddPatchWhenAddingAllDayEvent({originalEventEntry:originalEventEntry, eventEntry:eventEntry, response:response, event:response.data});
			}).then(function(response) {
				return ensureEventStartTimeIsNotInThePast(eventEntry, response);
			}).then(function(response) {
				return ensureAllEventDetailsSavedAfterQuickAdd({eventEntry:eventEntry, response:response, event:response.data, nonEnglishWithStartTime:nonEnglishWithStartTime});
			}).then(function(response) {
				if (response.secondPass) {
					initEventObj(response.data);
					copyObj(response.data, eventEntry);
				}
				resolve(response);
			}).catch(function(error) {
				console.error("postToGoogleCalendar2", error);
				reject(error);
			});
		} else {
			var data = generateGoogleCalendarEvent(eventEntry);
			var calendarId = getCalendarId(eventEntry)

			var sendParams = {
				userEmail: email,
				type: "post",
				contentType: "application/json; charset=utf-8",
				url: "/calendars/" + encodeURIComponent(calendarId) + "/events",
				data: JSON.stringify(data)
			};
			oauthDeviceSend(sendParams).then(function(response) {
				initEventObj(response.data);
				copyObj(response.data, eventEntry);
				resolve(response);
			}).catch(function(error) {
				reject(error);			
			});
		}		
	});
}

// patch because chrome.runtime.sendmessage cannot send and receive in same context - so this chooses to either use a) if in bg - direct call to oauthdirect or b) chrome.runtime.sendmessage (if in ie popup)
function oauthDeviceSend(sendParams) {
	return new Promise(function(resolve, reject) {
		if (window.bg && window.bg.oAuthForDevices) {
			bg.oAuthForDevices.send(sendParams).then(response => {
				resolve(response);
			}).catch(error => {
				reject(error);
			});
		} else {
			chrome.runtime.sendMessage({name: "oauthDeviceSend", sendParams:sendParams}, function(response) {
				if (response.error) {
					reject(response.error);
				} else {
					resolve(response);
				}
			});
		}
	});
}

function ensureSameCalendar(params) {
	return new Promise(function(resolve, reject) {
		console.log("ensureSameCalendar", params);
		if (params.oldCalendarId && params.newCalendarId && params.oldCalendarId != params.newCalendarId) {
			console.log("move calendar");
			var sendParams = {
				userEmail: email,
				type: "post",
				contentType: "application/json; charset=utf-8",
				url: "/calendars/" + encodeURIComponent(params.oldCalendarId) + "/events/" + (params.changeAllRecurringEvents ? params.event.recurringEventId : params.event.id) + "/move?destination=" + encodeURIComponent(params.newCalendarId)
			};
			
			oauthDeviceSend(sendParams).then(function(response) {
				initEventObj(response.data);
				if (params.event) {
					copyObj(response.data, params.event);
					// add new calendar
					params.event.calendar = getCalendarById(params.newCalendarId);
				}
				resolve(response);
			}).catch(function(error) {
				reject(error);
			});
		} else {
			resolve();
		}
	});
}

function ensureRecurringEventPrompt(params) {
	return new Promise(function(resolve, reject) {
		if (params.event.recurringEventId) {
			openGenericDialog({
				title: getMessage("recurringEvent"),
				content: getMessage("recurringEventPrompt"),
				okLabel: getMessage("onlyThisEvent"),
				otherLabel: getMessage("allEvents")
			}).then(function(response) {
				if (response == "ok") {
					// nothing
					resolve({});
				} else {
					$("#genericDialog")[0].close();
					resolve({changeAllRecurringEvents:true});
				}
			});
		} else {
			resolve({});
		}
	});
}

// old way of using udpatevent was just passing an eventEntry
// new way is passing the google calendar event object and passing fields to change
function updateEvent(params) {
	return new Promise(function(resolve, reject) {
		var data;
		if (params.patchFields) {
			data = params.patchFields;
		} else {
			data = generateGoogleCalendarEvent(params.eventEntry);
		}
		
		var calendarId;
		var oldCalendarId;
		var newCalendarId;
		
		if (params.event && params.event.calendar) {
			calendarId = params.event.calendar.id;
			oldCalendarId = calendarId;
		}
		
		if (params.eventEntry && params.eventEntry.calendar) {
			calendarId = params.eventEntry.calendar.id;
			newCalendarId = calendarId;
		}
		
		if (!calendarId) {
			console.warn("no calenadrId, default to primary");
			calendarId = "primary";
		}
		
		var changeAllRecurringEvents;
		ensureRecurringEventPrompt(params).then(function(response) {
			changeAllRecurringEvents = response.changeAllRecurringEvents;
			return ensureSameCalendar({oldCalendarId:oldCalendarId, newCalendarId:newCalendarId, event:params.event, changeAllRecurringEvents:response.changeAllRecurringEvents});
		}).then(function() {
			var url = "/calendars/" + encodeURIComponent(calendarId) + "/events/" + (changeAllRecurringEvents ? params.event.recurringEventId : params.event.id);
			if (params.sendNotifications) {
				url += "?sendNotifications=true";
			}
			var sendParams = {
				userEmail: email,
				type: "patch",
				contentType: "application/json; charset=utf-8",
				url: url,
				data: JSON.stringify(data)
			};
			
			oauthDeviceSend(sendParams).then(function(response) {
				initEventObj(response.data);
				// copy new updated times/dates to event which was passed in the eventEntry
				if (params.event) {
					copyObj(response.data, params.event);
				}
				if (params.eventEntry && params.eventEntry.event) {
					copyObj(response.data, params.eventEntry.event);
				}
				resolve(response);
			}).catch(function(error) {
				reject(error);
			});
		}).catch(function(error) {
			reject(error);
		});
	});
}

function calculateNewEndTime(oldStartTime, oldEndTime, newStartTime) {
	if (oldEndTime) {
		var duration = oldEndTime.getTime() - oldStartTime.getTime();
		var newEndTime = new Date(newStartTime.getTime() + duration);
		return newEndTime;
	} else {
		return null;
	}
}

function getEventEntryFromQuickAddText(text) {
	// look for 'cook in 10 min' etc...
	var eventEntry = timeFilter(text, "min(ute)?s?", 1);
	if (!eventEntry || !eventEntry.summary) {
		eventEntry = timeFilter(text, "hours?", 60);
		if (!eventEntry || !eventEntry.summary) {
			var regex = new RegExp("^" + getMessage("tom") + ":")
			var matches = regex.exec(text);
			if (matches) {
				// remove the tom: etc.
				eventEntry = new EventEntry(text.replace(regex, ""), tomorrow());
			} else {
				eventEntry = new EventEntry(text);
			}
		}
	}
	return eventEntry;
}

function timeFilter(str, timeRegex, timeMultiplierForMinutes) {
	//var matches = title.match(/\b(in )?(\d*) ?min(ute)?s?\b/)
	var regexStr = "\\b ?(in |for )?(\\d*) ?" + timeRegex + "\\b";
	var matches = new RegExp(regexStr).exec(str)
	// look for a match and that not just the word 'min' was found without the number of minutes (##)etc..
	if (matches != null && matches[2]) {
		if (matches[1] == "for ") {
			// skip formatting title because this a quick add with a duration ie. dinner at 7pm for 30min
		} else {
			var time = matches[2];
			var extractedTitle = str.replace(matches[0], "");
			return formatTitle(extractedTitle, time * timeMultiplierForMinutes);
		}
	}
}

// returns the date and title object
function formatTitle(title, minutesToGo) {
	var newDate = new Date(Date.now() + 1000 * 60 * minutesToGo);
	var time = "";
	
	// patch for zh-cn and zh-tw because putting 2:00am or pm do not work, must use the chinese am/pm ie. 上午6:00 or 下午6:30
	if (storage.get("lang").indexOf("zh") != -1) {		
		if (newDate.getHours() < 12) {
			time = "上午"
		} else {
			time = "下午";
		}
		time += dateFormat(newDate, "h:MM")
	} else {
		time = dateFormat(newDate, "h:MMtt");
	}
	
	return new EventEntry(time + " " + title, newDate);
}

function cleanTitle(title) {
	// gmail email title ex. "Gmail - emailSubject - abc@def.com"
	// use this regex to get emailsubject from title				
	var matches = title.match(/^Gmail - (.*) - .*@.*/i);
	if (matches) {
		return matches[1];
	} else {
		return title;
	}
}

function prepContentForCreateEvent(title, description, url) {
	title = cleanEmailSubject(title);
	
	if (description) {
		description = htmlToText(description);
		description = $.trim(description);
		// trim line breaks
		description = trimLineBreaks(description);
		description = $.trim(description);
	}

	// Add link to email
	if (/\/\/mail.google.com/.test(url)) {
		var matches = url.match(/([0-9]*[a-z]*)*$/); // this will match the 133c67b2eadf9fff part of the email
		var emailLink;
		if (matches && matches[0].length >= 10) {
			emailLink = url;
		} else {
			emailLink = "https://mail.google.com/mail/#search/subject%3A+" + encodeURIComponent(title);
		}
		description = emailLink + "\n\n" + description;
	}
	
	return {title:title, description:description};
}

// if no "tab" passed then default to this page
function getEventDetailsFromPage(tab, callback) {

	var title, description, url;
	
	function finishProcessAndCallback() {
        // if page not responding or no details found then just spit out title and url
    	if (!title) {
	    	console.log("timeout no title");
    		title = cleanEmailSubject(cleanTitle(tab.title));
    		description = tab.url;
    	}
    	callback({title:title, description:description, url:url});		
	}
	
	if (tab) {
		// commented this code because after a while it would seem the connection was lost
		// Try pinging the page for details
		/*
		var port = chrome.tabs.connect(tab.id, {name: "eventDetailsChannel"});						
		console.log("eventDetailsChannel");
	    port.onMessage.addListener(function(response) {
	    	console.log("response: ", response);
	    	// If title found from within webpage (like in a Gmail email)...
	    	if (response.title) {
	    		var content = prepContentForCreateEvent(response.title, response.description, tab.url);
	    		title = content.title;
	    		description = content.description;
	    	}
	    	finishProcessAndCallback();
	    });
	    port.postMessage({action:"getEventDetails"});
	    
	    connectTimer = setTimeout(function() {
	    	finishProcessAndCallback();
	    }, 500);
	    */
		
		if (tab.url.indexOf("https://mail.google.com/mail/u/") != -1) {
			chrome.tabs.executeScript(tab.id, {file:"/js/parseGmailToEvent.js"}, function(results) {
				if (results && results.length >= 1) {
					var eventDetails = results[0];
					title = eventDetails.title;
					description = eventDetails.description;
				}
				finishProcessAndCallback();
			});
		} else if (tab.url.indexOf("https://mail.google.com/mail/mu/") != -1) {
			chrome.tabs.executeScript(tab.id, {file:"/js/parseGmailOfflineToEvent.js"}, function(results) {
				if (results && results.length >= 1) {
					var eventDetails = results[0];
					title = eventDetails.title;
					description = eventDetails.description;
				}
				finishProcessAndCallback();
			});
		} else if (tab.url.indexOf(getInternalPageProtocol() + "//" + ExtensionId.Gmail) != -1 || tab.url.indexOf(getInternalPageProtocol() + "//" + ExtensionId.LocalGmail) != -1) {
			sendMessageToGmailExtension({action:"getEventDetails"}).then(function(response) {
				if (response) {
					title = response.title;
					description = response.description;
					url = response.url;
				}
				
				finishProcessAndCallback();
			});
		} else {
			chrome.tabs.executeScript({file:"/js/parseHtmlToEvent.js"}, function(results) {
				if (chrome.runtime.lastError) {
					console.error("probably don't have access to parse this page: " + chrome.runtime.lastError.message);
				} else {
					if (results && results.length >= 1) {
						var eventDetails = results[0];
						title = eventDetails.title;
						description = eventDetails.description;
						url = eventDetails.url;
					}
				}
				finishProcessAndCallback();
			});
		}
	} else {
		title = $(".hP:visible").first().text();
		description = $(".ii.gt:visible").html();
		var content = prepContentForCreateEvent(title, description, location.href);
		callback(content);
	}
}

function formatDateTo8Digits(date, withTime) {
	var str = date.getFullYear() + "" + pad((date.getMonth()+1),2, "0") + "" + pad(date.getDate(), 2, "0");
	if (withTime) {
		str += "T" + pad(date.getHours(), 2, "0") + "" + pad(date.getMinutes(), 2, "0") + "" + pad(date.getSeconds(), 2, "0");
	}
	return str;
}

function getCalendarId(eventEntry) {
	var calendarId;
	if (eventEntry.calendar) {
		calendarId = eventEntry.calendar.id;
	} else {
		calendarId = "primary";
	}
	return calendarId;
}

function getCalendarById(id) {
	var calendars = arrayOfCalendars;
	for (var a=0; a<calendars.length; a++) {
		if (calendars[a].id == id) {
			return calendars[a];
		}
	}
}

function getCalendarIDFromURL(url) {
	if (url) {
		var str = "/feeds/";
		var idx = url.indexOf(str);
		if (idx != -1) {
			id = url.substring(idx+str.length);
			idx = id.indexOf("/");
			if (idx != -1) {
				return id.substring(0, idx);
			}
		}
	}
	return null;
}

function generateActionLink(action, eventEntry) {
	var description = eventEntry.description;
	// when using GET must shorten the url length so let's shorten the desctiption to not get 414 errors
	var MAX_DESCRIPTION_LENGTH = 600;
	if (description && description.length > MAX_DESCRIPTION_LENGTH) {
		description = description.substring(0, MAX_DESCRIPTION_LENGTH) + "...";						
	}
	var datesStr = "";
	
	// if no starttime must have one for this url to work with google or else it returns 404
	if (!eventEntry.startTime) {
		eventEntry.startTime = new Date();
	}
	if (eventEntry.startTime) {
		var startTime = eventEntry.startTime ? new Date(eventEntry.startTime) : new Date();
		var endDate;
		var withTime = !eventEntry.allDay;
		var startTimeStr = formatDateTo8Digits(startTime, withTime);
		if (eventEntry.endTime) {
			endDate = new Date(eventEntry.endTime);
		} else {
			endDate = new Date(startTime);
			if (eventEntry.allDay) {
				endDate.setDate(startTime.getDate()+1);
			} else {
				endDate.setMinutes(endDate.getMinutes() + getDefaultEventLength());
			}
		}					
		var endDateStr = formatDateTo8Digits(endDate, withTime);
		datesStr = "&dates=" + startTimeStr + "/" + endDateStr;
	}
	
	var cText = eventEntry.summary ? "&ctext=" + encodeURIComponent(eventEntry.summary) : "";
	var textParam = eventEntry.summary ? "&text=" + encodeURIComponent(eventEntry.summary) : "";
	//output=js CRASHES without specifying return type in .ajax
	//https://www.google.com/calendar/event?hl=de&dates=20110124/20110125&ctext=tet&pprop=HowCreated:DRAG&qa-src=month-grid&sf=true&action=CREATE&output=js&secid=AmobCPSNU1fGgh1zQp9oPzEaMhA
	var detailsParam = description ? "&details=" + encodeURIComponent(description) : "";
	
	var src;
	var srcParam
	if (eventEntry.calendar) {
		src = eventEntry.calendar.id;
	}
	srcParam = src ? "&src=" + src : "";
	
	var url = "https://calendar.google.com/calendar/event";
	var data = "action=" + action + datesStr + cText + textParam + detailsParam + srcParam + "&authuser=" + encodeURIComponent(bg.email);
	return {url:url, data:data};
}

function daysElapsedSinceFirstInstalled() {
	return Math.abs(getInstallDate().diffInDays());
}

var IGNORE_DATES = false;

function isEligibleForReducedDonation(mightBeShown) {

	if (TEST_REDUCED_DONATION) {
		return true;
	}
	
	// not eligable if we already d or we haven't verified payment
	if (storage.get("donationClicked") || !storage.get("verifyPaymentRequestSentForReducedDonation")) {
		return false;
	} else {
		if (IGNORE_DATES || daysElapsedSinceFirstInstalled() >= 14) { // must be older than 50 days + 10 (because we want this ad after the gmail ad)

			// when called from shouldShowReducedDonationMsg then we can assume we are going to show the ad so let's initialize the daysElapsedSinceEligible
			if (mightBeShown) {
				// stamp this is as first time eligibility shown
				var daysElapsedSinceEligible = storage.get("daysElapsedSinceEligible");
				if (!daysElapsedSinceEligible) {
					storage.setDate("daysElapsedSinceEligible");				
				}
			}
			
			return true;
		} else {
			return false;
		}
	}
}

// only display eligible special for 1 week after initially being eligiable (but continue the special)
function isEligibleForReducedDonationAdExpired(mightBeShown) {

	if (TEST_REDUCED_DONATION) {
		return false;
	}
	
	if (storage.get("reducedDonationAdClicked")) {
		return true;
	} else {
		var daysElapsedSinceEligible = storage.get("daysElapsedSinceEligible");
		if (daysElapsedSinceEligible) {
			daysElapsedSinceEligible = new Date(daysElapsedSinceEligible);
			if (IGNORE_DATES || Math.abs(daysElapsedSinceEligible.diffInDays()) <= 7) {
				return false;
			} else {
				return true;
			}
		}
		return false;
	}
}

function shouldShowReducedDonationMsg(ignoreExpired) {
	if (isEligibleForReducedDonation(true)) {
		if (ignoreExpired) {
			return true;
		} else {
			return !isEligibleForReducedDonationAdExpired();
		}
	}
	//return isEligibleForReducedDonation(true) && !isEligibleForReducedDonationAdExpired();
}

function getSummary(o) {
	var summary = o.summary;
	if (!summary) {
		if (o.calendar && o.calendar.accessRole == "freeBusyReader") {
			summary = getMessage("busy");
		} else {
			summary = "(" + getMessage("noTitle") + ")";
		}
	}
	return summary;
}

function getEventID(event) {
	if (event.id) {
		return event.id
	} else {
		return event.eid;
	}
}

function isSameEvent(event1, event2) {
	return event1.id == event2.id;
}

function darkenColor(color) {
	// patch: google calendar colors are not matching api colors they are lighter - so let's map some to their correct values
	if (color == "#9a9cff") {
		return "#373AD7";
	} else if (color == "#9fc6e7") { // first default calendar color
		return "#1587BD";
	} else {
		return lightenDarkenColor(color, -40);
	}
}

function initEventObj(event) {
	if (event.start.date) {
		event.allDay = true;
		event.startTime = event.start.date.parseDate();
		event.endTime = event.end.date.parseDate();
	} else {
		event.allDay = false;
		event.startTime = event.start.dateTime.parseDate();
		event.endTime = event.end.dateTime.parseDate();
	}
}

function isGadgetCalendar(calendar) {
	if (calendar) {
		var id = calendar.id;
		
		if (id) {
			id = decodeCalendarId(id);
			return isGadgetCalendarId(id)
		}
	}
}

function isGadgetCalendarId(calendarId) {
	if (calendarId && (
			calendarId.indexOf("#weather@group.v.calendar.google.com") != -1 || // weather
			calendarId.indexOf("#weeknum@group.v.calendar.google.com") != -1 || // week numbers
			calendarId.indexOf("g0k1sv1gsdief8q28kvek83ps4@group.calendar.google.com") != -1 || // week numbers also?
			calendarId.indexOf("#daynum@group.v.calendar.google.com") != -1 || // day of the year
			calendarId.indexOf("ht3jlfaac5lfd6263ulfh4tql8@group.calendar.google.com") != -1 // moon phases
			)) {
				return true;
	}
}

function decodeCalendarId(id) {
	// ignore decoding errors produced from gtempaccounts because they % ie.  joao%rotagrafica.com.br@gtempaccount.com in them!! refer to https://support.google.com/youtube/answer/1076429
	if (id && id.indexOf("@gtempaccount.com") == -1) {
		// try catch for: URIError: URI malformed
		try {
			id = decodeURIComponent(id);
		} catch (e) {
			logError("could not decode id from url: " + id);
		}
	}
	return id;
}

function stripEvent(event) {
	var eventShownMinimal = {
		id: event.id,
		startTime: event.startTime,
		endTime: event.endTime,
		reminderTimes: event.reminderTimes
	}
	return eventShownMinimal;
}

function updateNotificationEventsShown(notifications, eventsShown, lastAction) {
	$.each(notifications, function(index, notification) {
		var event = notification.event;
		
		updateEventShown(event, eventsShown);
	});

	if (lastAction != "snooze") {
		removeSnoozers(notifications);
	}

	bg.serializeEventsShown();
}

function findEvent(event, eventsShown) {
	for (var a=0; a<eventsShown.length; a++) {
		if (isSameEvent(eventsShown[a], event)) {
			bg.console.log("find events");
			return eventsShown[a];
		}
	}
}

function updateEventShown(event, eventsShown) {
	// Update eventsShown with stripped event
	var eventToModify = findEvent(event, eventsShown);
	
	if (eventToModify) {
		markReminderTimeAsShown(event, eventToModify);
	} else {
		// prevent localStorage quota issue with massive eventsShow - so let's minimimze the details we need to only the bare eseentials
		var strippedEvent = stripEvent(event);

		markReminderTimeAsShown(event, strippedEvent);
		eventsShown.push(strippedEvent);
	}
}

function markReminderTimeAsShown(event, eventToModify) {
	eventToModify.startTime = event.startTime;
	if (!eventToModify.reminderTimes) {
		eventToModify.reminderTimes = [];
	}
	
	// dismiss any other reminders to this same event that might have come before
	var reminders = getEventReminders(event);
	if (reminders) {
		reminders.forEach(function(reminder) {
			if (reminder.method == "popup") {
				var eventToModifyReminderTime = getReminderTime(event, reminder);
				if (eventToModifyReminderTime.isEqualOrBefore(new Date())) {
					eventToModify.reminderTimes.push({time:eventToModifyReminderTime, shown:true});
				}
			}
		});
	}
	
	//eventToModify.reminderTimes.push({time:reminderTime, shown:true});
	//console.log("MARKEND " + event.summary, eventToModify);
}

function getEventReminders(event) {
	var reminders;
	if (event.reminders) {
		if (event.reminders.useDefault) {
			reminders = event.calendar.defaultReminders;
		} else {
			reminders = event.reminders.overrides;
		}
	}
	return reminders;
}

function getReminderTime(event, reminder) {
	var reminderTime = new Date(event.startTime.getTime());
	return new Date(reminderTime.getTime() - (reminder.minutes * ONE_MINUTE));
}

function removeSnoozers(notifications) {
	var snoozers = storage.get("snoozers");
	
	$.each(notifications, function(index, notification) {
		// Remove IF from Snoozers
		var event = notification.event;
		for (var a=0; a<snoozers.length; a++) {
			var snoozer = snoozers[a];
			//bg.console.log("snooze found")
			if (isSameEvent(event, snoozer.event)) {
				//bg.console.log("remove snooze")
				snoozers.splice(a, 1);
				a--;
				break;
			}
		}
	});

	storage.set("snoozers", snoozers);
}

function SnoozeObj(time, currentEvent, reminderTime) {
	this.time = time;
	this.event = currentEvent;
	this.reminderTime = reminderTime;
	this.email = bg.email;
}

function setSnoozeInMinutes(notifications, units) {
	if (units <= 0) {
		setSnoozeDate(notifications, null, units);
	} else {
		var date = new Date(Date.now() + minutes(units));
		date.setSeconds(0, 0);
		setSnoozeDate(notifications, date);
	}
}

function setSnoozeInHours(notifications, units) {
	var date = new Date(Date.now() + hours(units));
	date.setSeconds(0, 0);
	setSnoozeDate(notifications, date);
}

function setSnoozeDate(notifications, time, beforeStart) {
	var snoozers = storage.get("snoozers");
	
	// remove first then add again
	removeSnoozers(notifications);
	
	$.each(notifications, function(index, notification) {
		if (beforeStart != undefined) {
			time = notification.event.startTime.addMinutes(beforeStart);
		}
		var snooze = new SnoozeObj(time, notification.event, notification.reminderTime); // last # = minutes
		snoozers.push(snooze);
	});
	
	storage.set("snoozers", snoozers);
}

function snoozeNotifications(snoozeParams, notifications) {
	if (snoozeParams.snoozeTime) {
		setSnoozeDate(notifications, snoozeParams.snoozeTime);
	} else if (snoozeParams.inMinutes) {
		if (storage.get("testMode") && snoozeParams.inMinutes == 5) {
			snoozeParams.inMinutes = 1;
		}
		setSnoozeInMinutes(notifications, snoozeParams.inMinutes);
	} else if (snoozeParams.inHours) {
		setSnoozeInHours(notifications, snoozeParams.inHours);
	} else { // in days
		var daysToSnooze = snoozeParams.inDays;
		var snoozeToThisDay = new Date();
		snoozeToThisDay.setDate(snoozeToThisDay.getDate()+parseInt(daysToSnooze));
		snoozeToThisDay.resetTime();
    	setSnoozeDate(notifications, snoozeToThisDay);
	}

	var closeNotificationsParams = {};
	closeNotificationsParams.lastAction = "snooze";
	if (snoozeParams.source == "notificationButton") {
		closeNotificationsParams.source = "notificationButton";
	}
	
	bg.closeNotifications(notifications, closeNotificationsParams);
}

function getTimeElapsed(event) {
	var timeElapsedMsg = "";
	var diffInDays = event.startTime.diffInDays();
	if (event.allDay) {
		if (isYesterday(event.startTime)) {
			timeElapsedMsg = getMessage("yesterday");
		} else if (isTomorrow(event.startTime)) {
			timeElapsedMsg = getMessage("tomorrow");
		} else if (!isToday(event.startTime)) {				
			if (diffInDays > 0) {
				timeElapsedMsg = getMessage("daysLeft", diffInDays + "");
			} else {
				timeElapsedMsg = getMessage("daysAgo", Math.abs(diffInDays) + "");
			}
		}
	} else {
		var diff = (Date.now() - event.startTime.getTime()) / ONE_MINUTE;
		
		var diffInHours = Math.abs(diff / 60);
		if (diffInHours <= 2) {
			diffInHours = diffInHours.toFixed(1).replace(".0", "");
		} else {
			diffInHours = diffInHours.toFixed(0);
		}
		
		var startTimePrefix = new Date(event.startTime).formatTime(true) + " • ";
		if (diff <= -(60 * 24)) {
			timeElapsedMsg = getMessage("daysLeft", Math.abs(Math.ceil(diff / 60 / 24)) + "");
		} else if (diff <= -60) {
			timeElapsedMsg = startTimePrefix + getMessage("hoursLeft", diffInHours);
		} else if (diff <= -1) {
			timeElapsedMsg = startTimePrefix + getMessage("minutesLeft", Math.abs(Math.floor(diff)) + "");
		} else if (diff <= 2) {
			// Just happened so do nothing
		} else if (diff < 60) {
			timeElapsedMsg = getMessage("minutesAgo", Math.floor(diff) + "");
		} else if (isYesterday(event.startTime)) {
			timeElapsedMsg = getMessage("yesterday");
		} else if (diff < 60 * 24) {
			timeElapsedMsg = getMessage("hoursAgo", diffInHours);
		} else {
			timeElapsedMsg = getMessage("daysAgo", Math.abs(diffInDays) + "");
		}
	}
	
	return timeElapsedMsg;
}

function isCalendarSelectedInExtension(calendar, email, selectedCalendars) {
	if (calendar) {
		// new added because we were fetching events for weather, week numbers etc. which were never used in the display of new looks (or old looks for that matter because they don't use the feed data- just the embed calendar)
		if (!isGadgetCalendar(calendar)) {
			if (selectedCalendars && selectedCalendars[email]) {
				var selected = selectedCalendars[email][calendar.id];
				
				// if previously defined than return that setting
				if (typeof selected != "undefined") {
					return selected;
				} else { // never defined so use default selected flag from google calendar settings
					return calendar.selected;
				}
			} else {
				// // never defined so use default selected flag from google calendar settings
				return calendar.selected;
			}			
		}
	}
}

function getCalendarName(calendar) {
	// see if user renamed the original calendar title
	if (calendar.summaryOverride) {
		return calendar.summaryOverride;
	} else {
		return calendar.summary;
	}
}

function getCurrentUserAttendeeDetails(event) {
	var currentUserAttendeeDetails;
	
	if (event.attendees) {
		$.each(event.attendees, function(index, attendee) {
			if (attendee.self) {
				currentUserAttendeeDetails = attendee;
				return false;
			} else {
				// continue loop
				return true;
			}
		});
	}
	
	return currentUserAttendeeDetails;
}

function hasUserDeclinedEvent(event) {
	var currentUserAttendeeDetails = getCurrentUserAttendeeDetails(event)
	if (currentUserAttendeeDetails && currentUserAttendeeDetails.responseStatus == "declined") {
		return true;
	}
}

function passedShowDeclinedEventsTest(event, storage) {
	return storage.get("calendarSettings").showDeclinedEvents || storage.get("calendarSettings").showDeclinedEvents == undefined || (storage.get("calendarSettings").showDeclinedEvents == false && !hasUserDeclinedEvent(event));
}

function getEventSource(event) {
	var source = {};
	
	if (event.source) {
		source = event.source;
	} else {
		// look for link in description and use it as source
		if (event.description) {
			var matches = event.description.match(/(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/i);
			if (matches) {
				var link = $.trim(matches[0]);
				if (link) {
					var title;
					if (link.match("https?://mail.google.com")) {
						title = event.summary;
					} else {
						title = link.replace(/(www.)?/g, "");
					}
					source = {url:link, title:title};
				}
			}
		}
	}
	
	if (source.url) {
		if (!source.title) {
			source.title = "Open URL";
		}
		if (source.url.match("https?://mail.google.com")) {
			source.isGmail = true;
		}
		return source;
	} else {
		return null;
	}
}

function getNotification(notificationsOpened, notificationId) {
	for (var a=0; a<notificationsOpened.length; a++) {
		if (notificationsOpened[a].id == notificationId) {
			return notificationsOpened[a];
		}
	}
}

function isGroupedNotificationsEnabled() {
	return storage.get("notificationGrouping") == "groupNotifications";
}

function getEventColor(event) {
	var colors = bg.cachedFeeds["colors"];
	var color;
	if (event.colorId && colors) {
		if (event.allDay) {
			color = colors.event[event.colorId].background;
		} else {
			if (event.calendar.backgroundColor) {
				color = event.calendar.backgroundColor;
			} else {
				color = colors.calendar[event.calendar.colorId].background;
			}
		}
	} else {
		if (event.calendar && event.calendar.colorId) {
			color = colors.calendar[event.calendar.colorId].background;
		} else {
			console.log("no color for event calendar default to black: ", event);
			color = "black";
		}
	}
	
	color = darkenColor(color);
	
	// if anyhing close to white then change it to black (because we can't see it on a white background remindersWindow and notification window
	if (!color || color == "white" || color == "#fff" || color == "#ffffff") {
		color = "black";
	}
	
	return color;
}

// must be declared in global file because when called from bg.openSnoozePopup (the context of the window/screen might be skewed because it takes debugger settings like mobile resolution etc.)
function openReminders(params) {
	return new Promise(function(resolve, reject) {
		params = initUndefinedObject(params);
		
		bg.remindersWindowClosedByDismissingEvents = false;
		
		var notifications = params.notifications;
		
		if (bg.remindersWindow) {
			closeReminders();
		}
	
		// default is notifications opened
		if (!notifications) {
			notifications = bg.notificationsOpened;
		}
		
		var TOP_TITLE_BAR_HEIGHT_DEFAULT = 31;
		var TOP_TITLE_BAR_HEIGHT_NEWER_WINDOWS = 40;
		var TOP_TITLE_BAR_HEIGHT_MAC = 22;
		var TOP_TITLE_BAR_HEIGHT_LINUX = 22; // guessed
		
		var DISMISS_ALL_HEIGHT = 40; // for dismiss all button
		var NOTIFICATION_HEIGHT = 101; // 100 + 1 for bottom-border
		var MARGIN = 0;
		var MAX_NOTIFICATIONS = 4;
		var notificationCount = Math.min(notifications.length, MAX_NOTIFICATIONS);
		
		var topTitleSpace;
		if (DetectClient.isNewerWindows()) {
			topTitleSpace = TOP_TITLE_BAR_HEIGHT_NEWER_WINDOWS;
		} else if (DetectClient.isMac()) {
			topTitleSpace = TOP_TITLE_BAR_HEIGHT_MAC;
		} else if (DetectClient.isLinux()) {
			topTitleSpace = TOP_TITLE_BAR_HEIGHT_LINUX;
		} else {
			topTitleSpace = TOP_TITLE_BAR_HEIGHT_DEFAULT;
		}
		var height = (notificationCount * NOTIFICATION_HEIGHT) + topTitleSpace + ((notificationCount+1) * MARGIN);
		
		// more than 2 show dismiss all and so make popup higher
		if (notifications.length >= 2) {
			height += DISMISS_ALL_HEIGHT;
		}
		
		var width = 510;
		
		// enlarge if using zoom
		width *= window.devicePixelRatio;
		height *= window.devicePixelRatio;
		
		// Passing params by backgroud instead of postmessage or chrome message refer below for bug
		bg.remindersWindowParams = {}
		bg.remindersWindowParams.notifications = notifications;
	
		var left = Math.round( (screen.width/2)-(width/2) );
		var top = Math.round( (screen.height/2)-(height/2) );
		
		// push up a bit because when we open date picker it clips at bottom
		top -= 20;
	
		//bg.snoozePopup = openWindowInCenter("snoozePopup.html", 'snoozePopup', 'toolbar=0,scrollbars=0,menubar=0,resizable=0,status=0', width, height);
		//var str = Math.floor(Math.random() * 2) == 0 ? "reminders.html" : "test.html";
		
		chrome.idle.queryState(15, function(newState) {
			var url = chrome.runtime.getURL("reminders.html");
			if (params.closeWindowGuide) {
				url += "?closeWindowGuide=true";
			}
			
			var createWindowParams = {url: url, width:Math.round(width), height:Math.round(height), left:left, top:top, type:"popup", state:"normal"};
			
			if (DetectClient.isChrome()) {
				// if user not doing anything for 15 seconds than let's interupt and put the focus on the popup
				createWindowParams.focused = !params.useIdle || newState != "active";
			}
			
			chrome.windows.create(createWindowParams, function(newWindow) {
				bg.remindersWindow = newWindow;
				resolve();
			});
		});

		/*
		 * commented out because onload or sometimes postmessage would not be sent when when called from the popup window, note: it would work when called from the notification window
		bg.snoozePopup.onload = function () {
			// seems window object doesn't exist when called from popup etc. so let's use the bg.window 
	        bg.snoozePopup.postMessage({notifications:notifications}, bg.window.location.href);
	    }
	    */

	});
}

function closeReminders() {
	if (bg.remindersWindow && bg.remindersWindow.id) {
		chrome.windows.remove(bg.remindersWindow.id, function() {
			if (chrome.runtime.lastError) {
				console.warn("close reminders: " + chrome.runtime.lastError.message);
			} else {
				bg.remindersWindow = null;
			}
		});
	}
}

function sortNotifications(notifications) {
	notifications.sort(function(a,b) {
		if (a.event.startTime.getTime() < b.event.startTime.getTime()) {
			return +1;
		} else {
			return -1;
		}
	});
}

function fcMomentDateToLocalDate(fcDate) {
	if (fcDate) {
		
		// Using this method now because method further below creating an issue because of DST, seems timezone -05:00 etc. would change halfway through the year
		var date = new Date(fcDate.year(), fcDate.months(), fcDate.date(), fcDate.hours(), fcDate.minutes(), fcDate.seconds(), fcDate.milliseconds());
		return date;
		
		/*
		// convert it to javascript date
		var date = fcDate.toDate();
		
		// if utc then change it to local timezone
		if (fcDate.isUTC()) {
			var offset = new Date().getTimezoneOffset();
			return date.addMinutes(offset);
		} else {
			return date;
		}
		*/
	}
}

function isGmailExtension(id) {
	return id == ExtensionId.Gmail || id == ExtensionId.LocalGmail;
}

function sendMessageToGmailExtension(message) {
	return new Promise(function(resolve, reject) {
		var recipientExtensionId;
		if (chrome.runtime.id == ExtensionId.LocalCalendar) {
			recipientExtensionId = ExtensionId.LocalGmail;
		} else {
			recipientExtensionId = ExtensionId.Gmail;
		}
		
		chrome.runtime.sendMessage(recipientExtensionId, message, function(response) {
			if (chrome.runtime.lastError) {
				console.error("sendMessageToGmailExtension error: " + chrome.runtime.lastError.message);
				reject(chrome.runtime.lastError.message);
			} else {
				console.log("response", response);
				resolve(response);
			}
		});
	});
}

function setDNDEndTime(endTime, fromOtherExtension) {
	storage.set("DND_endTime", endTime);
	bg.updateBadge();
	
	// !!! Important if this was sent from Gmail or other extension then do not send back or eternal sendMessage loop will occur
	if (!fromOtherExtension && storage.get("syncDND")) {
		sendMessageToGmailExtension({action:"setDNDEndTime", endTime:endTime.toJSON()});
	}
}

function setDND_off(fromOtherExtension) {
	if (storage.get("DND_endTime")) {
		storage.remove("DND_endTime");
	} else {
		storage.remove("DND_schedule");
	}
	bg.updateBadge();
	
	if (!fromOtherExtension && storage.get("syncDND")) {
		sendMessageToGmailExtension({action:"turnOffDND"});
	}
}

function setDND_minutes(minutes) {
	var dateOffset = new Date();
	dateOffset.setMinutes(dateOffset.getMinutes() + parseInt(minutes));
	setDNDEndTime(dateOffset);
}

function setDND_today() {
	setDNDEndTime(tomorrow());
}

function openDNDScheduleOptions() {
	openUrl("options.html?highlight=DND_schedule");
}

function setDND_indefinitely() {
	var farOffDate = new Date();
	farOffDate.setYear(2999);
	setDNDEndTime(farOffDate);
}

function isDND() {
	return isDNDbyDuration();
}

function isDNDbyDuration() {
	var endTime = storage.get("DND_endTime");
	if (endTime) {
		return endTime.isAfter();
	} else {
		return false;
	}
}

function generateLocationUrl(event) {
	var url;
	if (event.location.match("https?://")) {
		url = event.location;
	} else {
		url = "https://maps.google.com/maps?q=" + encodeURIComponent(event.location) + "&source=calendar";
	}
	return url;
}

function openGoogleCalendarWebsite() {
	openUrl("https://calendar.google.com/calendar?authuser=" + encodeURIComponent(email), {urlToFind:"https://calendar.google.com/calendar"});
}

function generateTimeDurationStr(params) {
	var event = params.event;
	
	var str = "";
	var startTime = new Date(event.startTime);
	var endTime;
	if (event.endTime) {
		endTime = new Date(event.endTime);
	}
	
	var startDateStr = startTime.format(getMessage("notificationDateFormat"));
	
	if (event.allDay) {
		if (!endTime || startTime.diffInDays(endTime) == -1) {
			str = startDateStr;
		} else {
			endTime.setDate(endTime.getDate()-1);
			str = startDateStr + " - " + endTime.format(getMessage("notificationDateFormat"));
		}
	} else {
		if (!params.hideStartDay) {
			str = startDateStr + ", ";
		}
		if (endTime.diffInHours(startTime) < 24) {
			str += startTime.formatTime() + " - " + endTime.formatTime();
		} else {
			str += startTime.formatTime() + " - " + endTime.format(getMessage("notificationDateFormat")) + " " + endTime.formatTime();
		}
	}

	return str;
}

function sendFVDInfo() {
	fvdSpeedDialLink.setWidgetInfo({
		path: "/popup.html?source=widget&ntp=FVD",
	    widthCells: storage.get("widgetWidth"),
	    heightCells: storage.get("widgetHeight")
	});
}


function deleteEvent(event, sendNotifications) {
	return ensureRecurringEventPrompt({event:event}).then(function(response) {
		// save this for inner response below
		var changeAllRecurringEvents = response.changeAllRecurringEvents;
		
		var url = "/calendars/" + encodeURIComponent(getCalendarId(event)) + "/events/" + (changeAllRecurringEvents ? event.recurringEventId : event.id)
		if (sendNotifications) {
			url += "?sendNotifications=true";
		}
		
		return oauthDeviceSend({userEmail:email, type:"DELETE", url: url}).then(response => {
			response.changeAllRecurringEvents = changeAllRecurringEvents;
			return Promise.resolve(response);
		});
	}).then(response => {
		// remove from events
		for (var a=0; a<events.length; a++) {
			if (events[a].id == event.id) {
				events.splice(a, 1);
				a--;
				console.log("removed from events");
			}
		}
		
		// remove from cachedfeeds
		if (bg.cachedFeeds[event.calendar.id]) {
			bg.cachedFeeds[event.calendar.id].items.some(function(cachedEvent, index) {
				if (cachedEvent.id == event.id) {
					console.log("removed from cachedfeeds");
					bg.cachedFeeds[event.calendar.id].items.splice(index, 1);
					setTimeout(function() {
						storage.set("cachedFeeds", bg.cachedFeeds);
					}, seconds(2));
					return true;
				}
			});
		}
		
		if (bg.checkEvents) {
			return bg.checkEvents({ignoreNotifications:true}).then(() => {
				return Promise.resolve(response);
			});
		} else {
			return Promise.resolve(response);
		}
	});
}

function parseEventDates(event) { 
	// Patch for Date objects because they are not stringified as an object AND remove old events
	if (typeof event.startTime == "string") {
		event.startTime = event.startTime.parseDate();
	}
	if (event.endTime && typeof event.endTime == "string") {
		event.endTime = event.endTime.parseDate();
	}
	if (event.reminderTimes) {
		$.each(event.reminderTimes, function(a, thisEvent) {
			if (thisEvent.time) {
				if (typeof thisEvent.time == "string") {
					thisEvent.time = thisEvent.time.parseDate();
				}
			} else {
				console.warn("no time: ", thisEvent);
			}
		});
	} else {
		event.reminderTimes = [];
	}
}

function initEventDates(theseEvents) {
	var event;
	for (var a=0; event=theseEvents[a], a<theseEvents.length; a++) {
		if (event.startTime) {
			parseEventDates(event);
			var startTime = event.startTime;
			if (startTime && startTime.getTime() < getStartDateOfPastEvents().getTime() - (ONE_DAY * 40)) { // last # = days
				console.log("removed old event: " + event.id + " " + startTime);
				// can't use splice with $.each atleast as of jquery 1.6.2
				theseEvents.splice(a, 1);
				a--;
			}
		} else {
			//console.log("ignore non reminder event: " + getSummary(event), event);
			//theseEvents.splice(a, 1);
			//a--;
		}
	}
}

function findEventById(id) {
	for (var a=0; a<bg.events.length; a++) {
		if (bg.events[a].id == id) {
			return bg.events[a];
		}
	}
}

function isCurrentlyDisplayed(event) {
	for (var a=0; notification=bg.notificationsQueue[a], a<bg.notificationsQueue.length; a++) {
		if (isSameEvent(event, notification.event)) {
			log("current displayed", "showConsoleMessagesEventsSnoozes");
			return true;
		}
	}
	return false;
}

//get future snoozes, includeAlreadyShown
function getSnoozes(snoozers, params) {
	params = initUndefinedObject(params);
	
	var futureSnoozes = [];
	$.each(snoozers, function(index, snoozer) {
		if ((!snoozer.email || snoozer.email == bg.email) && snoozer.time.getTime() >= Date.now()) {
			if ((params.includeAlreadyShown || !isCurrentlyDisplayed(snoozer.event))) {
				if (!snoozer.time.isToday() || (snoozer.time.isToday() && !params.excludeToday)) {
					snoozer.isSnoozer = true;
					futureSnoozes.push(snoozer);
				}
			}
		}
	});
	return futureSnoozes;
}

function getEventUrl(event) {
	return event.htmlLink + "&authuser=" + encodeURIComponent(bg.email);
}

function getBadgeIconUrl(state, keepDate) {
	if (!state) {
		state = "";
	}
	
	var badgeIcon = storage.get("badgeIcon");
	if (!badgeIcon) {
		badgeIcon = "default";
	}
	
	var withDateStr;
	if (keepDate) {
		withDateStr = badgeIcon;
	} else {
		if (badgeIcon == "default3WithDate") {
			badgeIcon = "default";
		}
		withDateStr = badgeIcon.replace("WithDate", "")
	}
	
	return "images/icons/icon-19_" + withDateStr + state + ".png";
}

function initReminderPeriod($reminderValuePerPeriod, $reminderPeriod, $reminderMinutes, allDay) {
	if (allDay) {
		$reminderPeriod.find("[value='minutes'], [value='hours']").attr("hidden", "");
	} else {
		$reminderPeriod.find("[value='minutes'], [value='hours']").removeAttr("hidden");
	}
	
	var reminderMinutes = $reminderMinutes.prop("value");
	
	// if larger than a week AND it's a multiple of 7 days, because we don't want 10 days to equal 1.45 weeks
	if (reminderMinutes >= WEEK_IN_MINUTES && reminderMinutes % WEEK_IN_MINUTES == 0) {
		// week
		$reminderValuePerPeriod.prop("value", reminderMinutes / WEEK_IN_MINUTES);
		$reminderPeriod[0].selected = "weeks";
	} else if (reminderMinutes >= DAY_IN_MINUTES || (allDay && reminderMinutes == 0)) {
		// days
		$reminderValuePerPeriod.prop("value", reminderMinutes / DAY_IN_MINUTES);
		$reminderPeriod[0].selected = "days";
	} else if (reminderMinutes >= HOUR_IN_MINUTES) {
		// hours
		$reminderValuePerPeriod.prop("value", reminderMinutes / HOUR_IN_MINUTES);
		$reminderPeriod[0].selected = "hours";
	} else {
		// minutes
		$reminderValuePerPeriod.prop("value", reminderMinutes);
		$reminderPeriod[0].selected = "minutes";
	}
}

function updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod) {
	if ($reminderPeriod[0].selected == "minutes") {
		$reminderMinutes.prop("value", $reminderValuePerPeriod[0].value);
	} else if ($reminderPeriod[0].selected == "hours") {
		$reminderMinutes.prop("value", $reminderValuePerPeriod[0].value * HOUR_IN_MINUTES);
	} else if ($reminderPeriod[0].selected == "days") {
		$reminderMinutes.prop("value", $reminderValuePerPeriod[0].value * DAY_IN_MINUTES);
	} else if ($reminderPeriod[0].selected == "weeks") {
		$reminderMinutes.prop("value", $reminderValuePerPeriod[0].value * WEEK_IN_MINUTES);
	}
}

function getDateFormatFromCalendarSettings(storage) {
	var dateFormatStr;
	if (storage.get("calendarSettings").dateFieldOrder == "MDY") {
		dateFormatStr = "m/d/yy";
	} else if (storage.get("calendarSettings").dateFieldOrder == "DMY") {
		dateFormatStr = "d/m/yy";
	} else if (storage.get("calendarSettings").dateFieldOrder == "YMD") {
		dateFormatStr = "yy/m/d";
	}
	return dateFormatStr;
}

function generateDatePickerParams(storage) {
	var dayNamesMin = dateFormat.i18n.dayNamesShort.clone();
	$.each(dayNamesMin, function(index, dayName) {
		// don't cut day names in asian languages because they change the meaning of the word
		if (!isAsianLangauge()) {
			dayNamesMin[index] = dayName.substring(0, 2);
		}
	});
	
	return {firstDay: storage.get("calendarSettings").weekStart, isRTL: getMessage("dir") == "rtl", showButtonPanel: false, closeText: "Close", dateFormat: getDateFormatFromCalendarSettings(storage), monthNames:dateFormat.i18n.monthNames, dayNames:dateFormat.i18n.dayNames, dayNamesShort:dateFormat.i18n.dayNamesShort, dayNamesMin:dayNamesMin}
}

function generateTimePickerParams() {
	var timeFormatStr;
	if (storage.get("24hourMode")) {
		timeFormatStr = 'H:i';
	} else {
		timeFormatStr = 'g:i a';
	}

	return {scrollDefault:'now', timeFormat:timeFormatStr};
}

function isCalendarWriteable(calendar) {
	return /owner|writer/i.test(calendar.accessRole);
}

function isCalendarExcluded(calendar) {
	return storage.get("excludedCalendars").indexOf(calendar.id) != -1;
}

function formatEventAddedMessage(title, eventEntry) {
	var message;
	if (eventEntry.startTime) {
		var atStr = "";
		if (!eventEntry.allDay) {
			atStr = "At";
		}
		if (eventEntry.startTime.isToday()) {
			message = getMessage("addedForToday" + atStr, [title, eventEntry.startTime.formatTime(true)]);
		} else if (eventEntry.startTime.isTomorrow()) {
			message = getMessage("addedForTomorrow" + atStr, [title, eventEntry.startTime.formatTime(true)]);
		} else {
			message = getMessage("addedForSomeday" + atStr, [title, eventEntry.startTime.format("ddd d mmm"), eventEntry.startTime.formatTime(true)]);
		}
	} else {
		message = getMessage("eventAdded");
	}
	return message;
}

function findIcon(str) {
	var eventIcon;
	
	if (str) {
		if (/test event/i.test(str)) {
			eventIcon = "movie";
		} else if (str.hasWord("compost")) {
			eventIcon = "compost";
		} else if (str.hasWord("soccer") || (navigator.language == "en-GB" && str.hasWord("football"))) {
			eventIcon = "soccer";
		} else if (str.hasWord("football") && navigator.language != "en-GB") {
			eventIcon = "football";
		} else if (str.hasWord("cat")) {
			eventIcon = "cat";
		} else if (str.hasWord("doctor") || str.hasWord("dr") || str.hasWord("dr.")) {
			eventIcon = "doctor";
		} else if (str.hasWord("bath")) {
			eventIcon = "bath";
		} else if (str.hasWord("dentist")) {
			eventIcon = "dentist";
		} else if (str.hasWord("yoga")) {
			eventIcon = "yoga";
		} else if (str.hasWord("shave")) {
			eventIcon = "shave";
		} else if (str.hasWord("tax") || str.hasWord("taxes") || str.hasWord("cab")) {
			eventIcon = "taxes";
		} else if (str.hasWord("eye") || str.hasWord("eyes") || str.hasWord("optometrist")) {
			eventIcon = "eye";
		} else if (str.hasWord("bike") || str.hasWord("bicycle") || str.hasWord("biking")) {
			eventIcon = "bike";
		} else if (str.hasWord("plants") || /flowers?/i.test(str)) {
			eventIcon = "plants";
		} else if (str.hasWord("garbage")) {
			eventIcon = "garbage";
		} else if (str.hasWord("recycle") || str.hasWord("recycling")) {
			eventIcon = "recycle";
		} else if (str.hasWord("food") || str.hasWord("cook")) {
			eventIcon = "food";
		} else if (str.hasWord("lunch") || str.hasWord("brunch") || str.hasWord("dinner") || str.hasWord("supper")) {
			eventIcon = "local-dining";
		} else if (str.hasWord("leave") || str.hasWord("run") || str.hasWord("exercise") || str.hasWord("workout") || str.hasWord("race")) {
			eventIcon = "directions-run";
		} else if (str.hasWord("hospital")) {
			eventIcon = "local-hospital";
		} else if (str.hasWord("pills") || str.hasWord("medication")) {
			eventIcon = "local-pharmacy";
		} else if (str.hasWord("groceries")) {
			eventIcon = "local-grocery-store";
		} else if (str.hasWord("laundry")) {
			eventIcon = "local-laundry-service";
		} else if (str.hasWord("cafe") || str.hasWord("coffee") || str.hasWord("tea")) {
			eventIcon = "local-cafe";
		} else if (str.hasWord("flight") || str.hasWord("airplane") || str.hasWord("airport")) {
			eventIcon = "flight";
		} else if (str.hasWord("car")) {
			eventIcon = "directions-car";
		} else if (str.hasWord("rent") || str.hasWord("mortgage")) {
			eventIcon = "rent";
		} else if (str.hasWord("bank") || str.hasWord("cash") || str.hasWord("money") || str.hasWord("funds") || str.hasWord("dollar") || str.hasWord("atm")) {
			eventIcon = "dollar";
		} else if (str.hasWord("pizza")) {
			eventIcon = "local-pizza";
		} else if (str.hasWord("bus")) {
			eventIcon = "directions-bus";
		} else if (str.hasWord("call") || str.hasWord("phone")) {
			eventIcon = "local-phone";
		} else if (str.hasWord("drinks") || str.hasWord("party") || str.hasWord("cocktail")) {
			eventIcon = "local-bar";
		} else if (str.hasWord("sleep") || str.hasWord("hotel")) {
			eventIcon = "local-hotel";
		} else if (str.hasWord("meeting") || str.hasWord("workshop")) {
			eventIcon = "group";
		} else if (str.hasWord("cake") || /bday|birthdays?|cumpleaños/i.test(str)) {
			eventIcon = "cake";
		} else if (str.hasWord("school") || str.hasWord("class") || str.hasWord("classes") || str.hasWord("course")) {
			eventIcon = "school";
		} else if (str.hasWord("bank")) {
			eventIcon = "account-balance";
		} else if (str.hasWord("email")) {
			eventIcon = "mail";
		} else if (str.hasWord("updates")) {
			eventIcon = "updates";
		} else if (str.hasWord("movie")) {
			eventIcon = "movie";
		}		
	}
	return eventIcon;
}

function setEventIcon(customIconsDocument, event, $eventIcon) {
	var eventIcon;
	var summary = getSummary(event);
	
	// try event title
	eventIcon = findIcon(summary);
	if (!eventIcon) {
		if (event.calendar.summaryOverride) {
			// try calendar "nice" name
			eventIcon = findIcon(event.calendar.summaryOverride);
		}
		if (!eventIcon) {
			// try calendar name
			eventIcon = findIcon(event.calendar.summary);
		}
		
		if (!eventIcon) {
			// marie-eve's "Blog" calendar for food :)
			if (event.calendar.id == "qk6i02icprnhcj6mqt8cijoloc@group.calendar.google.com") {
				eventIcon = "food";
			}
		}
	}
	
	if (eventIcon) {
		$eventIcon
			.css({fill:getEventColor(event)})
		;
		if (eventIcon) {
			var $g = $(customIconsDocument).find("#" + eventIcon).clone();
			var viewBoxValue = "0 0 ";
			if ($g.attr("width")) {
				viewBoxValue += $g.attr("width") + " " + $g.attr("height");
			} else {
				viewBoxValue += "24 24";
			}
			var $svg = $("<svg height=24/>");
			$svg[0].setAttribute("viewBox", viewBoxValue); // must use .setAttribute because jquery does a tolowercase of attribute name but polymer needs viewBox with capital B
			$svg.append($g.find("*"));
			$eventIcon.append($svg);
			$eventIcon.find("path[stroke]").css("stroke", getEventColor(event));
		}
		$eventIcon.removeAttr("hidden");
		return $eventIcon;
	} else {
		$eventIcon.attr("hidden", "");
	}
}

function getPrimaryCalendar(calendars) {
	return calendars.find(calendar => {
		return calendar.primary;
	});
}