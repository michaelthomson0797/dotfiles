var storage = bg.storage;
var playing;
var justInstalled = getUrlValue(location.href, "action") == "install";

function reloadExtension() {
	if (chrome.runtime.reload) {
		chrome.runtime.reload();
	} else {
		niceAlert("You must disable/re-enable the extension in the extensions page or restart the browser");
	}
}

function showOptionsSection(optionsSection) {
	console.log("showOptionsSection: " + optionsSection)
	$("#mainTabs")[0].selected = optionsSection;
	$("#pages")[0].selected = optionsSection;
}

function maybeShowWidgetMenu() {
	var $widgetTab =  $("paper-tab[value='widget']");
	if (!$widgetTab.is(":visible")) {
		chrome.runtime.sendMessage("llaficoajjainaijghjlofdfmbjpebpa", {action:"sayHello"}, function() {
			if (chrome.runtime.lastError) {
				// nothing
			} else {
				$widgetTab.removeAttr("hidden");
			}
		});
	}
}

function testNotification(params, callback) {
	var cal = getPrimaryCalendar(bg.getArrayOfCalendars());
	
	var reminderTimes = [];
	reminderTimes.push({shown:false, time:new Date()})
	var notificationEvent = {test:true, allDay:false, title:getMessage("testEvent"), summary:getMessage("testEvent"), description:getMessage("testDescription"), startTime:new Date(), reminderTimes:reminderTimes, calendar:cal};
	var notification = {time:new Date(), reminderTime:new Date(), event:notificationEvent};
	bg.notificationsQueue.push(notification);
	bg.playNotificationSound(notification);
	bg.showNotifications(params, callback);
}

function loadVoices() {
	console.log("loadVoices");
	if (chrome.tts) {
		chrome.tts.getVoices(function(voices) {
			
			var options = [];
			
			for (var i=0; i<voices.length; i++) {
				var voiceLabel;
				var voiceValue;
				if (voices[i].voiceName == "native") {
					voiceLabel = getMessage("native");
					voiceValue = "native";
				} else {
					voiceLabel = voices[i].voiceName;
					voiceValue = voices[i].voiceName;
					if (voices[i].extensionId) {
						voiceValue += "___" + voices[i].extensionId;
					}
				}

				var optionsObj = {value:voiceValue, label:voiceLabel};
				
				// make native first
				if (voiceValue == "native") {
					options.unshift(optionsObj);
				} else {
					options.push(optionsObj);
				}
	      	}
			
			var t = document.querySelector('#t');
			// could only set this .data once and could not use .push on it or it breaks the bind
			
			if (t) {
				t.data = options;
				
				var voiceIndexMatched = getDefaultVoice(voices, true);
				if (voiceIndexMatched != -1) {
					options.some(function(option) {
						if (option.voiceName == voices[voiceIndexMatched].voiceName) {
							var selectedValue = options[++voiceIndexMatched].value;
							$("#voiceMenu")[0].select(selectedValue);
							$("#voiceOptions").show();
							return true;
						}
					});
				} else {
					$("#voiceOptions").hide();
				}
			}
			
	    });
	}
}

function playSound(soundName) {
	if (!soundName) {
		soundName = storage.get("notificationSound");
	}
	$("#playNotificationSound").attr("icon", "av:stop");
	playing = true;
	bg.playNotificationSoundFile(soundName).then(function() {
		playing = false;
		$("#playNotificationSound").attr("icon", "av:play-arrow");
	});
}

function playVoice() {
	$("#playVoice").attr("icon", "av:stop")
	bg.ChromeTTS.queue($("#voiceTestText").val(), null, function() {
		$("#playVoice").attr("icon", "av:play-arrow");
	});
}

function initSelectedTab() {
	var tabId = location.href.split("#")[1];
	
	if (tabId) {
		// detect if this options windows was opened by the configure button via the ANTP window ie. options.html#%7B%22id%22%3A%22pafgehkjhhdiomdpkkjhpiipcnmmigcp%22%7D which decodes to options.html#{"id":"pafgehkjhhdiomdpkkjhpiipcnmmigcp"}
		var id;
		try {
			id = JSON.parse( decodeURIComponent(window.location.hash).substring(1) ).id
		} catch (e) {
			// do nothing
		}
		
		if (id) {
			showOptionsSection("widget");
		} else {
			showOptionsSection(tabId);	
		}
	} else {
		showOptionsSection("notifications");
	}
}

