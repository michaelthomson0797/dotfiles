var storage = bg.storage;
var notifications;

var eventsShown = bg.eventsShown;
var notificationsQueue = bg.notificationsQueue;

function closeWindow() {
	bg.remindersWindowClosedByDismissingEvents = true;
	chrome.windows.getCurrent(function(thisWindow) {
		chrome.windows.remove(thisWindow.id);
	});
}

function dismissNotification(notifications, $event, allNotificationsFlag) {
	bg.closeNotifications(notifications);
	hideNotification($event, allNotificationsFlag);
}

function snoozeAndClose(snoozeParams, allNotificationsFlag) {
	if (allNotificationsFlag) {
		var remainingNotifications = getRemainingNotifications();
		snoozeNotifications(snoozeParams, remainingNotifications);
	} else {
		snoozeNotifications(snoozeParams, [snoozeParams.$event.data("notification")]);
	}
	hideNotification(snoozeParams.$event, allNotificationsFlag);
}

function hideNotification($event, allNotificationsFlag) {
	
	var hidingAll = false;
	
	if (allNotificationsFlag) {
		$event = $(".event");
	}
	
	if ($(".event").length - $event.length == 0) {
		hidingAll = true;
	}
	
	var transitionType = hidingAll ? "fadeOut" : "slideUp";
	
	var hadVerticalScrollBar;
	//if (document.body.scrollHeight > document.body.clientHeight) {
	if ($("#events")[0].scrollHeight > $("#events")[0].clientHeight) {
		hadVerticalScrollBar = true;
	}
	
	var headerHeight;
	var hideHeader = false;
	if ($(".event").length == 2) {
		headerHeight = $("#header").height();
		hideHeader = true;
		$("#headerButtons").hide();
	}
	
	$event[transitionType]("fast", function() {
		$(this).remove();
		if ($(".event").length == 0) {
			closeWindow();
		} else {
			var $firstEvent = $(".event").first();
			var $lastEvent = $(".event").last();
			console.log(document.body.clientHeight + " " + document.body.scrollHeight)
			if (hadVerticalScrollBar) {
				// has scroll bar do nothing
			} else {
				var resizeHeight = $lastEvent.height() + 1;
				if (hideHeader) {
					//resizeHeight += headerHeight;
				}
				//window.resizeBy(0, -(resizeHeight));
				chrome.windows.getCurrent(function(thisWindow) {
					chrome.windows.update(thisWindow.id, {height:thisWindow.height-resizeHeight});
				});
			}
			
			var firstNotification = $firstEvent.data("notification");
			if (firstNotification) {
				document.title = getSummary(firstNotification.event);
			}
		}
	});
}

function get$Event(o) {
	return o.closest(".event");
}

function get$EventById(id) {
	var $event;
	$(".event").each(function(index, event) {
		var notification = $(this).data("notification");
		if (notification.event.id == id) {
			$event = $(this);
			return false;
		}
	});
	return $event;
}

function updateTimeElapsed() {
	$(".event").each(function(index, event) {
		var notification = $(this).data("notification");
		
		var timeElapsedMsg = getTimeElapsed(notification.event);
		
		var $timeElapsed = $(this).find(".timeElapsed");
		if (timeElapsedMsg) {
			$timeElapsed.text(timeElapsedMsg);
		}
		
		if (notification.event.startTime.diffInMinutes() <= 15) {
			$(this).find("[snoozeInMinutes='-15']").hide();
		}
		if (notification.event.startTime.diffInMinutes() <= 10) {
			$(this).find("[snoozeInMinutes='-10']").hide();
		}
		if (notification.event.startTime.diffInMinutes() <= 5) {
			$(this).find("[snoozeInMinutes='-5']").hide();
		}
		if (notification.event.startTime.diffInMinutes() <= 0) {
			$(this).find("[snoozeInMinutes='0']").hide();
		}
		
	});
}

function dismissFirstEvent() {
	$("#events .dismiss").first().click();
}