function initGrantedAccountDisplay() {
	console.log("initGrantedAccountDisplay")
	if (!bg.email) {
		hideError();
		$("#guideGrantAccessButton").slideDown();
		$("#guides").slideUp();
		$("#oauthNotGranted").slideDown();
	} else if (!bg.oAuthForDevices.findTokenResponse({userEmail:bg.email})) {	
		// only show warning if we did not arrive from popup warning already
		if (getUrlValue(location.href, "accessNotGranted")) {
			hideError();
		} else {
			if (!justInstalled && location.hash != "#accounts") {
				showError(getMessage("accessNotGrantedSeeAccountOptions", ["", getMessage("accessNotGrantedSeeAccountOptions_accounts")]), {
					text: getMessage("accounts"),
					onClick: function() {
						showOptionsSection("accounts");
						hideError();
					}
				});
			} else {
				hideError();
			}
		}
		
		$("#defaultAccountEmail").text(bg.email);
		$("#defaultAccount").show();
		
		$("#guideGrantAccessButton").slideDown();
		$("#guides").slideUp();
		$("#oauthNotGranted").slideDown();
	} else {
		hideError();
		$("#guideGrantAccessButton").slideUp();
		$("#guides").slideDown();
		$("#oauthNotGranted").slideUp();
	}

	if (bg && bg.oAuthForDevices) {
		var userEmails = bg.oAuthForDevices.getUserEmails();
		
		if (userEmails.length) {
			$("#emailsGrantedPermissionToContacts").empty();
			$.each(userEmails, function(index, userEmail) {
				$("#emailsGrantedPermissionToContacts").append(userEmail + "&nbsp;");
			});
			$("#oauthOptions").slideDown();
			loadCalendarReminders();
		} else {
			$("#oauthOptions").slideUp();
		}
	}
}

function getCalendarFromNode(node) {
	var calendarId = $(node).closest("[calendar-id]").attr("calendar-id");
	var calendars = bg.getArrayOfCalendars();
	
	var calendarReminderModified;
	calendars.some(function(calendar) {
		if (calendar.id == calendarId) {
			calendarReminderModified = calendar;
			return true;
		} 
	});
	
	return calendarReminderModified;
}

function sendPatchCommand(calendarReminderModified) {
	console.log("saving: ", calendarReminderModified.defaultReminders)
	
	var data = {
		defaultReminders: calendarReminderModified.defaultReminders
	}

	var sendParams = {
		userEmail: bg.email,
		type: "patch",
		contentType: "application/json; charset=utf-8",
		url: "/users/me/calendarList/" + encodeURIComponent(calendarReminderModified.id),
		data: JSON.stringify(data)
	};
	
	oauthDeviceSend(sendParams).then(function(response) {
		storage.remove("cachedFeeds");
		showMessage("Synced with Google Calendar");
		return bg.checkEvents();
	}).catch(function(error) {
		showError("Error saving: " + error, {
			text: getMessage("refresh"),
			onClick: function() {
				showLoading();
				bg.pollServer({source:"refresh"}).then(function() {
					location.reload(true);
				});
			}
		});
	});
}

var saveCalendarRemindersTimeout;

function saveCalendarReminders(node) {
	
	clearTimeout(saveCalendarRemindersTimeout);
	
	saveCalendarRemindersTimeout = setTimeout(function() {
		var $reminderMinutes = $(node).find(".reminderMinutes");
		var $reminderValuePerPeriod = $(node).find(".reminderValuePerPeriod");
		var $reminderPeriod = $(node).find(".reminderPeriod");
		var $lastUpdated = $(node).find(".lastUpdated");
		
		updateReminderMinutes($reminderPeriod, $reminderMinutes, $reminderValuePerPeriod)
		
		$lastUpdated.prop("value", new Date());
		
		var calendarReminderModified = getCalendarFromNode(node);
		
		console.log(calendarReminderModified)

		sendPatchCommand(calendarReminderModified);
	}, seconds(2));
}

function initCalendarReminders() {
	$(".calendarReminder").each(function() {
		var $calendarReminder = $(this);
		
		var that = this;
		var $reminderMethod = $calendarReminder.find(".reminderMethod");
		var $reminderMinutes = $calendarReminder.find(".reminderMinutes");
		var $reminderValuePerPeriod = $calendarReminder.find(".reminderValuePerPeriod");
		var $reminderPeriod = $calendarReminder.find(".reminderPeriod");
		var $deleteReminder = $calendarReminder.find(".deleteReminder");

		initReminderPeriod($reminderValuePerPeriod, $reminderPeriod, $reminderMinutes);
		
		// MUST USE .off for all events here

		$reminderMethod.find("paper-item").off().click(function() {
			saveCalendarReminders(that);
		});

		$reminderValuePerPeriod.off().keyup(function() {
			saveCalendarReminders(that);
		});

		$reminderPeriod.find("paper-item").off().click(function() {
			saveCalendarReminders(that);
		});
		
		$deleteReminder.off().click(function() {
			// must fetch this reminderMinutes because the varaiable above is passed by value and not reference so it might have changes ince
			var reminderMinutes = $(this).closest(".calendarReminder").find(".reminderMinutes")[0].value;
			
			var calendarReminderModified = getCalendarFromNode(that);
			calendarReminderModified.defaultReminders.some(function(defaultReminder, index) {
				if (defaultReminder.method == $reminderMethod[0].selected && defaultReminder.minutes == reminderMinutes) {
					calendarReminderModified.defaultReminders.splice(index, 1);
					return true;
				}
			});
			
			$calendarReminder.slideUp();
			
			sendPatchCommand(calendarReminderModified);
		});
		
	});
	
	$(".calendarReminderLineCheckbox").off().on("click", function() {
		var calendar = getCalendarFromNode(this);
		var excludedCalendars = storage.get("excludedCalendars");
		
		if (this.checked) {
			removeFromArray(calendar.id, excludedCalendars);
			$(this).closest(".calendarReminderLine").removeAttr("excluded");
		} else {
			addToArray(calendar.id, excludedCalendars);
			$(this).closest(".calendarReminderLine").attr("excluded", "");
			
			showMessage("Notifications removed. To hide this calendar use the ≡ menu in the popup", 5);
		}

		storage.set("excludedCalendars", excludedCalendars);
	});
}

function loadCalendarReminders() {
	console.log("loadCalendarReminders");
	//var t = document.querySelector('#calendarRemindersBind');
	// could only set this .data once and could not use .push on it or it breaks the bind
	
	var calendars = bg.getArrayOfCalendars();
	
	if (calendars.length == 0) {
		console.log("no calendars found");
		return;
	}
	
	calendars.forEach(function(calendar) {
		calendar.defaultReminders.sort(function(a, b) {
			if (a.minutes > b.minutes) {
				return +1;
			} else {
				return -1;
			}
		});
	});

	var $calendarColors = $("#calendarColors");
	var calendarColors = bg.cachedFeeds["colors"];
	console.log("colors", calendarColors);
	if (calendarColors) {
		for (key in calendarColors.calendar) {
			var colorObj = calendarColors.calendar[key];
			$calendarColors.append("[color-id='" + key + "'] .checked.paper-checkbox {background-color:" + colorObj.background + " !important}\n");
			$calendarColors.append("[color-id='" + key + "'] .checked.paper-checkbox {border-color:" + colorObj.background + " !important}\n");
		}
	}

	$("calendar-reminders").prop("calendars", calendars);
	
	patchToRemoveStyleScope(document.getElementsByTagName("calendar-reminders")[0]);
	
	setTimeout(function() {
		initCalendarReminders();
	}, 1);
}