document.addEventListener("keydown", function(e) {
	console.log("keydown", e);
	if (e.keyCode == 27) {
		chrome.windows.update(bg.remindersWindow.id, {state:"minimized"});
	} else if (e.keyCode == 68) {
		dismissFirstEvent();
	}
});

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.action == "dismissAll") {
		$("#dismissAll").click();
	} else if (message.action == "removeNotifications") {
		// remove any deleted events
		message.notifications.forEach(function(notification) {
			var event = notification.event;
			var foundEvent = findEventById(event.id);
			if (!foundEvent) {
				console.log("remove event from notifications because it was probably deleted", event);
				var $event = get$EventById(event.id);
				hideNotification($event);
			}
		});
	}
});

function getRemainingNotifications() {
	var remainingNotifications = [];
	
	var $allEvents = $(".event");
	$allEvents.each(function() {
		remainingNotifications.push( $(this).data("notification") );
	});
	
	return remainingNotifications;
}

function resizeToMinimumHeight(height) {
	chrome.windows.getCurrent(function(thisWindow) {
		if (height > thisWindow.height) {
			chrome.windows.update(thisWindow.id, {height:height});
		}
	});
}

$(document).ready(function() {
	
	if (storage.get("hideDelete")) {
		$("body").addClass("hideDelete");
	}
	
	notifications = bg.remindersWindowParams.notifications;
	
	if (notifications.length >= 2) {
		// commented because it "sometimes" wouldn't show??? so using class instead
		//$("#header").show();
		$("#header").addClass("visible");
	}
	
	sortNotifications(notifications);
	
	var SNOOZE_CONTAINER_SELECTOR = "#header, .event";

	$("body").on("click", ".snooze", function() {
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).find("paper-button[snoozeInMinutes='5']").click();
	});

	$("body").on("mouseenter", ".snooze", function() {
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).addClass("snoozeButtonsVisible");
		$(this).attr("icon", "image:looks-5");
	});

	$("body").on("mouseleave", ".snoozeButtons", function() {
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).removeClass("snoozeButtonsVisible");
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).find(".snooze").attr("icon", "av:snooze");
	});

	$("body").on("mouseleave", SNOOZE_CONTAINER_SELECTOR, function() {
		$(this).removeClass("snoozeButtonsVisible");
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).find(".snooze").attr("icon", "av:snooze");
	});
	
	$("body").on("mouseenter", ".delete, .dismiss", function() {
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).removeClass("snoozeButtonsVisible");
		$(this).closest(SNOOZE_CONTAINER_SELECTOR).find(".snooze").attr("icon", "av:snooze");
	});

	$("#settings").click(function() {
		openUrl(chrome.extension.getURL("options.html#notifications"), {urlToFind:chrome.extension.getURL("options.html")});
	});
	
	$("#custom-icons").on("load", function() {
		var customIconsDocument = this.import;
		
		var $events = $("#events");	
		$.each(notifications, function(index, notificationOpened) {
			
			var event = notificationOpened.event;
			
			var $event = $(".eventTemplate").clone();
			$event
				.removeClass("eventTemplate")
				.addClass("event")
				.data("notification", notificationOpened)
			;
			
			setEventIcon(customIconsDocument, event, $event.find(".eventIcon"));
			
			var summary = getSummary(event);
	
			var title;
			var url;
			
			var eventSource = getEventSource(event);
			
			var $linkImage = $event.find(".linkImage");
			
			if (event.hangoutLink) {
				title = event.hangoutLink;
				url = event.hangoutLink;
				$linkImage.attr("icon", "av:videocam");
			} else if (eventSource) {
				// if event source has same title as event then let's use the link url instead
				if (summary == eventSource.title) {
					title = eventSource.url;
				} else {
					title = eventSource.title;
				}
				url = eventSource.url;
				
				if (event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.favIconUrl) {
					$linkImage
						.removeAttr("icon")
						.attr("src", event.extendedProperties.private.favIconUrl)
					;
				} else {
					$event.find(".linkImageWrapper").hide();
				}
			} else if (event.location) {
				title = event.location;
				url = generateLocationUrl(event);
				$linkImage.attr("icon", "maps:place");
			}
			
			if (title) {
				$event.find(".link")
					.text(title)
					.attr("title", url)
					.attr("href", url)
				;
			} else {
				$event.find(".linkWrapper").hide();
			}
			
			if (index == 0) {
				document.title = summary;
			}
			
			var eventHoverTitle = summary;
			if (event.description) {
				eventHoverTitle += "\n\n" + event.description;
			}
			
			$event.find(".title")
				.text(summary)
				.css("color", getEventColor(event))
				.attr("title", eventHoverTitle)
				.click(function(e) {
					console.log("event", e);
					if (isCtrlPressed(e) || event.which == 2) {
						chrome.tabs.create({url:getEventUrl(event), active:false});
					} else {
						openUrl(getEventUrl(event), {urlToFind:event.id});
					}
					sendGA('reminders', "title");
				})
			;
			
			// if title several lines than let's align it to the top
			if (summary.length > 80) {
				$event.find("xx.eventIcon, .title").addClass("self-start");
			}
			
			// init snooze buttons
			if (event.allDay) {
				$event.find(".snoozeBefore").hide();
			}
			
			if (event.recurringEventId) {
				$event.addClass("repeatingEvent");
				$event.find(".repeating")
					.click(function() {
						alert("This is a recurring event")
					})
					.show()
				;
				
				$event.find(".delete").hide();
			}
			
			$event.find(".delete").click({notification:notificationOpened}, function(e) {
				sendGA('reminders', "delete");
				if (event.test) {
					// do nothing - just dismiss
					// must call this after executing deleteEvent (because this next line might close popup)
					dismissNotification([e.data.notification], $event);
				} else if (storage.get("donationClicked")) {
					// must use bg. because we close this window and thus the sendResponse did not return
					bg.deleteEvent(event); // can't catch because we might not return before window closes
					// must call this after executing deleteEvent (because this next line might close popup)
					dismissNotification([e.data.notification], $event);
				} else {
					var $dialog = initTemplate("quotaDialogTemplate");
					
					$dialog.find(".okDialog").click(function() {
						dismissNotification([e.data.notification], $event);
					});
					
					$dialog.find(".contributeButton").click(function() {
						openUrl("donate.html?action=delete").then(() => {
							dismissNotification([e.data.notification], $event);
						});
					});
					
					$dialog.find(".hideDelete").click(function() {
						storage.enable("hideDelete");
						$("body").addClass("hideDelete");
						dismissNotification([e.data.notification], $event);
					});
					
					$dialog.find(".quotaDetails").click(function() {
						openUrl("https://jasonsavard.com/wiki/Google_Calendar_Quota?ref=reminders");
					});
					
					resizeToMinimumHeight(300);
					openDialog($dialog);
				}
			});
			
			$event.find(".dismiss")
				.click({notification:notificationOpened}, function(e) {
					bg.console.log("dismissing: ", e.data);
					sendGA('reminders', "dismiss", "individual", 1);
					
					dismissNotification([e.data.notification], $event);
				})
			;
			
			$events.append($event);
			$event.removeAttr("hidden");
		});

		updateTimeElapsed();
		
		setInterval(function() {
			updateTimeElapsed();
		}, minutes(1));
		
		
		if (!storage.get("donationClicked")) {
			$("paper-button[snoozeInDays], .delete, .more").each(function() {
				$(this)
					.addClass("mustDonate")
					.attr("title", getMessage("donationRequired"))
				;
			});
		}
		
		$("paper-button[snoozeInMinutes], paper-button[snoozeInDays]").click(function() {
			var $event;
			var snoozeAllFlag = $(this).closest("#header").length;
			if (!snoozeAllFlag) {
				$event = get$Event($(this));
			}
			var snoozeParams = {$event:$event, inMinutes:$(this).attr("snoozeInMinutes"), inDays:$(this).attr("snoozeInDays")};
			
			if (snoozeParams.inDays && !storage.get("donationClicked")) {
				var $dialog = initTemplate("contributeDialogTemplate");
				openDialog($dialog).then(function(response) {
					if (response == "cancel") {
						openUrl("donate.html?action=snooze");
					}
				});
			} else {
				snoozeAndClose(snoozeParams, snoozeAllFlag);
				if (snoozeParams.inMinutes) {
					sendGA('reminders', "snooze", "minutes_" + snoozeParams.inMinutes, 1);
				} else {
					sendGA('reminders', "snooze", "days_" + snoozeParams.inDays, 1);
				}
			}
		});
		
		$(".more").click(function() {
			if (storage.get("donationClicked")) {
				var $event = get$Event($(this));
				resizeToMinimumHeight(300);
				$("body").addClass("dateTimePickerVisible");
				$("#dateTimeSnoozeWrapper").data("$event", $event);
			} else {
				var $dialog = initTemplate("contributeDialogTemplate");
				openDialog($dialog).then(function(response) {
					if (response == "cancel") {
						openUrl("donate.html?action=snoozeMore");
					}
				});
			}
		});
		
		$(".closeButton").click(function() {
			$("body").removeClass("dateTimePickerVisible");
		});
		
		$("#dateTimeSnoozeButton").click(function() {
			if (donationClicked("snoozeDateTime")) {
				
				if (!$("#dateSnooze").val().trim() && !$("#timeSnooze").val().trim()) {
					alert("Must enter either a date and/or time!");
					return;
				}
				
				var snoozeTime = $("#dateSnooze").datepicker( "getDate" );
				if (!snoozeTime) {
					snoozeTime = today();
				}
				
				if ($("#timeSnooze").val().trim()) {
					var time;
					
					// see if ie. 24min was entered
					var eventEntry = getEventEntryFromQuickAddText($("#timeSnooze").val());
					if (eventEntry.startTime) {
						time = eventEntry.startTime;
					} else { // else get time from dropdown
						time = $('#timeSnooze').timepicker('getTime');
					}
					snoozeTime.setHours(time.getHours());
					snoozeTime.setMinutes(time.getMinutes());
					snoozeTime.setSeconds(0, 0);
				} else {
					snoozeTime.resetTime();
				}
		
				var snoozeParams = {$event:$("#dateTimeSnoozeWrapper").data("$event"), snoozeTime:snoozeTime};
				snoozeAndClose(snoozeParams, $("#dateTimeSnoozeButton").hasClass("ctrlKey"));
				$("body").removeClass("dateTimePickerVisible");
				sendGA('reminders', "more");
			}
		});	
		
		var datePickerParams = generateDatePickerParams(storage);
		
		if ($("#dateSnooze").datepicker) {
			$("#dateSnooze").datepicker(datePickerParams);
		}
		
		var timePickerParams = generateTimePickerParams();
		if ($('#timeSnooze').timepicker) {
			$('#timeSnooze').timepicker(timePickerParams);	
		}
		$('#timeSnooze').off("keydown").on("keydown", function(e) {
			if (e.keyCode == 13) {
				console.log("enter");
				e.preventDefault();
				$('#timeSnooze').timepicker('hide');
				$("#dateTimeSnoozeButton").click();
				return false;
			} else if (e.keyCode == 27) {
				$('#timeSnooze').timepicker('hide');
				return false;
			}
		});
		
		$("#dismissAll").click(function() {
			
			var notifications = getRemainingNotifications();
			
			// cpu intensive so let's delay the execution til after we close the window
			bg.closeNotificationsDelayed(notifications);
			
			sendGA('reminders', "dismiss", "dismissAll");
			closeWindow();
		});
		
		if (getUrlValue(location.href, "closeWindowGuide")) {
			var $dialog = initTemplate("closeWindowDialogTemplate");
			openDialog($dialog);
		}		
	
	});

});