function openNotificationPermissionIssueDialog(error) {
	openGenericDialog({
		title: "Permission denied!",
		content: "You might have disabled the notifications. Error: " + error,
		cancelLabel: getMessage("moreInfo")
	}).then(response => {
		if (response != "ok") {
			window.open("https://support.google.com/chrome/answer/3220216");
		}
	});

}

$(document).ready(function() {
	
	polymerPromise.then(function() {
		
		if (!window.bg) { //bg.oAuthForDevices
			setInterval(function() {
				window.bg = chrome.extension.getBackgroundPage();
				if (window.bg) {
					location.reload();
				}
			}, 3000);
			return;
		}
		
		$("#mainTabs paper-tab").click(function(e) {
			var tabName = $(this).attr("value");
			$("#mainTabs")[0].selected = tabName;
			$("#pages")[0].selected = tabName;
			history.pushState({}, "blah", "#" + tabName);
		});
		
		if (bg.email == atob("amFzb25zYXZhcmRAZ21haWwuY29t")) {
			$("#exportLocalStorage").click(function() {
				downloadObject(localStorage);
			})
			$("#importLocalStorage").click(function() {
				var localStorageText = $("#localStorageText").val();
				if (localStorageText) {
					var localStorageImportObj = JSON.parse(localStorageText);
					localStorage.clear();
					for (item in localStorageImportObj) {
						localStorage.setItem(item, localStorageImportObj[item]);
					}
					openGenericDialog({title: "Done. Reload the extension to use these new settings!"});
				} else {
					openGenericDialog({title: "Must enter localStorage JSON string!"});
				}
			})
	
			$("#testSection").show();
		}
		
		
		$(window).focus(function(event) {
			console.log("window.focus");
			// reload voices
			loadVoices();
		});
		
		loadVoices();
		// seems we have to call chrome.tts.getVoices twice at a certain 
		if (DetectClient.isLinux()) {
			setTimeout(function() {
				loadVoices();
			}, seconds(1));
		}
		
		Polymer({
			is: "calendar-reminders",
			properties: {
				data: {
					type: Array,
					notify: true,
					value: []
		    	}
			},
			displayCalendarName: function(calendar) {
		        return getCalendarName(calendar);
		    },
		    isCalendarExcluded: function(calendar) {
		    	return isCalendarExcluded(calendar);
		    },
		    canCalendarHaveReminders: function(calendar) {
		    	return isCalendarWriteable(calendar) || (calendar.defaultReminders && calendar.defaultReminders.length);
		    },
			addReminder: function(e) {
				//console.log("model", e.model);
				//console.log("item", e.model.item);
				//console.log("this", this);
				//console.log("index", e.model.index); 
			    //this.set('item', "blah");
				//console.log("data", e.model.__data__["item.defaultReminders"]);
				this.push('calendars.' + e.model.index + '.defaultReminders', {method:"popup", minutes:"10"});
				//e.model.push("defaultReminders", {method:"popup", minutes:10});
				//e.model.__data__["item.defaultReminders"].push({method:"popup", minutes:10});
				
				setTimeout(function() {
					initCalendarReminders();
					
					var $calendarReminderLine = $("calendar-reminders").find(".calendarReminderLine").eq(e.model.index);
					var $newlyAddedCalendarReminder = $calendarReminderLine.find(".calendarReminder").last();
					saveCalendarReminders($newlyAddedCalendarReminder);
				}, 1);
			}
		});
		
		$("#notificationVoice").on("click", "paper-item", function() {
			var voiceName = $("#voiceMenu")[0].selected;
			//var voiceName = $(this).val(); // commented because .val would not work for non-dynamically values like addVoice etc.
			
			if (voiceName) {
				if (voiceName == "addVoice") {
					openUrl("https://jasonsavard.com/wiki/Voice_Notifications");
				} else {
					
					if (voiceName.indexOf("Multilingual TTS Engine") != -1) {
						$("#pitch, #rate").attr("disabled", "true");
					} else {
						$("#pitch, #rate").removeAttr("disabled");
					}
					
					playVoice();
				}
				$("#voiceOptions").fadeIn();
			} else {
				$("#voiceOptions").hide();
			}
		});
		
		$("#playVoice").click(function() {
			playVoice()
		});
		
		$("#voiceOptions paper-slider").on("change", function() {
			setTimeout(function() {
				playVoice();
			}, 100);
		});
		
		$("#showConsoleMessagesOptions").toggle(localStorage["console_messages"] == "true");
		if ($("#showConsoleMessages").length) {
			$("#showConsoleMessages")[0].checked = localStorage["console_messages"] == "true";
		}
		$("#showConsoleMessages").change(function() {
			if (this.checked) {
				localStorage.console_messages = true
				$("#showConsoleMessagesOptions").slideDown();
			} else {
				localStorage.removeItem("console_messages");
				$("#showConsoleMessagesOptions").slideUp();
			}
			initConsole();
		});
		
		$("#maxDaysAhead paper-item").click(function() {
			setTimeout(function() {
				bg.checkEvents({ignoreNotifications:true});
			}, 200);
		});
		
		$("[storage='24hourMode'], #showEventTimeOnBadge, #showEventTimeOnBadgeOptions paper-checkbox, #showDayOnBadge, #showDayOnBadgeOptions paper-checkbox, #excludeRecurringEventsButtonIcon, #excludeHiddenCalendarsFromButton, #showButtonTooltip").change(function() {
			setTimeout(function() {
				bg.checkEvents({ignoreNotifications:true});
			}, 200);
		});
		
		$("#showTimeSpecificEventsBeforeAllDay").change(function() {
			setTimeout(function() {
				bg.pollServer({source:"showTimeSpecificEventsBeforeAllDay"});
			}, 200);
		});		

		$("#browserButtonAction paper-item").click(function() {
			setTimeout(function() {
				bg.initPopup();
			}, 200)
		});
		
		if (storage.get("showEventTimeOnBadge")) {
			$("#showEventTimeOnBadgeOptions").show();
		} else {
			$("#showEventTimeOnBadgeOptions").hide();
		}
		
		$("#showEventTimeOnBadge").change(function() {
			if (this.checked) {
				$("#showEventTimeOnBadgeOptions").slideDown();
			} else {
				$("#showEventTimeOnBadgeOptions").slideUp();
			}
		});
	
		if (storage.get("showDayOnBadge")) {
			$("#showDayOnBadgeOptions").show();
		} else {
			$("#showDayOnBadgeOptions").hide();
		}
		
		$("#showDayOnBadge").change(function() {
			if (this.checked) {
				$("#showDayOnBadgeOptions").slideDown();
			} else {
				$("#showDayOnBadgeOptions").slideUp();
			}
		});
	
		$("#showContextMenuItem").change(function(e) {
			if (this.checked) {
				bg.addChangeContextMenuItems();
			} else {
				chrome.contextMenus.removeAll();
			}
		});
	
		if (justInstalled) {
			showOptionsSection("welcome");
			
			if (DetectClient.isOpera()) {
				if (!window.Notification) {
					openGenericDialog({title: "Desktop notifications are not yet supported in this browser!"});
				}
				if (window.chrome && !window.chrome.tts) {
					openGenericDialog({title: "Voice notifications are not yet supported in this browser!"});
				}
				openGenericDialog({
					title: "You are not using the stable channel of Chrome!",
					content:"Bugs might occur, you can use this extension, however, for obvious reasons,<br>these bugs and reviews will be ignored unless you can replicate them on stable channel of Chrome.",
					cancelLabel:getMessage("moreInfo")
				}).then(response => {
					if (response != "ok") {
						window.open("https://jasonsavard.com/wiki/Unstable_channel_of_Chrome");
					}
				});
			}
	
			// check for sync data
			bg.syncOptions.fetch().then(function(items) {
				console.log("fetch response", items);
				openGenericDialog({
					title: "Restore settings",
					content: "Would you like to use your previous extension options? <div style='margin-top:4px;font-size:12px;color:gray'>(If you had previous issues you should do this later)</div>",
					showCancel: true
				}).then(function(response) {
					if (response == "ok") {
						bg.syncOptions.load(items).then(function(items) {
							openGenericDialog({
								title: "Options restored!",
								okLabel: "Restart extension"
							}).then(response => {
								reloadExtension();
							});
						}).catch(function(error) {
							openGenericDialog({
								title: "Error loading settings", 
								content: error
							});
						});
					}
				});
			}).catch(function(error) {
				console.error("error fetching: ", error);
			});
		} else {
			initSelectedTab();
		}
		
		window.onpopstate = function(event) {
			console.log(event);
			initSelectedTab();
		}
		
		var navLang = storage.get("lang");
		if ($("#lang").find("[value='" + navLang + "']").exists()) {
			$("#lang")[0].selected = navLang;
		} else if ($("#lang").find("[value='" + navLang.substring(0, 2) + "']").exists()) {
			$("#lang")[0].selected = navLang.substring(0, 2);
		} else {
			$("#lang").val("en");
		}
	
		$("#lang paper-item").click(function() {
			var langValue = $("#lang")[0].selected;
			loadLocaleMessages(langValue).then(() => {
				initMessages();
				initMessagesInTemplates();
				initCalendarNames(bg.dateFormat.i18n);
				return bg.checkEvents({ignoreNotifications:true});
			}).catch(error => {
				showError(error);
			});
		});
	
		$("#currentBadgeIcon").attr("src", getBadgeIconUrl("", true));
		$("#badgeIcon paper-icon-item").click(function() {
			$("#currentBadgeIcon").attr("src", getBadgeIconUrl("", true));
			bg.updateBadge({forceRefresh:true});
		});
	
		if (storage.get("donationClicked")) {
			$("[mustDonate]").each(function(i, element) {
				$(this).removeAttr("mustDonate");
			});
		}
		
		initGrantedAccountDisplay();
		
		chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
			console.log("message rec", message);
			if (message.command == "featuresProcessed") {
				$("[mustDonate]").each(function(i, element) {
					$(this).removeAttr("mustDonate");
				});
			} else if (message.command == "grantPermissionToCalendars") {
				if (!DetectClient.isChrome()) {
					showLoading();
				}
			} else if (message.command == "grantPermissionToCalendarsAndPolledServer") {
				if ($("#emailsGrantedPermissionToContacts").html().indexOf(message.email) == -1) {
					$("#emailsGrantedPermissionToContacts").append("&nbsp;" + message.email);
				}
				
				initGrantedAccountDisplay();

				hideLoading();
			}
		});
	
		$("#fetchCalendarSettings").click(function() {
			bg.fetchCalendarSettings({bypassCache:true, email:bg.email}).then(response => {
				alert("Done");
			}).catch(error => {
				alert("problem: " + error)
			});
		});
		
		function clearData() {
			localStorage.clear();
			storage.clear();
			
			openGenericDialog({
				title: "Data cleared!",
				content:"You will have to re-exclude your excluded calendars again!<br><br>Click OK to restart extension.",
			}).then(response => {
				if (response == "ok") {
					reloadExtension();
				}
			});
		}
		
		$("#clearData").click(function() {
			var snoozers = getSnoozes(storage.get("snoozers"));
			if (snoozers.length) {
				openGenericDialog({
					content: "You have some snoozed events which will be fogotten after clearing the data.<br><br>Do you want to take note of them?",
					okLabel: getMessage("snoozedEvents"),
					cancelLabel: "Ignore"
				}).then(response => {
					if (response == "ok") {
						openReminders({notifications:snoozers.shallowClone()});
					} else {
						clearData();
					}
				});
			} else {
				clearData();
			}
			return false;
		});

		$("#runInBackground").click(function() {
			var that = this;
			// timeout to let permissions logic determine check or uncheck the before
			setTimeout(function() {
				if (that.checked) {
					openDialog("runInBackgroundDialogTemplate");
				}
			}, 1);
		});
		
		var notificationSound = storage.get("notificationSound");
		if (notificationSound) {
			$("#soundOptions").show();
		} else {
			$("#soundOptions").hide();
		}
		
		$("#notificationSound paper-item").click(function() {
			var soundName = $(this).attr("value");
	
			$("#playNotificationSound").css("display", "block");
			
			if (soundName == "custom") {
				$("#notificationSoundInputButton").click();
			} else {
				playSound(soundName);
			}
			
			if (soundName) {
				$("#soundOptions").fadeIn();
			} else {
				$("#soundOptions").hide();
			}
		});
		
		$("#playNotificationSound").click(function() {
			if (playing) {
				bg.notificationAudio.pause();
				bg.notificationAudio.currentTime = 0;
				playing = false;
				$(this).attr("icon", "av:play-arrow");
			} else {
				playSound();
			}
		});
		
		$("#notificationSoundVolume").on("change", function() {
			setTimeout(function() {
				playSound();
			}, 100);
		});
		
		$("#notificationSoundInputButton").change(function() {
			var file = this.files[0];
			var fileReader = new FileReader();
	
			fileReader.onloadend = function () {
				storage.set("notificationSoundCustom", this.result).then(() => {
					playSound();
				}).catch(error => {
					openGenericDialog({content: "The file you have chosen is too large, please select a shorter sound alert."});
					storage.remove("notificationSoundCustom");
				});
			}
	
			fileReader.onabort = fileReader.onerror = function () {
				niceAlert("Problem loading file");
			}
	
			console.log("file", file)
			fileReader.readAsDataURL(file);	
		});
	
	    $("#logo").dblclick(function() {
	    	storage.toggle("donationClicked");
	    	location.reload(true);
	    });
		
		$(".grantAccessButton, #grantAccessAgain").click(function() {
			bg.oAuthForDevices.openPermissionWindow();
		});
		
		$("#revokeAccess").click(function() {
			storage.remove("tokenResponses");
			storage.remove("snoozers");
			bg.events = [];
			bg.oAuthForDevices.removeAllTokenResponses();
			$("#emailsGrantedPermissionToContacts").empty();
			$("#defaultAccountEmail").text(bg.email);
			$("#oauthNotGranted").show();
			$("#oauthOptions").hide();
			showMessage("Done");
		});
	
		function initNotifications(startup) {
			var showMethod;
			var hideMethod;
			if (startup) {
				showMethod = "show";
				hideMethod = "hide";
			} else {
				showMethod = "slideDown";
				hideMethod = "slideUp";
			}
			
			var desktopNotification = storage.get("desktopNotification");
			if (desktopNotification == "") {
				$("#desktopNotificationOptions")[hideMethod]();
			} else if (desktopNotification == "text") {
				$("#desktopNotificationOptions")[showMethod]();
				$("#richNotificationOptions")[hideMethod]();
				$("#popupWindowNotificationOptions")[hideMethod]();
			} else if (desktopNotification == "rich") {
				$("#desktopNotificationOptions")[showMethod]();
				$("#richNotificationOptions")[showMethod]();
				$("#popupWindowNotificationOptions")[hideMethod]();
			} else if (desktopNotification == "popupWindow") {
				$("#desktopNotificationOptions")[showMethod]();
				$("#richNotificationOptions")[hideMethod]();
				$("#popupWindowNotificationOptions")[showMethod]();
			}
		}
		
		initNotifications(true);
		
		$("#desktopNotification paper-item").click(function() {
			initNotifications();
		});
		
		$("#testNotification").click(function() {
			if (storage.get("desktopNotification") == "text") {
				Notification.requestPermission(function(permission) {
					if (permission == "granted") {
						testNotification({testType:"text"}, function(notificationResponse) {
							if (notificationResponse && notificationResponse.error) {
								showError("Error: " + notificationResponse.error);
							}
						});
					} else {
						openNotificationPermissionIssueDialog(permission);
					}
				});
			} else if (storage.get("desktopNotification") == "rich") {
				testNotification({testType:"rich"}, function(notificationResponse) {
					console.log("notifresponse: ", notificationResponse)
					if (notificationResponse && notificationResponse.error) {
						openNotificationPermissionIssueDialog(notificationResponse.error);
					}
				});
			} else if (storage.get("desktopNotification") == "popupWindow") {
				testNotification({testType:"popupWindow"}, function(notificationResponse) {
					console.log("notifresponse: ", notificationResponse)
					if (notificationResponse && notificationResponse.error) {
						openNotificationPermissionIssueDialog(notificationResponse.error);
					}
				});
			}
		});
		
		$("#pendingNotificationsInterval").change(function() {
			bg.ForgottenReminder.stop();
		});
	
		$("#testPendingReminder").click(function() {
			openGenericDialog({content:"Click OK to see the toolbar button animate :)"}).then(function(response) {
				bg.ForgottenReminder.execute({test:true});
			});
		});
		
		$(".snoozeOption").each(function(index, option) {
			$(option).text(getMessage("snooze") + " " + $(option).text().replaceAll("\n", "").trim());
		});
	
		$("#saveSyncOptions").click(function() {
			bg.syncOptions.save("manually saved").then(function() {
				openGenericDialog({
					title: "Done",
					content: "Make sure you are signed into Chrome for the sync to complete",
					cancelLabel: getMessage("moreInfo")
				}).then(response => {
					if (response == "cancel") {
						openUrl("https://support.google.com/chrome/answer/185277");
					}
				});
			}).catch(function(error) {
				showError("Error: " + error);
			});
			return false;
		});
	
		$("#loadSyncOptions").click(function() {
			bg.syncOptions.fetch(function(response) {
				// do nothing last fetch will 
				console.log("syncoptions fetch response", response);
			}).catch(function(response) {
				console.log("catch reponse", response);
				// probably different versions
				if (response && response.items) {
					return new Promise(function(resolve, reject) {
						openGenericDialog({
							title: "Problem",
							content: response.error + "<br><br>" + "You can force it but it might create issues in the extension and the only solution will be to re-install without loading settings!",
							okLabel: "Force it",
							showCancel: true
						}).then(function(dialogResponse) {
							if (dialogResponse == "ok") {
								resolve(response.items);
							} else {
								reject("cancelledByUser");
							}
						});
					});
				} else {
					throw response;
				}
			}).then(function(items) {
				console.log("syncoptions then");
				return bg.syncOptions.load(items);
			}).then(() => {
				openGenericDialog({
					title: "Click OK to restart the extension!"
				}).then(response => {
					if (response == "ok") {
						reloadExtension();
					}
				});
			}).catch(error => {
				console.log("syncoptions error: " + error);
				if (error != "cancelledByUser") {
					openGenericDialog({
						content: "error loading options: " + error
					});
				}
			});
			
			return false;
		});
		
		maybeShowWidgetMenu();
		setInterval(function() {
			maybeShowWidgetMenu();
		}, 2000)
		
		$("#widgetWidth paper-item, #widgetHeight paper-item").click(function() {
			setTimeout(function() {
				sendFVDInfo();
			}, 200);
		});
	
		Polymer.dom($("#version")[0]).textContent = "v." + chrome.runtime.getManifest().version;
		$("#version").click(function() {
			showLoading();
			chrome.runtime.requestUpdateCheck(function(status, details) {
				hideLoading();
				console.log("updatechec:", details)
				if (status == "no_update") {
					openGenericDialog({title:"No update!", otherLabel: "More info"}).then(function(response) {
						if (response == "other") {
							location.href = "https://jasonsavard.com/wiki/Extension_Updates";
						}
					})
				} else if (status == "throttled") {
					openGenericDialog({title:"Throttled, try again later!"});
				} else {
					openGenericDialog({title:"Response: " + status + " new version " + details.version});
				}
			});
		});

		$("#refresh").click(function() {
			showLoading();
			bg.pollServer({source:"refresh"}).then(function() {
				location.reload(true);
			});
		});
		
		$("#notificationsGuide").click(function() {
			showOptionsSection("notifications");
			sendGA("guide", "notifications");
		});

		// moved to end because some polymer dropdowns default values were not correctly populating with my msg parsing
		initOptions();

		setTimeout(function() {
			$("body").removeAttr("jason-unresolved");
			$("body").addClass("explode");
		}, 200)

	});
	
});