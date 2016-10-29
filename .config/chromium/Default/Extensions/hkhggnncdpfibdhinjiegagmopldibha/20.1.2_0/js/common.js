// Copyright 2016 Jason Savard
// Becareful because this common.js file is loaded on websites for content_scripts and we don't want errors here

var DetectClient = {};
DetectClient.isChrome = function() {
	return /chrome/i.test(navigator.userAgent) && !DetectClient.isEdge();
}
DetectClient.isFirefox = function() {
	return /firefox/i.test(navigator.userAgent);
}
DetectClient.isEdge = function() {
	return /edge/i.test(navigator.userAgent);
}
DetectClient.isWindows = function() {
	return /windows/i.test(navigator.userAgent);
}
DetectClient.isNewerWindows = function() {
	return navigator.userAgent.match(/Windows NT 1\d\./i) != null; // Windows NT 10+
}
DetectClient.isMac = function() {
	return /mac/i.test(navigator.userAgent);
}
DetectClient.isLinux = function() {
	return /linux/i.test(navigator.userAgent);
}
DetectClient.isOpera = function() {
	return /opera/i.test(navigator.userAgent);
}
DetectClient.isRockMelt = function() {
	return /rockmelt/i.test(navigator.userAgent);
}
DetectClient.isChromeOS = function() {
	return /cros/i.test(navigator.userAgent);
}
DetectClient.getChromeChannel = function() {
	return new Promise((resolve, reject) => {
		if (DetectClient.isChrome()) {
			$.getJSON("https://omahaproxy.appspot.com/all.json?callback=?", function(data) {
				var versionDetected;
				var stableDetected = false;
				for (var a=0; a<data.length; a++) {

					var osMatched = false;
					// patch because Chromebooks/Chrome OS has a platform value of "Linux i686" but it does say CrOS in the useragent so let's use that value
					if (DetectClient.isChromeOS()) {
						if (data[a].os == "cros") {
							osMatched = true;
						}
					} else { // the rest continue with general matching...
						if (navigator.userAgent.toLowerCase().indexOf(data[a].os) != -1) {
							osMatched = true;
						}
					}
					
					if (osMatched) {
						for (var b=0; b<data[a].versions.length; b++) {
							if (navigator.userAgent.indexOf(data[a].versions[b].previous_version) != -1 || navigator.userAgent.indexOf(data[a].versions[b].version) != -1) {
								// it's possible that the same version is for the same os is both beta and stable???
								versionDetected = data[a].versions[b];
								if (data[a].versions[b].channel == "stable") {
									stableDetected = true;
									resolve(versionDetected);
									return;
								}
							}
						}
					}
				}

				// probably an alternative based browser like RockMelt because I looped through all version and didn't find any match
				if (data.length && !versionDetected) {
					resolve({channel:"alternative based browser"});
				} else {
					resolve(versionDetected);
				}
			});			
		} else {
			reject("Not Chrome");
		}
	});
}

if (!window.bg) {
	if (isInternalPage()) {
		if (chrome && chrome.extension && chrome.extension.getBackgroundPage) {
			window.bg = chrome.extension.getBackgroundPage();
		} else {
			console.warn("JError: no access to background");
		}
	}
}

window.onerror = function(msg, url, line) {
	var thisUrl = removeOrigin(url).substr(1); // also remove beginning slash '/'
	var thisLine;
	if (line) {
		thisLine = " (" + line + ") ";
	} else {
		thisLine = " ";
	}
	var action = thisUrl + thisLine + msg;
	
	sendGAError(action);
	
	function customShowError(error) {
		$(document).ready(function() {
			$("body")
				.show()
				.removeAttr("hidden")
				.css("opacity", 1)
				.prepend( $("<div style='background:red;color:white;padding:5px;z-index:999'>").text(error) )
			;
		});
	}
	
	var errorStr = msg + " (" + thisUrl + " " + line + ")";

	if (window.polymerPromise2 && window.polymerPromise2.then) {
		polymerPromise2.then(() => {
			if (window.showError) {
				showError(errorStr);
			} else {
				customShowError(errorStr);
			}
		}).catch(error => {
			customShowError(errorStr);
		});
	} else {
		customShowError(errorStr);
	}
	
	//return false; // false prevents default error handling.
};

// usage: [url] (optional, will use location.href by default)
function removeOrigin(url) {
	var linkObject;
	if (arguments.length && url) {
		try {
			linkObject = document.createElement('a');
			linkObject.href = url;
		} catch (e) {
			console.error("jerror: could not create link object: " + e);
		}
	} else {
		linkObject = location;
	}
	
	if (linkObject) {
		return linkObject.pathname + linkObject.search + linkObject.hash;
	} else {
		return url;
	}
}

// anonymized email by using only 3 letters instead to comply with policy
function getUserIdentifier() {
	var attribute = "email";
	
	// seems it didn't exist sometimes!
	if (window) {
		var str;
		
		if (window[attribute]) {
			str = window[attribute];
		} else if (window.bg && window.bg[attribute]) {
			str = window.bg[attribute];
		}
		
		if (str) {
			str = str.split("@")[0].substr(0,3);
		}
		return str;
	}
}

function sendGAError(action) {
	// google analytics
	var JS_ERRORS_CATEGORY = "JS Errors";
	if (typeof sendGA != "undefined") {
		// only action (no label) so let's use useridentifier
		var userIdentifier = getUserIdentifier();
		if (arguments.length == 1 && userIdentifier) {
			sendGA(JS_ERRORS_CATEGORY, action, userIdentifier);
		} else {
			// transpose these arguments to sendga (but replace the 1st arg url with category ie. js errors)
			// use slice (instead of sPlice) because i want to clone array
			var argumentsArray = [].slice.call(arguments, 0);
			// transpose these arguments to sendGA
			var sendGAargs = [JS_ERRORS_CATEGORY].concat(argumentsArray);
			sendGA.apply(this, sendGAargs);
		}
	}
	//return false; // false prevents default error handling.
}

function logError(action) {
	// transpose these arguments to console.error
	// use slice (instead of sPlice) because i want to clone array
	var argumentsArray = [].slice.call(arguments, 0);
	// exception: usually 'this' is passed but instead its 'console' because console and log are host objects. Their behavior is implementation dependent, and to a large degree are not required to implement the semantics of ECMAScript.
	console.error.apply(console, argumentsArray);
	
	sendGAError.apply(this, arguments);
}

function getInternalPageProtocol() {
	var protocol;
	if (DetectClient.isFirefox()) {
		protocol = "moz-extension:";
	} else {
		protocol = "chrome-extension:";
	}
	return protocol;
}

function isInternalPage(url) {
	if (arguments.length == 0) {
		url = location.href;
	}
	return url && url.indexOf(getInternalPageProtocol()) == 0;
}

var ONE_SECOND = 1000;
var ONE_MINUTE = 60000;
var ONE_HOUR = ONE_MINUTE * 60;
var ONE_DAY = ONE_HOUR * 24;

var WEEK_IN_MINUTES = 10080;
var DAY_IN_MINUTES = 1440;
var HOUR_IN_MINUTES = 60;

var origConsoleLog = null;
var origConsoleWarn = null;
var origConsoleDebug = null;
Calendar = function () {};

// copy all the fields (not a clone, we are modifying the target so we don't lose a any previous pointer to it
function copyObj(sourceObj, targetObj) {
    for (var key in sourceObj) {        
    	targetObj[key] = sourceObj[key];
    }
}

if (typeof(jQuery) != "undefined") {
	jQuery.fn.exists = function(){return jQuery(this).length>0;}
	jQuery.fn.textNodes = function() {
		var ret = [];
	
		(function(el){
			if (!el) return;
			if ((el.nodeType == 3)||(el.nodeName =="BR"))
				ret.push(el);
			else
				for (var i=0; i < el.childNodes.length; ++i)
					arguments.callee(el.childNodes[i]);
		})(this[0]);
		return $(ret);
	}
	jQuery.fn.hasHorizontalScrollbar = function() {
	    var divnode = this[0];
	    if (divnode && divnode.scrollWidth > divnode.clientWidth) {
	        return true;
	    } else {
	    	return false;
	    }
	}
	
	jQuery.fn.hasVerticalScrollbar = function(buffer) {
	if (!buffer) {
		buffer = 0;
	}
	
	    var divnode = this[0];
    if (divnode.scrollHeight > divnode.clientHeight + buffer) {
	        return true;
	    } else {
	    	return false;
	    }
	}
}

function seconds(seconds) {
	return seconds * ONE_SECOND;
}

function minutes(minutes) {
	return minutes * ONE_MINUTE;
}

function hours(hours) {
	return hours * ONE_HOUR;
}

function days(days) {
	return days * ONE_DAY;
}

//remove entity codes
function htmlToText(html) {
	/*
   var tmp = document.createElement("DIV");
   tmp.innerHTML = html;
   return tmp.textContent||tmp.innerText;
   */
	// Firefox DOM insertion proof
	return $("<textarea/>").html(html).text().replace(/<br\s?\/?>/ig,"\n").replace(/<(?:.|\n)*?>/gm, '');
}

function loadLocaleMessages(lang) {
	return new Promise((resolve, reject) => {
		lang = lang.toLowerCase();
		
		// only load locales from files if they are not using their browser language (because i18n.getMessage uses the browser language) 
		if (lang == chrome.i18n.getUILanguage()) { // .substring(0,2)
			// for english just use native calls to get i18n messages
			bg.localeMessages = null;
			resolve();
		} else {
			console.log("loading locale: " + lang);
			
			// i haven't created a en-US so let's avoid the error in the console and just push the callback
			if (lang == "en-us") {
				resolve();
			} else {
				
				// convert lang to match folder case ie. en_gb
				var folderName = lang.replace("-", "_");
				if (folderName.indexOf("_") != -1) {
					folderName = folderName.substr(0, 2) + "_" + folderName.substr(3).toUpperCase();
				} else {
					folderName = folderName.toLowerCase();
				}
				
				$.ajax({
					url: chrome.runtime.getURL("_locales/" + folderName + "/messages.json"),
					type: "GET",
					timeout: 5000,
					complete: function(request, textStatus) {
						var status = getStatus(request, textStatus);
						if (status == 200) {
							bg.localeMessages = JSON.parse(request.responseText);
						} else {
							// not found status usually 404
						}
						resolve();
					}
				});		
			}
		}		
	});
}

function getMessage(messageID, args, localeMessages) {
	if (messageID) {
		// if localeMessage null because english is being used and we haven't loaded the localeMessage
		if (!localeMessages) {
			try {
				localeMessages = bg.localeMessages;
			} catch (e) {
				// might be in content_script and localMessages not defined because it's in english
				return chromeGetMessage(messageID, args);
			}				
		}
		if (localeMessages) {
			var messageObj = localeMessages[messageID];	
			if (messageObj) { // found in this language
				var str = messageObj.message;
				
				// patch: replace escaped $$ to just $ (because chrome.i18n.getMessage did it automatically)
				if (str) {
					str = str.replace(/\$\$/g, "$");
				}
				
				if (args) {
					if (args instanceof Array) {
						for (var a=0; a<args.length; a++) {
							str = str.replace("$" + (a+1), args[a]);
						}
					} else {
						str = str.replace("$1", args);
					}
				}
				return str;
			} else { // default to default language
				return chromeGetMessage(messageID, args);
			}
		} else {
			return chromeGetMessage(messageID, args);
		}
	}
}

//patch: chrome.i18n.getMessage does pass parameter if it is a numeric - must be converted to str
function chromeGetMessage(messageID, args) {
	if (args && $.isNumeric(args)) {
		args = args + "";
	}
	return chrome.i18n.getMessage(messageID, args);
}

function getUniqueId() {
	return Math.floor(Math.random() * 100000);
}

var dateFormat = function () {
	var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
		timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
		timezoneClip = /[^-+\dA-Z]/g,
		pad = function (val, len) {
			val = String(val);
			len = len || 2;
			while (val.length < len) val = "0" + val;
			return val;
		};

	// Regexes and supporting functions are cached through closure
	return function (date, mask, options) { //utc, forceEnglish
		if (!options) {
			options = {};
		}
		
		var dF = dateFormat;
		var i18n = options.forceEnglish ? dF.i18nEnglish : dF.i18n;

		// You can't provide utc if you skip other args (use the "UTC:" mask prefix)
		if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
			mask = date;
			date = undefined;
		}

		// Passing date through Date applies Date.parse, if necessary
		date = date ? new Date(date) : new Date;
		if (isNaN(date)) throw SyntaxError("invalid date");

		mask = String(dF.masks[mask] || mask || dF.masks["default"]);

		// Allow setting the utc argument via the mask
		if (mask.slice(0, 4) == "UTC:") {
			mask = mask.slice(4);
			options.utc = true;
		}

		var	_ = options.utc ? "getUTC" : "get",
			d = date[_ + "Date"](),
			D = date[_ + "Day"](),
			m = date[_ + "Month"](),
			y = date[_ + "FullYear"](),
			H = date[_ + "Hours"](),
			M = date[_ + "Minutes"](),
			s = date[_ + "Seconds"](),
			L = date[_ + "Milliseconds"](),
			o = options.utc ? 0 : date.getTimezoneOffset(),
			flags = {
				d:    d,
				dd:   pad(d),
				ddd:  i18n.dayNamesShort[D],
				dddd: i18n.dayNames[D],
				m:    m + 1,
				mm:   pad(m + 1),
				mmm:  i18n.monthNamesShort[m],
				mmmm: i18n.monthNames[m],
				yy:   String(y).slice(2),
				yyyy: y,
				h:    H % 12 || 12,
				hh:   pad(H % 12 || 12),
				H:    H,
				HH:   pad(H),
				M:    M,
				MM:   pad(M),
				s:    s,
				ss:   pad(s),
				l:    pad(L, 3),
				L:    pad(L > 99 ? Math.round(L / 10) : L),
				t:    H < 12 ? "a"  : "p",
				tt:   H < 12 ? "am" : "pm",
				T:    H < 12 ? "A"  : "P",
				TT:   H < 12 ? "AM" : "PM",
				Z:    options.utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
				o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
				S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
			};

		var ret = mask.replace(token, function ($0) {
			return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
		});

		if (options.noZeros) {
			ret = ret.replace(":00", "");
		}
		
		return ret;
	};
}();

// Some common format strings
dateFormat.masks = {
	"default":      "ddd mmm dd yyyy HH:MM:ss",
	shortDate:      "m/d/yy",
	mediumDate:     "mmm d, yyyy",
	longDate:       "mmmm d, yyyy",
	fullDate:       "dddd, mmmm d, yyyy",
	shortTime:      "h:MM TT",
	mediumTime:     "h:MM:ss TT",
	longTime:       "h:MM:ss TT Z",
	isoDate:        "yyyy-mm-dd",
	isoTime:        "HH:MM:ss",
	isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
	isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
};

// Internationalization strings
dateFormat.i18n = {
	dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
	monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
};

dateFormat.i18nEnglish = $.extend(true, {}, dateFormat.i18n);
dateFormat.i18nCalendarLanguage = $.extend(true, {}, dateFormat.i18n);

Date.prototype.addSeconds = function(seconds, cloneDate) {
	var date;
	if (cloneDate) {
		date = new Date(this);		
	} else {
		date = this;
	}
	date.setSeconds(date.getSeconds() + seconds, date.getMilliseconds());
	return date;
}

Date.prototype.subtractSeconds = function(seconds, cloneDate) {
	return this.addSeconds(-seconds, cloneDate);
}

Date.prototype.addMinutes = function(mins) {
	return new Date(this.getTime() + minutes(mins));
}

Date.prototype.addHours = function(hrs) {
	return new Date(this.getTime() + hours(hrs));
}

Date.prototype.addDays = function(days) {
	var newDate = new Date(this);
	newDate.setDate(newDate.getDate()+days);
	return newDate;
}

Date.prototype.subtractDays = function(days) {
	return this.addDays(days*-1);
}

// For convenience...
Date.prototype.format = function (mask, options) {
	return dateFormat(this, mask, options);
};

Date.prototype.formatTime = function(removeTrailingZeroes) {
	if (bg.storage && bg.storage.get("24hourMode")) {
		return pad(this.getHours(), 2, '0') + ":" + pad(this.getMinutes(), 2, '0');
	} else {
		var time = "";
		if (this.getHours() >= 12) {
			if (this.getHours() == 12) {
				time = 12;
			} else {
				time = this.getHours() - 12;
			}
			time = time + ":" + pad(this.getMinutes(), 2, '0') + "pm";
		} else if (this.getHours() == 0) {
			time = "12:" + pad(this.getMinutes(), 2, '0') + "am";
		} else {
			time = this.getHours() + ":" + pad(this.getMinutes(), 2, '0') + "am";
		}
		if (removeTrailingZeroes) {
			time = time.replace(":00", "");
		}
		return time;
	}
}

Date.prototype.resetTime = function () {
	this.setHours(0);
	this.setMinutes(0);
	this.setSeconds(0, 0); 
}

Date.prototype.toRFC3339 = function() {
	//var gmtHours = -d.getTimezoneOffset()/60;
	return this.getUTCFullYear() + "-" + pad(this.getUTCMonth()+1, 2, '0') + "-" + pad(this.getUTCDate(), 2, '0') + "T" + pad(this.getUTCHours(), 2, '0') + ":" + pad(this.getUTCMinutes(), 2, '0') + ":00Z";
}

function now() {
	return new Date();
}

function today() {
	var date = new Date();
	date.resetTime();
	return date;
}

function yesterday() {
	var yest = new Date();
	yest.setDate(yest.getDate()-1);
	yest.resetTime();
	return yest;
}

function tomorrow() {
	var tom = new Date();
	tom.setDate(tom.getDate()+1);
	tom.resetTime();
	return tom;
}

function isToday(date) {
	var todayDate = today();
	return date.getFullYear() == todayDate.getFullYear() && date.getMonth() == todayDate.getMonth() && date.getDate() == todayDate.getDate();
}

function isTomorrow(date) {
	var tom = tomorrow();
	return date.getFullYear() == tom.getFullYear() && date.getMonth() == tom.getMonth() && date.getDate() == tom.getDate();
}

function isYesterday(date) {
	var yest = yesterday();
	return date.getFullYear() == yest.getFullYear() && date.getMonth() == yest.getMonth() && date.getDate() == yest.getDate();
}

Date.prototype.isToday = function () {
	return isToday(this);
};

Date.prototype.isTomorrow = function () {
	return isTomorrow(this);
};

Date.prototype.isYesterday = function () {
	return isYesterday(this);
};

Date.prototype.isSameDay = function (otherDay) {
	return this.getFullYear() == otherDay.getFullYear() && this.getMonth() == otherDay.getMonth() && this.getDate() == otherDay.getDate();
};

Date.prototype.isBefore = function(otherDate) {
	var paramDate;
	if (otherDate) {
		paramDate = new Date(otherDate);
	} else {
		paramDate = new Date();
	}	
	var thisDate = new Date(this);
	return thisDate.getTime() < paramDate.getTime();
};

Date.prototype.isEqual = function(otherDate) {
	return this.getTime() == otherDate.getTime();
};

Date.prototype.isEqualOrBefore = function(otherDate) {
	return this.isBefore(otherDate) || (otherDate && this.getTime() == otherDate.getTime());
};

Date.prototype.isAfter = function(otherDate) {
	return !this.isEqualOrBefore(otherDate);
};

Date.prototype.isEqualOrAfter = function(otherDate) {
	return !this.isBefore(otherDate);
};

Date.prototype.diffInSeconds = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}	
	var d2 = new Date(this);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_SECOND);
};

Date.prototype.diffInMinutes = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}	
	var d2 = new Date(this);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_MINUTE);
};

Date.prototype.diffInHours = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}	
	var d2 = new Date(this);
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_HOUR);
};

Date.prototype.diffInDays = function(otherDate) {
	var d1;
	if (otherDate) {
		d1 = new Date(otherDate);
	} else {
		d1 = new Date();
	}
	d1.resetTime();
	var d2 = new Date(this);
	d2.resetTime();
	return Math.round(Math.ceil(d2.getTime() - d1.getTime()) / ONE_DAY);
};

// Note: this is shallow clone if the array contains objects they will remain referenced ie. [{key:value}, ...]
// refer to jquery deep clone method
Array.prototype.shallowClone = function() {
	return this.slice(0);
};

Array.prototype.clone = function() {
	return $.extend(true, [], this);
};

Array.prototype.first = function() {
	return this[0];
};
Array.prototype.last = function() {
	return this[this.length-1];
};
Array.prototype.isEmpty = function() {
	return this.length == 0;
};
Array.prototype.find = function(func) {
	for (var i = 0, l = this.length; i < l; ++i) {
		var item = this[i];
		if (func(item))
			return item;
	}
	return null;
};
Array.prototype.swap = function (x,y) {
	var b = this[x];
	this[x] = this[y];
	this[y] = b;
	return this;
}

Array.prototype.addItem = function(key, value) {
	for (var i=0, l=this.length; i<l; ++i) {
		if (this[i].key == key) {
			// found key so update value
			this[i].value = value;
			return;
		}
	}
	this.push({key:key, value:value});
}
Array.prototype.getItem = function(key) {
	for (var i=0, l=this.length; i<l; ++i) {
		if (this[i].key == key) {			
			return this[i].value;
		}
	}
}

String.prototype.replaceAll = function(find, replace) {
	var findEscaped = escapeRegExp(find);
	return this.replace(new RegExp(findEscaped, 'g'), replace);
}

String.prototype.chunk = function(size) {
	return this.match(new RegExp('.{1,' + size + '}', 'g'));
}

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

String.prototype.equalsIgnoreCase = function(str) {
	if (this && str) {
		return this.toLowerCase() == str.toLowerCase();
	}
}

String.prototype.hasWord = function(word) {
	return new RegExp("\\b" + word + "\\b", "i").test(this);
}

String.prototype.startsWith = function (str) {
	return this.indexOf(str) == 0;
};

String.prototype.endsWith = function (str){
	return this.slice(-str.length) == str;
};

String.prototype.summarize = function(maxLength, EOM_Message) {
	if (!maxLength) {
		maxLength = 101;
	}
	var summary = this;
	if (summary.length > maxLength) {
		summary = summary.substring(0, maxLength);
		var lastSpaceIndex = summary.lastIndexOf(" ");
		if (lastSpaceIndex != -1) {
			summary = summary.substring(0, lastSpaceIndex);
			summary = $.trim(summary);
		}
		summary += "...";
	} else {
		if (EOM_Message) {
			summary += EOM_Message;
		}
	}
	
	// patch: do not why: but it seem that unless i append a str to summary, it returns an array of the letters in summary?
	return summary + "";
}

// match only url and path (NOT query parameters)
String.prototype.urlOrPathContains = function(str) {
	var strIndex = this.indexOf(str);
	if (strIndex != -1) {		
		var queryParamsStart = this.indexOf("?");
		// if query make sure that we don't match the str inside query params
		if (queryParamsStart != -1) {
			if (strIndex < queryParamsStart) {
				return true;
			} else {
				return false;
			}
		} else {
			return true;
		}
	} else {
		return false;
	}
}

String.prototype.parseTime = function(defaultDate) {
	var d;
	if (defaultDate) {
		d = new Date(defaultDate);
	} else {
		d = new Date();
	}
	
	var pieces;
	if (this.indexOf(":") != -1) { // "17 September 2015 at 20:56"
		pieces = this.match(/(\d+)([:|\.](\d\d))\s*(a|p)?/i);
	} else { // "2pm"
		pieces = this.match(/(\d+)([:|\.](\d\d))?\s*(a|p)?/i);
	}
	if (pieces && pieces.length >= 5) {
		// patch: had to use parseFloat instead of parseInt (because parseInt would return 0 instead of 9 when parsing "09" ???		
		var hours = parseFloat(pieces[1]);
		var ampm = pieces[4];
		
		// patch for midnight because 12:12am is actually 0 hours not 12 hours for the date object
		if (hours == 12) {
			if (ampm && ampm.toLowerCase().startsWith("a")) {
				hours = 0;
			} else {
				hours = 12;
			}
		} else if (ampm && ampm.toLowerCase().startsWith("p")) {
			hours += 12;
		}
		d.setHours(hours);		
		d.setMinutes( parseFloat(pieces[3]) || 0 );
		d.setSeconds(0, 0);
		return d;
	}
}

String.prototype.parseDate = function() {
	/*
	// bug patch: it seems that new Date("2011-09-21") return 20th??? but if you use slashes instead ie. 2011/09/21 then it works :)
	if (this.length <= 10) {
		return new Date(Date.parse(this.replace("-", "/")));
	} else {
		return new Date(Date.parse(this));
	}
	*/
	var DATE_TIME_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(\.\d+)?(\+|-)(\d\d):(\d\d)$/;
	var DATE_TIME_REGEX_Z = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)\.\d+Z$/;
	var DATE_TIME_REGEX_Z2 = /^(\d\d\d\d)-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)+Z$/;
	var DATE_MILLI_REGEX = /^(\d\d\d\d)(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)$/;
	var DATE_REGEX = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;
	var DATE_NOSPACES_REGEX = /^(\d\d\d\d)(\d\d)(\d\d)$/;

	/* Convert the incoming date into a javascript date
	 * 2012-09-26T11:42:00-04:00
	 * 2006-04-28T09:00:00.000-07:00
	 * 2006-04-28T09:00:00.000Z
	 * 2010-05-25T23:00:00Z (new one from jason)
	 * 2006-04-19
	 */

	  var parts = DATE_TIME_REGEX.exec(this);
	  
	  // Try out the Z version
	  if (!parts) {
	    parts = DATE_TIME_REGEX_Z.exec(this);
	  }
	  if (!parts) {
		parts = DATE_TIME_REGEX_Z2.exec(this);
	  }
	  
	  if (exists(parts) && parts.length > 0) {
	    var d = new Date();
	    d.setUTCFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
	    d.setUTCHours(parts[4]);
	    d.setUTCMinutes(parts[5]);
	    d.setUTCSeconds(parts[6]);
		d.setUTCMilliseconds(0);

	    var tzOffsetFeedMin = 0;
	    if (parts.length > 8) {
	      tzOffsetFeedMin = parseInt(parts[9],10) * 60 + parseInt(parts[10],10);
	      if (parts[8] != '-') { // This is supposed to be backwards.
	        tzOffsetFeedMin = -tzOffsetFeedMin;
	      }
	    }
	    return new Date(d.getTime() + tzOffsetFeedMin * ONE_MINUTE);
	  }
	  
	  parts = DATE_MILLI_REGEX.exec(this);
	  if (exists(parts)) {
			var d = new Date();
			d.setFullYear(parts[1], parseInt(parts[2], 10) - 1, parts[3]);
		    d.setHours(parts[4]);
		    d.setMinutes(parts[5]);
		    d.setSeconds(parts[6]);
			d.setMilliseconds(0);
			return d;
	  }
	  if (!parts) {
		  parts = DATE_REGEX.exec(this);
	  }
	  if (!parts) {
		  parts = DATE_NOSPACES_REGEX.exec(this);
	  }
	  if (exists(parts) && parts.length > 0) {
	    return new Date(parts[1], parseInt(parts[2],10) - 1, parts[3]);
	  }
	  if (!isNaN(this)) {
		  return new Date(this);
	  }
	  return null;
}

function initAnalytics() {
	console.log("initAnalytics");
	// load this immediately if in background
	var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
	ga.src = '/js/analytics.js';
	var s = document.getElementsByTagName('script')[0];
	if (s) {
		s.parentNode.insertBefore(ga, s);
	}
	
	$(document).ready(function() {
		$(document).on("click", "a, input, button", function() {
			var id = $(this).attr("ga");
			var label = null;
			if (id != "IGNORE") {
				if (!id) {
					id = $(this).attr("id");
				}
				if (!id) {
					id = $(this).attr("snoozeInMinutes");
					if (id) {
						label = "in minutes: " + id; 
						id = "snooze";
					}
					if (!id) {
						id = $(this).attr("snoozeInDays");
						if (id) {
							label = "in days: " + id; 
							id = "snooze";
						}
					}
					if (!id) {
						id = $(this).attr("msg");
					}
					if (!id) {
						id = $(this).attr("msgTitle");
					}
					if (!id) {
						id = $(this).attr("href");
						// don't log # so dismiss it
						if (id == "#") {
							id = null;
						}
					}
					if (id) {
						id = id.replace(/javascript\:/, "");
						// only semicolon so remove it and keep finding other ids
						if (id == ";") {
							id = "";
						}
					}
					if (!id) {
						id = $(this).parent().attr("id");
					}
					if (!id) {
						id = $(this).attr("class");
					}
				}
				if ($(this).attr("type") != "text") {
					if ($(this).attr("type") == "checkbox") {
						if (this.checked) {
							label = id + "_on";
						} else {
							label = id + "_off";
						}
					}
					var category = $(this).closest("*[gaCategory]");
					var action = null;
					// if gaCategory specified
					if (category.length != 0) {
						category = category.attr("gaCategory");
						action = id;
					} else {
						category = id;
						action = "click";
					}
					
					if (label != null) {
						sendGA(category, action, label);
					} else {
						sendGA(category, action);
					}
				}
			}
		});
	});
}

// usage: sendGA('category', 'action', 'label');
// usage: sendGA('category', 'action', 'label', value);  // value is a number.
// usage: sendGA('category', 'action', {'nonInteraction': 1});
function sendGA(category, action, label, etc) {
	console.log("%csendGA: " + category + " " + action + " " + label, "font-size:0.6em");

	// patch: seems arguments isn't really an array so let's create one from it
	var argumentsArray = [].slice.call(arguments, 0);

	var gaArgs = ['send', 'event'];
	// append other arguments
	gaArgs = gaArgs.concat(argumentsArray);
	
	// send to google
	if (window && window.ga) {
		ga.apply(this, gaArgs);
	}
}

function isAsianLangauge() {
	var lang = storage.get("lang");
	return /ja|zh|ko/.test(lang);
}

function initMessagesInTemplates(templates) {
	return new Promise((resolve, reject) => {
		if (templates) {
			for (let a=0; a<templates.length; a++) {
				let node = templates[a].content.firstElementChild;
				if (node) {
					initMessages($(node).find("*"));
					let innerTemplates = templates[a].content.querySelectorAll("template");
					initMessagesInTemplates(innerTemplates);
				}
			}
		} else {
			templates = document.querySelectorAll("template");
			if (templates.length) {
				initMessagesInTemplates(templates);
			} else {
				resolve();
			}
		}
	});
}

// Console...
origConsoleLog = console.log;
origConsoleWarn = console.warn;
origConsoleDebug = console.debug;
initConsole();

if (typeof($) != "undefined") {
	
	// For some reason including scripts for popup window slows down popup window reaction time, so only found that settimeout would work
	if (location.href.indexOf("background.") != -1) {
		initAnalytics();
	} else {
		var delay = location.href.indexOf("options.") != -1 ? 4000 : 2000;
		setTimeout(function() {
			initAnalytics();
		}, delay);
	}
	
	$(document).ready(function() {
		initCalendarNames(dateFormat.i18n);
		initMessages();
		console.time("initMessagesInTemplates");
		initMessagesInTemplates();
		console.timeEnd("initMessagesInTemplates");
	});
}

function log(str, prefName) {
	if (storage.get(prefName)) {
		console.log(str);
	}
}

function openContributeDialog(key) {
	openGenericDialog({
		title: getMessage("extraFeatures"),
		content: getMessage("extraFeaturesPopup1") + "<br>" + getMessage("extraFeaturesPopup2"),
		otherLabel: getMessage("contribute")
	}).then(function(response) {
		if (response == "other") {
			openUrl("donate.html?action=" + key);
		}
	});
}

function setStorage(element, params) {
	if (($(element).closest("[mustDonate]").length || params.mustDonate) && !storage.get("donationClicked")) {
		params.event.preventDefault();
		openContributeDialog(params.key);
		return Promise.reject(JError.DID_NOT_CONTRIBUTE);
	} else {
		return storage.set(params.key, params.value);
	}
}

function initPaperElement($nodes, params) {
	params = initUndefinedObject(params);
	
	$nodes.each(function(index, element) {
		var $element = $(element);
		
		var key = $element.attr("storage");
		var permissions;
		if (DetectClient.isChrome()) {
			permissions = $element.attr("permissions");
		}
		
		if (key && key != "lang") { // ignore lang because we use a specific logic inside the options.js
			if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
				$element.attr("checked", toBool(storage.get(key)));
			} else if (element.nodeName.equalsIgnoreCase("paper-menu")) {
				element.setAttribute("selected", storage.get(key));
			} else if (element.nodeName.equalsIgnoreCase("paper-radio-group")) {
				element.setAttribute("selected", storage.get(key));
			} else if (element.nodeName.equalsIgnoreCase("paper-slider")) {
				element.setAttribute("value", storage.get(key));
			}
		} else if (permissions) {
			chrome.permissions.contains({permissions: [permissions]}, function(result) {
				$element.attr("checked", result);
			});
		}

		// need a 1ms pause or else setting the default above would trigger the change below?? - so make sure it is forgotten
		setTimeout(function() {
			
			var eventName;
			if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
				eventName = "change";
			} else if (element.nodeName.equalsIgnoreCase("paper-menu")) {
				eventName = "iron-activate";
			} else if (element.nodeName.equalsIgnoreCase("paper-radio-group")) {
				eventName = "paper-radio-group-changed";
			} else if (element.nodeName.equalsIgnoreCase("paper-slider")) {
				eventName = "change";
			}
			
			$element.on(eventName, function(event) {
				if (key || params.key) {
					
					var value;
					if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
						value = element.checked;
					} else if (element.nodeName.equalsIgnoreCase("paper-menu")) {
						value = event.originalEvent.detail.selected;
					} else if (element.nodeName.equalsIgnoreCase("paper-radio-group")) {
						value = element.selected;
					} else if (element.nodeName.equalsIgnoreCase("paper-slider")) {
						value = $element.attr("value");
					}

					var storagePromise;
					
					if (key) {
						storagePromise = setStorage($element, {event:event, key:key, value:value});
					} else if (params.key) {
						params.event = event;
						params.value = value;
						storagePromise = setStorage($element, params);
					}
					
					storagePromise.catch(error => {
						console.error("could not save setting: " + error);
						if (element.nodeName.equalsIgnoreCase("paper-checkbox")) {
							element.checked = !element.checked;
						} else if (element.nodeName.equalsIgnoreCase("paper-menu")) {
							$element.closest("paper-dropdown-menu")[0].close();
						}
						
						if (error != JError.DID_NOT_CONTRIBUTE) {
							showError(error);
						}
					});
				} else if (permissions) {
					if (element.checked) {
						chrome.permissions.request({permissions: [permissions]}, function(granted) {
							if (granted) {
								$element.attr("checked", granted);
							} else {
								$element.attr("checked", false);
								niceAlert("Might not be supported by this OS");
							}
						});
					} else {			
						chrome.permissions.remove({permissions: [permissions]}, function(removed) {
							if (removed) {
								$element.attr("checked", false);
							} else {
								// The permissions have not been removed (e.g., you tried to remove required permissions).
								$element.attr("checked", true);
								niceAlert("These permissions could not be removed, they might be required!");
							}
						});
					}
				}
			});
		}, 500);
	});
}

function initOptions() {
	initPaperElement($("[storage], [permissions]"));
}

function initConsole() {
	if (localStorage["console_messages"]) {
		console.log = origConsoleLog;
		console.warn = origConsoleWarn;
		console.debug = origConsoleDebug;
	} else {
		if (window.bg) {
			try {
				bg.console.log = bg.console.debug = console.log = function(msg){};
			} catch (e) {
				console.error("Error in initConsole", e);
			}
		}
	}
}

function initCalendarNames(obj) {
	/*
	var s = document.createElement('script');
	s.setAttribute('type', 'text/javascript');
	s.setAttribute('src', "js/calendar/calendar-" + lang + ".js");
	(document.getElementsByTagName('head')[0] || document.documentElement).appendChild(s);
	*/
	
	obj.dayNames = getMessage("daysArray").split(",");
	obj.dayNamesShort = getMessage("daysArrayShort").split(",");
	obj.monthNames = getMessage("monthsArray").split(",");
	obj.monthNamesShort = getMessage("monthsArrayShort").split(",");
	
}

function initMessages(selectorOrNode) {
	// options page only for now..
	if (location.href.indexOf("options.html") != -1 || location.href.indexOf("reminders.html") != -1 || location.href.indexOf("donate.html") != -1) {
		$("html").attr("dir", getMessage("dir"));
	}

	var $selector;
	if (selectorOrNode) {
		$selector = $(selectorOrNode);
	} else {
		$selector = $("*");
	}
	
	$selector.each(function() {
		//var parentMsg = $(this);
		var attr = $(this).attr("msg");
		if (attr) {
			var msgArg1 = $(this).attr("msgArg1");
			if (msgArg1) {
				$(this).text(getMessage( $(this).attr("msg"), msgArg1 ));
			} else {
				// look for inner msg nodes to replace before...
				var innerMsg = $(this).find("*[msg]");
				if (innerMsg.exists()) {
					initMessages(innerMsg);
					var msgArgs = new Array();
					innerMsg.each(function(index, element) {
						msgArgs.push( $(this)[0].outerHTML );
					});
					$(this).html(getMessage(attr, msgArgs));
				} else {
					$(this).text(getMessage(attr));
				}
			}
		}
		attr = $(this).attr("msgTitle");
		if (attr) {
			var msgArg1 = $(this).attr("msgTitleArg1");
			if (msgArg1) {
				$(this).attr("title", getMessage( $(this).attr("msgTitle"), msgArg1 ));
			} else {
				$(this).attr("title", getMessage(attr));
			}
		}
		attr = $(this).attr("msgLabel");
		if (attr) {
			var msgArg1 = $(this).attr("msgLabelArg1");
			if (msgArg1) {
				$(this).attr("label", getMessage( $(this).attr("msgLabel"), msgArg1 ));
			} else {
				$(this).attr("label", getMessage(attr));
			}
		}
		attr = $(this).attr("msgText");
		if (attr) {
			var msgArg1 = $(this).attr("msgTextArg1");
			if (msgArg1) {
				$(this).attr("text", getMessage( $(this).attr("msgText"), msgArg1 ));
			} else {
				$(this).attr("text", getMessage(attr));
			}
		}
		attr = $(this).attr("msgSrc");
		if (attr) {
			$(this).attr("src", getMessage(attr));
		}
		attr = $(this).attr("msgValue");
		if (attr) {
			$(this).attr("value", getMessage(attr));
		}
		attr = $(this).attr("msgPlaceholder");
		if (attr) {
			$(this).attr("placeholder", getMessage(attr));
		}
		
		attr = $(this).attr("msgHTML");
		if (attr) {
			var msgArg1 = $(this).attr("msgArg1");
			if (msgArg1) {
				var args = [msgArg1];
				
				var msgArg2 = $(this).attr("msgArg2");
				if (msgArg2) {
					args.push(msgArg2);
				}
				
				$(this).html(getMessage( $(this).attr("msgHTML"), args ));
			} else {
				// look for inner msg nodes to replace before...
				var innerMsg = $(this).find("*[msg]");
				if (innerMsg.exists()) {
					initMessages(innerMsg);
					var msgArgs = new Array();
					innerMsg.each(function(index, element) {
						msgArgs.push( $(this)[0].outerHTML );
					});
					$(this).html(getMessage(attr, msgArgs));
				} else {
					$(this).html(getMessage(attr));
				}
			}
		}

		attr = $(this).attr("msgPosition");
		if (attr) {
			if ($("html").attr("dir") == "rtl") {
				if (attr == "right") {
					$(this).attr("position", "left");
				} else {
					$(this).attr("position", "right");
				}
			} else {
				$(this).attr("position", attr);
			}
		}
	});
	
	function addWarning(attrName, warningMessage) {
		var $chromeOnlyNodes = $("[" + attrName + "]");
		
		$chromeOnlyNodes.find("paper-tooltip").remove("paper-tooltip")
		
		if ($chromeOnlyNodes.length) {
		$chromeOnlyNodes
			.attr("disabled", "")
			.css({opacity:0.5})
			.append( "<paper-tooltip>" + warningMessage + "</paper-tooltip>" )
			.click(function(e) {
				openGenericDialog({content:warningMessage});
				e.preventDefault();
				return false;
			})
		;
		}
		
	}
	
	// only do this this for one instance of a .html file
	if (!window.addedBrowserWarning) {
		if (!DetectClient.isChrome()) {
			addWarning("chrome-only", "Not supported by this browser!");
			if (DetectClient.isFirefox()) {
				addWarning("not-firefox", "Not supported by this browser!");
				$("[hide-from-firefox]").remove();
			}
		}
		window.addedBrowserWarning = true;
	}
}

function donationClicked(action) {
	if (storage.get("donationClicked")) {
		return true;
	} else {
		//var url = "donate.html?action=" + action;
		//chrome.runtime.sendMessage({name: "openTab", url:url});
		openContributeDialog(action);
		return false;
	}
}

function getChromeWindows() {
	return new Promise((resolve, reject) => {
		chrome.windows.getAll(windows => {
			// keep only normal windows and not app windows like debugger etc.
			var normalWindows = windows.filter(thisWindow => {
				return thisWindow.type == "normal";
			});
			resolve(normalWindows);
		});
	});
}

function findTab(url) {
	return new Promise((resolve, reject) => {
		chrome.tabs.query({url:url + "*"}, tabs => {
			if (chrome.runtime.lastError){
	            console.error(chrome.runtime.lastError.message);
	            resolve();
			} else {
				if (tabs.length) {
					var tab = tabs.last();
					bg.console.log("force window found")
					chrome.tabs.update(tab.id, {active:true}, () => {
						if (chrome.runtime.lastError) {
							resolve();
						} else {
							// must do this LAST when called from the popup window because if set focus to a window the popup loses focus and disappears and code execution stops
							chrome.windows.update(tab.windowId, {focused:true}, () => {
								resolve({found:true, tab:tab});
							});
						}
					});
				} else {
					resolve();
				}
			}
		});
	});
}

//usage: openUrl(url, {urlToFind:""})
function openUrl(url, params) {
	return new Promise((resolve, reject) => {
		params = initUndefinedObject(params);
		if (!window.inWidget && chrome.tabs) {
			if (location.href.indexOf("options.html") != -1) {
				location.href = url;
			} else {
				getChromeWindows().then(normalWindows => {
					if (normalWindows.length == 0) { // Chrome running in background
						var createWindowParams = {url:url};
						if (DetectClient.isChrome()) {
							createWindowParams.focused = true;
						}
						chrome.windows.create(createWindowParams, createdWindow => {
							findTab(url).then(response => {
								resolve(response);
							});
						});
					} else {
						new Promise((resolve, reject) => {
							if (params.urlToFind) {
								findTab(params.urlToFind).then(response => {
									resolve(response);
								});
							} else {
								resolve();
							}
						}).then(response => {
							if (response && response.found) {
								//chrome.tabs.update(response.tab.id, {url:url});
								return Promise.resolve(response);
							} else {
								return createTabAndFocusWindow(url);
							}
						}).then(response => {
							if (location.href.indexOf("source=toolbar") != -1 && DetectClient.isFirefox() && params.autoClose !== false) {
								window.close();
							}
						});
					}
				});
			}
		} else {
			top.location.href = url;
		}		
	});
}

function createTabAndFocusWindow(url) {
	return new Promise((resolve, reject) => {
		new Promise((resolve, reject) => {
			if (DetectClient.isFirefox()) { // required for Firefox because when inside a popup the tabs.create would open a tab/url inside the popup but we want it to open inside main browser window 
				chrome.windows.getCurrent(thisWindow => {
					if (thisWindow && thisWindow.type == "popup") {
						chrome.windows.getAll({windowTypes:["normal"]}, windows => {
							if (windows.length) {
								resolve(windows[0].id)
							} else {
								resolve();
							}
						});
					} else {
						resolve();
					}
				});
			} else {
				resolve();
			}		
		}).then(windowId => {
			var createParams = {url:url};
			if (windowId != undefined) {
				createParams.windowId = windowId;
			}
			chrome.tabs.create(createParams, tab => {
				chrome.windows.update(tab.windowId, {focused:true}, () => {
					resolve(tab);
				});						
			});
		});
	});
}

function removeNode(id) {
	var o = document.getElementById(id);
	if (o) {
		o.parentNode.removeChild(o);
	}
}

function addCSS(id, css) {
	removeNode(id);
	var s = document.createElement('style');
	s.setAttribute('id', id);
	s.setAttribute('type', 'text/css');
	s.appendChild(document.createTextNode(css));
	(document.getElementsByTagName('head')[0] || document.documentElement).appendChild(s);
}

function pad(str, times, character) { 
	var s = str.toString();
	var pd = '';
	var ch = character ? character : ' ';
	if (times > s.length) { 
		for (var i=0; i < (times-s.length); i++) { 
			pd += ch; 
		}
	}
	return pd + str.toString();
}

function toBool(str) {
	if ("false" === str || str == undefined) {
		return false;
	} else if ("true" === str) {
		return true;
	} else {
		return str;
	}
}

function getUrlValue(url, name, unescapeFlag) {
	if (url) {
	    var hash;
	    url = url.split("#")[0];
	    var hashes = url.slice(url.indexOf('?') + 1).split('&');
	    for(var i=0; i<hashes.length; i++) {
	        hash = hashes[i].split('=');
	        // make sure no nulls
	        if (hash[0] && name) {
				if (hash[0].toLowerCase() == name.toLowerCase()) {
					if (unescapeFlag) {
						return unescape(hash[1]);
					} else {
						return hash[1];
					}
				}
	        }
	    }
	    return null;
	}
}

function setUrlParam(url, param, value) {
	var params = url.split("&");
	for (var a=0; a<params.length; a++) {
		var idx = params[a].indexOf(param + "=");
		if (idx != -1) {
			var currentValue = params[a].substring(idx + param.length + 1);
			return url.replace(param + "=" + currentValue, param + "=" + value);
		}
	}
	
	// if there is a hash tag only parse the part before;
	var urlParts = url.split("#");
	var newUrl = urlParts[0];
	
	if (newUrl.indexOf("?") == -1) {
		newUrl += "?";
	} else {
		newUrl += "&";
	}
	
	newUrl += param + "=" + value;
	
	// we can not append the original hashtag (if there was one)
	if (urlParts.length >= 2) {
		newUrl += "#" + urlParts[1];
	}
	
	return newUrl;
}

function getCookie(c_name) {
	if (document.cookie.length>0) {
	  c_start=document.cookie.indexOf(c_name + "=");
	  if (c_start!=-1) {
	    c_start=c_start + c_name.length+1;
	    c_end=document.cookie.indexOf(";",c_start);
	    if (c_end==-1) c_end=document.cookie.length;
	    return unescape(document.cookie.substring(c_start,c_end));
	    }
	  }
	return "";
}

function exists(o) {
	if (o) {
		return true;
	} else {
		return false;	
	}	
}

function getExtensionIDFromURL(url) {
	//"chrome-extension://dlkpjianaefoochoggnjdmapfddblocd/options.html"
	return url.split("/")[2]; 
}

function getStatus(request, textStatus) {
	var status; // status/textStatus combos are: 201/success, 401/error, undefined/timeout
	try {
		status = request.status;
	} catch (e) {
		status = textStatus;
	}
	return status;
}

function setTodayOffsetInDays(days) {
	var offset = new Date();
	offset.setDate(offset.getDate()+parseInt(days));
	localStorage["today"] = offset;
}

function clearTodayOffset() {
	localStorage.removeItem("today");
}

function addToArray(str, ary) {
	for (var a=0; a<ary.length; a++) {
		if (ary[a] == str) {
			return false;
		}
	}
	ary.push(str);
	return true;
}

function removeFromArray(str, ary) {
	for (var a=0; a<ary.length; a++) {
		if (ary[a] == str) {
			ary.splice(a, 1);
			return true;
		}
	}
	return false;
}

function findTag(str, name) {
	if (str) {
		var index = str.indexOf("<" + name + " ");
		if (index == -1) {
			index = str.indexOf("<" + name + ">");
		}
		if (index == -1) {
			return null;
		}
		var closingTag = "</" + name + ">";
		var index2 = str.indexOf(closingTag);
		return str.substring(index, index2 + closingTag.length);
	}
}

function rotate(node, params) {
	// can't rotate <a> tags for some reason must be the image inside if so
	var rotationInterval;
	if (params && params.forever) {
		node.css({WebkitTransition: "all 10ms linear"});
		var degree = 0;
		rotationInterval = setInterval(function() {
	    	node.css({WebkitTransform: 'rotate(' + (degree+=2) + 'deg)'}); //scale(0.4) translateZ(0)
	    }, 2);
	} else {
		node.css({WebkitTransition: "all 1s ease-out"}); //all 1000ms linear
		node.css({WebkitTransform: "rotateZ(360deg)"}); //-webkit-transform: rotateZ(-360deg);
	}
	return rotationInterval;
}

function trimLineBreaks(str) {
	if (str) {
		str = str.replace(/^\n*/g, "");
		str = str.replace(/\n*$/g, "");
	}
	return str;
}

function cleanEmailSubject(subject) {
	if (subject) {
		subject = subject.replace(/^re: ?/i, "");
		subject = subject.replace(/^fwd: ?/i, "");
	}
	return subject;	
}

function getHost(url) {
	if (url) {
		var matches = url.match(/:\/\/([^\/?#]*)/);
		if (matches && matches.length >=2) {
			return matches[1];
		}
	}
}

function ellipsis(str, cutoffLength) {	
	if (str && str.length > cutoffLength) {
		str = str.substring(0, cutoffLength) + " ...";
	}
	return str;
}

function DetectSleepMode(wakeUpCallback) {
	var PING_INTERVAL = 60; // 1 minute
	var PING_INTERVAL_BUFFER = 15;
	
	var lastPingTime = new Date();
	var lastWakeupTime = new Date(1); // make the last wakeup time really old because extension starting up does not equal a wakeup 
	
	function lastPingIntervalToolLong() {
		return lastPingTime.diffInSeconds() < -(PING_INTERVAL+PING_INTERVAL_BUFFER);
	}
	
	function ping() {
		if (lastPingIntervalToolLong()) {
			console.log("DetectSleepMode.wakeup time: " + new Date());
			lastWakeupTime = new Date();
			if (wakeUpCallback) {
				wakeUpCallback();
			}
		}
		lastPingTime = new Date();
	}
	
	setIntervalSafe(function() {
		ping();
	}, seconds(PING_INTERVAL));
	
	this.isWakingFromSleepMode = function() {
		console.log("DetectSleepMode.last ping: " + lastPingTime);
		console.log("last wakeuptime: " + lastWakeupTime);
		console.log("current time: " + new Date())
		// if last wakeup time was recently set than we must have awoken recently
		if (lastPingIntervalToolLong() || lastWakeupTime.diffInSeconds() >= -(PING_INTERVAL+PING_INTERVAL_BUFFER)) {
			return true;
		} else {
			return false;
		}
	}
}

function Controller() {

	// apps.jasonsavard.com server
	Controller.FULLPATH_TO_PAYMENT_FOLDERS = "https://apps.jasonsavard.com/";
	
	// jasonsavard.com server
	//Controller.FULLPATH_TO_PAYMENT_FOLDERS = "https://jasonsavard.com/apps.jasonsavard.com/";

	// internal only for now
	function callAjaxController(params) {
		$.ajax({
			type: "GET",
			url: Controller.FULLPATH_TO_PAYMENT_FOLDERS + "controller.php",
			headers: {"misc":location.href},
			data: params.data,
			dataType: "jsonp",
			jsonp: "jsoncallback",
			timeout: seconds(5),
			success: params.success,
			error: params.error						
		});
	}

	Controller.ajax = function(params, callback) {
		callAjaxController({
			data: params.data,
			success: function(data, textStatus, jqXHR) {
				callback({data:data, textStatus:textStatus, jqXHR:jqXHR});
			},
			error: function(jqXHR, textStatus, errorThrown) {
				callback({error: "jasonerror thrown from controller: " + textStatus + " " + errorThrown, jqXHR:jqXHR, textStatus:textStatus, errorThrown:errorThrown});
			}
		});
	}

	Controller.verifyPayment = function(itemID, emails, callback) {
		callAjaxController({
			data: {action:"verifyPayment", name:itemID, email:emails},
			success: function(data, textStatus, jqXHR) {
				callback(data);
			},
			error: function() {
				callback({error: "jasonerror thrown from controller"});
			}						
		});
	}

	Controller.getSkins = function(ids, timeMin) {
		return new Promise(function(resolve, reject) {
			var data = {};
			data.action = "getSkins";
			data.extension = "calendar";
			data.ids = ids;
			if (timeMin) {
				data.timeMin = new Date().diffInSeconds(timeMin); // seconds elapsed since now
			}
			data.misc = location.href;
			
			callAjaxController({
				data: data, // had to pass misc as parameter because it didn't seem to be passed with header above
				success: function(data, textStatus, jqXHR) {
					resolve(data);
				},
				error: function() {
					reject({error: "jasonerror thrown from controller"});
				}
			});
		});
	}

	Controller.updateSkinInstalls = function(id, offset) {
		return new Promise(function(resolve, reject) {
			var data = {};
			data.action = "updateSkinInstalls";
			data.id = id;
			data.offset = offset;
			data.misc = location.href;
			
			callAjaxController({
				data: data, // had to pass misc as parameter because it didn't seem to be passed with header above
				success: function(data, textStatus, jqXHR) {
					resolve(data);
				},
				error: function() {
					reject({error: "jasonerror thrown from controller"});
				}
			});
		});
	}
	
	Controller.processFeatures = function() {
		storage.enable("donationClicked");
		chrome.runtime.sendMessage({command: "featuresProcessed"}, function(response) {});
	}

	Controller.email = function(params, callback) {
		
		if (!callback) {
			callback = function() {};
		}

		// append action to params
		params.action = "email";
		
		callAjaxController({
			data: params,
			success: function(data, textStatus, jqXHR) {
				callback(data);
			},
			error: function() {
				callback({error: "jasonerror thrown from controller"});
			}						
		});
	}
}

// return 1st active tab
function getActiveTab(callback) {
	if (chrome.tabs) {
		chrome.tabs.query({lastFocusedWindow: true, active: true}, function(tabs) {
			if (tabs && tabs.length >= 1) {
				callback(tabs[0]);
			} else {
				callback();
			}
		});
	} else {
		callback();
	}
}

function ChromeTTS() {
	
	var chromeTTSMessages = new Array();
	var speaking = false;
	
	ChromeTTS.queue = function(msg, options, callback) {
		// this might have fixed the endless loop
		if (msg != null && msg != "") {
			if (!options) {
				options = {};
			}
			
			if (!callback) {
				callback = function() {};
			}
			
			options.utterance = msg;
			chromeTTSMessages.push(options);
			play(callback);
		}
	};

	ChromeTTS.stop = function() {
		if (chrome.tts) {
			chrome.tts.stop();
		}
		chromeTTSMessages = new Array();
		speaking = false;
	};

	ChromeTTS.isSpeaking = function() {
		return speaking;
	}

	function play(callback) {
		if (!callback) {
			callback = function() {};
		}
		
		if (chromeTTSMessages.length) {
			chrome.tts.isSpeaking(function(speakingParam) {
				console.log(speaking + " _ " + speakingParam);
				if (!speaking && !speakingParam) {
					// decoded etity codes ie. &#39; is ' (apostrohpe)
					var ttsMessage = htmlToText(chromeTTSMessages[0].utterance);
					
					var voiceParams = storage.get("notificationVoice");
					
					var voiceName;
					var extensionID;
					// if specified use it instead of the default 
					if (chromeTTSMessages[0].voiceName) {
						voiceName = chromeTTSMessages[0].voiceName;
						extensionID = "";
					} else {
						voiceName = voiceParams.split("___")[0];
						extensionID = voiceParams.split("___")[1];
					}					

					var MULTINGUAL_EXTENSION_ID = "colheiahjiadjgeideiglpokapnhifph";
					var GOOGLE_NETWORK_SPEECH_EXTENSION_ID = "neajdppkdcdipfabeoofebfddakdcjhd";
					
					console.log("speak: " + ttsMessage);
					speaking = true;
					chrome.tts.stop();
					
					// delay between plays
					setTimeout(function() {
						
						// check the time between when we executed the speak command and the time between the actual "start" event happened (if it doesn't happen then let's break cause we could be stuck)
						var speakNotStartedTimer = setTimeout(function() {
							console.log("start event never happened: so stop voice");
							// stop will invoke the "interuppted" event below and it will process end/next speak events
							chrome.tts.stop();
						}, seconds(5));
					
						chrome.tts.speak(ttsMessage, {
							voiceName: voiceName,
							extensionId : extensionID,
							//enqueue : true,
							volume: storage.get("voiceSoundVolume") / 100,
							pitch: parseFloat(storage.get("pitch")),
							rate: parseFloat(storage.get("rate")),
							onEvent: function(event) {
								console.log('event: ' + event.type);			
								if (event.type == "start") {
									clearTimeout(speakNotStartedTimer);
								} else if (event.type == "interrupted" || event.type == 'error' || event.type == 'end') {
									clearTimeout(speakNotStartedTimer);									
									chromeTTSMessages.shift();
									speaking = false;
									play(callback);
								}
							}
						}, function() {
							if (chrome.runtime.lastError) {
						        logError('speech error: ' + chrome.runtime.lastError.message);
							}
						});
						
					}, 150);
				} else {
					console.log("already speaking, wait before retrying...");
					setTimeout(function() {
						play(callback);
					}, 1000);
				}
			});
		} else {
			callback();
		}
	}
}

function openWindowInCenter(url, title, specs, popupWidth, popupHeight) {
	var left = (screen.width/2)-(popupWidth/2);
	var top = (screen.height/2)-(popupHeight/2);
	return window.open(url, title, specs + ", width=" + popupWidth + ", height=" + popupHeight + ", top=" + top + ", left=" + left)
}

function OAuthForDevices(tokenResponses) {
	
	var GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";
	var GOOGLE_TOKEN_URL = "https://accounts.google.com/o/oauth2/token";
	var GOOGLE_CLIENT_ID = "74919836968.apps.googleusercontent.com";
	var GOOGLE_CLIENT_SECRET = "hkBvpOo0XJFzpY3Zt-2PE31V";
	var GOOGLE_REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
	var GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar";
	
	var BASE_URI = "https://www.googleapis.com/calendar/v3";

	var state = getUniqueId();
	
	// Need this because 'this' keyword will be out of scope within this.blah methods like callbacks etc.
	var that = this;
	
	this.tokenResponses = tokenResponses;
	if (!this.tokenResponses) {
		this.tokenResponses = [];
	}

	this.getStateParam = function() {
		return state;
	}

	// return array
	this.getUserEmails = function() {
		var userEmails = new Array();
		$.each(that.tokenResponses, function(index, tokenResponse) {
			userEmails.push(tokenResponse.userEmail);
		});
		return userEmails;
	}

	// return just the emailid
	this.getUserEmail = function(tokenResponse) {
		return new Promise((resolve, reject) => {
			// were using the contacts url because it's the only one we request permission to and it will give us the email id (so only fetch 1 result)
			// send token response since we don't have the userEmail
			sendOAuthRequest({tokenResponse:tokenResponse, url: "/calendars/primary"}).then(params => {
				var userEmail = params.data.id;
				params.userEmail = userEmail;
				resolve(params);
			}).catch(error => {
				error += " (Could not get userinfo - you might by re-trying to fetch the userEmail for the non default account)";
				reject(error);
			});
		});
	}

	function onTokenChangeWrapper(params) {
		// expires_in params is in seconds (i think)
		params.tokenResponse.expiryDate = new Date(Date.now() + (params.tokenResponse.expires_in * 1000));
		that.onTokenChange(params, that.tokenResponses);
	}	

	function onTokenErrorWrapper(tokenResponse, response) {
		// 400 is returned when refresing token and 401 when .send returns... // means user has problably revoked access: statusText = Unauthorized message = Invalid Credentials
		console.log("response", response);
		if ((response.oauthAction == "refreshToken" && response.jqXHR.status == 400) || response.jqXHR.status == 401) {
			console.error("user probably revoked access so removing token:", response);
			that.removeTokenResponse(tokenResponse);			
			that.onTokenError(tokenResponse, response);
		}
	}	

	// setup default functions...
	// params: changedToken, allTokens
	this.onTokenChange = function() {};
	this.onTokenError = function() {};
	
	this.openPermissionWindow = function(email) {
		return new Promise((resolve, reject) => {
			// prompt=select_account&
			var url = GOOGLE_AUTH_URL + "?response_type=code&client_id=" + GOOGLE_CLIENT_ID + "&redirect_uri=" + GOOGLE_REDIRECT_URI + "&scope=" + encodeURIComponent(GOOGLE_SCOPE) + "&state=" + that.getStateParam();
			if (email) {
				url += "&login_hint=" + encodeURIComponent(email);
			} else {
				url += "&prompt=select_account"; // does work :)
			}
			
			var width = 900;
			var height = 700;
			var left = Math.round( (screen.width/2)-(width/2) );
			var top = Math.round( (screen.height/2)-(height/2) );
			
			chrome.windows.create({url:url, width:width, height:height, left:left, top:top, type:"popup"}, function(newWindow) {
				resolve(newWindow);
			});
		});
	}
	
	this.setOnTokenChange = function(onTokenChange) {
		this.onTokenChange = onTokenChange;
	}

	this.setOnTokenError = function(onTokenError) {
		this.onTokenError = onTokenError;
	}

	function sendOAuthRequest(params) {
		return new Promise((resolve, reject) => {
			if (!params.type) {
				params.type = "GET";
			}
			
			var accessToken;
			if (params.tokenResponse) {
				accessToken = params.tokenResponse.access_token;
			} else if (params.userEmail) {
				var tokenResponse = that.findTokenResponse(params);
				accessToken = tokenResponse.access_token;
			}
	
			params.url = setUrlParam(params.url, "access_token", accessToken);
	
			// if no data then add empty structure		
			if (params.type == "DELETE") {
				params.data = null;
			} else {
				//if (!params.data) {
					//params.data = {};
				//}
	
				//params.data.access_token = accessToken;
			}
			
			if (params.processData == undefined) {
				params.processData = true;
			}
			
			$.ajax({
				type: params.type,
				url: BASE_URI + params.url,
				data: params.data,
				contentType: params.contentType,
				processData: params.processData,
				dataType: "json",
				timeout: 45000
			}).done(function( data, textStatus, jqXHR ) {
					if (jqXHR.responseText) {
						data = JSON.parse(jqXHR.responseText);
					} else {
						// happens when user does a method like DELETE where this no content returned
						data = {};
					}
					resolve({data:data});
			}).fail(function( jqXHR, textStatus, errorThrown ) {
				var error = new Error(textStatus);
				copyObj(params, error);
				
				error.jqXHR = jqXHR;
				// seems when offline the code 404 exists in the jqXHR.status so let's copy it to the response 
				error.code = jqXHR.status;
				error.textStatus = textStatus;
				
				if (jqXHR.responseText) {
					try {
						var errorObject = JSON.parse(jqXHR.responseText);
						error.message = errorObject.error.message;
						error.code = errorObject.error.code;
					} catch (e) {
						logError("error parsing error :) " + e);
					}
				}
				
				console.error("error getting data: " + error + " " + params.url);
				reject(error);
			});
		});
	}
	
	function ensureToken(tokenResponse) {
		return new Promise((resolve, reject) => {
			if (isExpired(tokenResponse)) {
				console.log("token expired: ", tokenResponse);
				refreshToken(tokenResponse).then(function(response) {
					resolve(response);
				}).catch(function(error) {
					reject(error);
				});
			} else {
				resolve({});
			}
		});
	}
	
	function refreshToken(tokenResponse) {
		return new Promise((resolve, reject) => {
			// must refresh token
			console.log("refresh token: " + tokenResponse.userEmail + " now time: " + Date.now().toString());
			$.ajax({
				type: "POST",
				url: GOOGLE_TOKEN_URL,			
				data: {refresh_token:tokenResponse.refresh_token, client_id:GOOGLE_CLIENT_ID, client_secret:GOOGLE_CLIENT_SECRET, grant_type:"refresh_token"},
				dataType: "json",
				timeout: 5000
			}).done(function( data, textStatus, jqXHR ) {
				var refreshTokenResponse = JSON.parse(jqXHR.responseText);
				tokenResponse.access_token = refreshTokenResponse.access_token;
				tokenResponse.expires_in = refreshTokenResponse.expires_in;
				tokenResponse.token_type = refreshTokenResponse.token_type;					
				
				var callbackParams = {tokenResponse:tokenResponse};
				onTokenChangeWrapper(callbackParams);
				console.log("in refresh: " + tokenResponse.expiryDate.toString());
				resolve(callbackParams);
			}).fail(function( jqXHR, textStatus, errorThrown ) {
				var error = new Error(jqXHR.statusText);
				error.tokenResponse = tokenResponse;
				error.jqXHR = jqXHR;
				error.oauthAction = "refreshToken";
				
				try {
					var bodyResponse = JSON.parse(jqXHR.responseText);
					error.message = bodyResponse.error;
				} catch (e) {
					// nothing
				}
				
				error.code = jqXHR.status;
				
				if (error == "invalid_grant") { // code = 400
					error.message = "You need to re-grant access, it was probably revoked";
				}
				
				console.error(error);
				reject(error);
			});
		});
	}
	
	// private isExpired
	function isExpired(tokenResponse) {
		var SECONDS_BUFFER = -300; // 5 min. yes negative, let's make the expiry date shorter to be safe
		return !tokenResponse.expiryDate || new Date().isAfter(tokenResponse.expiryDate.addSeconds(SECONDS_BUFFER, true));
	}

	// public method, should be called before sending multiple asynchonous requests to .send
	this.ensureTokenForEmail = function(userEmail) {
		return new Promise(function(resolve, reject) {
			var tokenResponse = that.findTokenResponse({userEmail:userEmail});
			if (tokenResponse) {
				ensureToken(tokenResponse).then(response => {
					resolve(response);
				}).catch(error => {
					reject(error);
				});
			} else {
				var error = new Error("no token for: " + userEmail + ": might have not have been granted access");
				console.error(error);
				reject(error);
			}
		});
	}		
	
	this.send = function(params) {
		return new Promise((resolve, reject) => {
			var tokenResponse = that.findTokenResponse(params);		
			if (tokenResponse) {
				ensureToken(tokenResponse).then(response => {
					return sendOAuthRequest(params).then(response => {
						response.roundtripArg = params.roundtripArg;
						resolve(response);
					});
				}).catch(error => {
					onTokenErrorWrapper(tokenResponse, error);						
					error.roundtripArg = params.roundtripArg;
					reject(error);
				});
			} else {
				var error = "no token response found for email: " + params.userEmail;
				console.warn(error, params);
				reject(error);
			}
		});
	}
	
	this.findTokenResponse = function(params) {
		for (var a=0; a<that.tokenResponses.length; a++) {
			if (that.tokenResponses[a].userEmail == params.userEmail) {
				return that.tokenResponses[a];
			}
		}
	}
	
	// removes token response and calls onTokenChange to propogate change back to client
	this.removeTokenResponse = function(params) {
		console.log("parms", params)
		for (var a=0; a<that.tokenResponses.length; a++) {
			if (that.tokenResponses[a].userEmail == params.userEmail) {
				that.tokenResponses.splice(a, 1);
				break;
			}
		}
		that.onTokenChange(null, that.tokenResponses);
	}

	this.removeAllTokenResponses = function() {
		that.tokenResponses = [];
		that.onTokenChange(null, that.tokenResponses);
	}

	this.getAccessToken = function(code) {
		return new Promise((resolve, reject) => {
			that.code = code;
			console.log("get access token");
			$.ajax({
				type: "POST",
				url: GOOGLE_TOKEN_URL,
				data: {code:code, client_id:GOOGLE_CLIENT_ID, client_secret:GOOGLE_CLIENT_SECRET, redirect_uri:GOOGLE_REDIRECT_URI, grant_type:"authorization_code"},
				dataType: "json",
				timeout: 5000,
				complete: function(request, textStatus) {
					if (textStatus == "success") {
						var tokenResponse = JSON.parse(request.responseText);
	
						if (tokenResponse.error) {
							reject(tokenResponse.error.message);
						} else {
							that.getUserEmail(tokenResponse).then(response => {
								if (response.userEmail) {
									// add this to response
									tokenResponse.userEmail = response.userEmail;
									
									var tokenResponseFromMemory = that.findTokenResponse(response);
									if (tokenResponseFromMemory) {
										// update if exists
										tokenResponseFromMemory = tokenResponse;
									} else {
										// add new token response
										that.tokenResponses.push(tokenResponse);
									}
									var callbackParams = {tokenResponse:tokenResponse};
									onTokenChangeWrapper(callbackParams);
									resolve(callbackParams);
								} else {
									reject(new Error("Could not fetch email"));
								}
							}).catch(error => {
								reject(error);
							});
						}
					} else {
						reject(request.statusText);
					}
				}
			});
		});
	} 
}

function ChromeStorage(defaults, storageItemsToCompress) {
	var that = this;
	
	storageItemsToCompress = initUndefinedObject(storageItemsToCompress);
	var cache = {};
	
	function initDefaults() {
    	if (defaults) {
    		for (key in defaults) {
    			if (cache[key] === undefined) {
    				cache[key] = defaults[key];
    			}
    		}
    	}
	}
	
	this.load = function() {
		return new Promise(function(resolve, reject) {
			console.log("Loading storage...");
			chrome.storage.local.get(null, items => {
				if (chrome.runtime.lastError){
		            reject(chrome.runtime.lastError.message);
		        } else {
		        	for (key in items) {
		        		if (storageItemsToCompress[key]) {
			    			try {
			    				console.time("decompress: " + key);
			    				items[key] = LZString.decompressFromUTF16(items[key]);
			    				console.timeEnd("decompress: " + key);
			    				
			    				if (items[key]) {
			    					items[key] = JSON.parse(items[key], dateReviver);
			    				} else {
			    					throw new Error("Value empty!");
			    				}
			    			} catch (e) {
			    				// Parsing error sometimes happens when computer/browser suddenly shuts down
			    				logError("Problem decompressing item: " + key + " " + e);
			    			}
			    			
			    			if (!items[key]) {
			    				// make it undefined so the default gets used below
			    				items[key] = undefined;
			    				chrome.storage.local.remove(key);
			    			}
		        		} else {
		        			// could be excessive but i'm stringifing because i want parse with the datereviver (instead of interating the object myself in search of date strings)
		        			items[key] = JSON.parse(JSON.stringify(items[key]), dateReviver);
		        		}

		        		// parse 1st level dates
		        		//traverseDateParser(items, key);
		        		// parse all sub level dates
		        		//traverse(items[key], traverseDateParser);
		        	}
		        	
		        	cache = items;
		        	initDefaults();
		        	resolve(cache);
		        }
			});
		});
	}
	
	this.get = function(key, defaultValue) {
		var value = cache[key];
		if (value == null && defaultValue != undefined) {
			value = defaultValue;
		} else {
			value = cache[key];
		}
		return value;
	}
	
	this.set = function(key, value) {
		return new Promise((resolve, reject) => {
			if (value === undefined) {
				var error = "value not set for key: " + key;
				console.error(error);
				reject(error);
			}
			
			var storageValue;

			// clone any objects/dates etc. or else we could modify the object outside and the cache will also be changed
			if (value instanceof Date) {
				cache[key] = new Date(value.getTime());
				storageValue = value.toJSON(); // must stringify this one because chrome.storage does not serialize
			} else if (value !== null && typeof value === 'object') {
				cache[key] = value;
				// clone
				//cache[key] = JSON.parse(JSON.stringify(value), dateReviver);
				if (storageItemsToCompress[key]) {
					console.time("stringify: " + key);
					value = JSON.stringify(value);
					console.timeEnd("stringify: " + key);
					console.time("compress: " + key);
					storageValue = bg.LZString.compressToUTF16(value);
					console.timeEnd("compress: " + key);
				} else {
					storageValue = JSON.parse(JSON.stringify(value));
					
				}
			} else {
				cache[key] = value;
				storageValue = value;
			}
			
			var item = {};
			item[key] = storageValue;
			chrome.storage.local.set(item, function() {
				if (chrome.extension.lastError) {
					var error = "Error with saving key: " + key + " " + chrome.extension.lastError.message;
					console.error(error);
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}
	
	this.enable = function(key) {
		that.set(key, true);
	}

	this.disable = function(key) {
		that.set(key, false);
	}
	
	this.setDate = function(key) {
		that.set(key, new Date());
	}
	
	this.toggle = function(key) {
    	if (that.get(key)) {
    		that.remove(key);
    	} else {
    		that.set(key, true);
    	}
	}
	
	this.remove = function(key) {
		return new Promise((resolve, reject) => {
			if (defaults) {
				cache[key] = defaults[key];
			} else {
				delete cache[key];
			}
			chrome.storage.local.remove(key, function() {
				if (chrome.extension.lastError) {
					var error = "Error removing key: " + key + " " + chrome.extension.lastError.message;
					console.error(error);
					reject(error);
				} else {
					resolve();
				}
			});
		});
	}
	
	this.clear = function() {
		return new Promise((resolve, reject) => {
			chrome.storage.local.clear(function() {
				if (chrome.extension.lastError) {
					var error = "Error clearing cache: " + chrome.extension.lastError.message;
					console.error(error);
					reject(error);
				} else {
					cache = {};
					initDefaults();
					resolve();
				}
			});
		});
	}
	
	this.firstTime = function(key) {
		if (that.get("_" + key)) {
			return false;
		} else {
			that.set("_" + key, new Date());
			return true;
		}
	}

}


function lightenDarkenColor(col, amt) {
	if (col) {
	    var usePound = false;
	    if ( col[0] == "#" ) {
	        col = col.slice(1);
	        usePound = true;
	    }
	
	    var num = parseInt(col,16);
	
	    var r = (num >> 16) + amt;
	
	    if ( r > 255 ) r = 255;
	    else if  (r < 0) r = 0;
	
	    var b = ((num >> 8) & 0x00FF) + amt;
	
	    if ( b > 255 ) b = 255;
	    else if  (b < 0) b = 0;
	
	    var g = (num & 0x0000FF) + amt;
	
	    if ( g > 255 ) g = 255;
	    else if  ( g < 0 ) g = 0;
	
	    var hex = (g | (b << 8) | (r << 16)).toString(16);
	    
	    // seems if color was already dark then making it darker gave us an short and invalid hex so let's make sure its 6 long
	    if (hex.length == 6) {
	    	return (usePound?"#":"") + hex;
	    } else {
	    	// else return same color
	    	return col;
	    }
	}
}

//see if the keypressed event equals the letter passed
function letterPressedEquals(e, letter) {
	if (e) {
		return letter.toUpperCase().charCodeAt(0) == e.which;
	} else {
		return null;
	}
}

// usage: object, function(object, key)
/*
function traverse(o, func) {
    for (i in o) {
		func.apply(this,[o, i]);  
        if (typeof(o[i])=="object") {
            //going on step down in the object tree!!
            traverse(o[i], func);
        }
    }
}
*/
function traverse(o, func) {
    for (i in o) {
		func.apply(this,[o, i]);
		if (Array.isArray(o[i])) {
			o[i].forEach(function(arrayItem) {
				traverse(arrayItem, func);
			});
		} else if (typeof(o[i])=="object") {
            //going on step down in the object tree!!
            traverse(o[i], func);
        }
    }
}

// for 2nd parmeter of JSON.parse(... , dateReviver);
function dateReviver(key, value) {
    if (isStringDate(value)) {
        return new Date(value);
    } else {
    	return value;
    }
}

function dateReplacer(key, value) {
    if (value instanceof Date) {
        return value.toJSON();
    } else {
    	return value;
    }
}

function isStringDate(str) {
	return typeof str == "string" && str.length == 24 && /\d{4}-\d{2}-\d{2}T\d{2}\:\d{2}\:\d{2}\.\d{3}Z/.test(str);
}

function traverseDateParser(o, key) {
	// 2012-12-04T13:51:06.897Z
	if (isStringDate(o[key])) {
		o[key] = new Date(o[key]);
	}
}

function traverseDateStringifier(o, key) {
	if (o[key] instanceof Date) {
		o[key] = o[key].toJSON();
	}
}

function clone(obj) {
	return $.extend(true, {}, obj);
}

//used to reduce load or requests: Will randomy select a date/time between now and maxdaysnfrom now and return true when this date/time has passed 
function passedRandomTime(name, maxDaysFromNow) {
	var randomTime = storage.get(name);
	
	// already set a random time let's if we passed it...
	if (randomTime) {
		randomTime = new Date(randomTime);
		// this randomtime is before now, meaning it has passed so return true
		if (randomTime.isBefore()) {
			return true;
		} else {
			return false;
		}
	} else {
		// set a random time
		if (!maxDaysFromNow) {
			maxDaysFromNow = 5; // default 5 days
		}
		var maxDate = new Date();
		maxDate = maxDate.addDays(maxDaysFromNow);
		
		var randomeMilliSecondsFromNow = parseInt(Math.random() * (maxDate.getTime() - Date.now()));
		randomTime = Date.now() + randomeMilliSecondsFromNow;
		randomTime = new Date(randomTime);
		
		console.log("Set randomtime: " + randomTime);
		storage.set(name, randomTime);
		return false;
	}
}

var getTextHeight = function(font) {
	  var text = $('<span>Hg</span>').css({ fontFamily: font });
	  var block = $('<div style="display: inline-block; width: 1px; height: 0px;"></div>');

	  var div = $('<div></div>');
	  div.append(text, block);

	  var body = $('body');
	  body.append(div);

	  try {

	    var result = {};

	    block.css({ verticalAlign: 'baseline' });
	    result.ascent = block.offset().top - text.offset().top;

	    block.css({ verticalAlign: 'bottom' });
	    result.height = block.offset().top - text.offset().top;

	    result.descent = result.height - result.ascent;

	  } finally {
	    div.remove();
	  }

	  return result;
};

function IconAnimation(iconUrl) {
	var animateCalled;
	var animateCallback;
	var iconLoaded;
	
	var icon = new Image();
	var that = this;
	icon.onload = function() {
		//console.log("icon onload");
		iconLoaded = true;
		if (that.animateCalled) {
			//console.log("this.animate called");
			that.animate(that.animateCallback);
		}
	}
	icon.src = iconUrl;
	
	var canvas = document.createElement('canvas');
	canvas.width = canvas.height = 19;
	var canvasContext = canvas.getContext('2d');

	var rotation = 1;
	var factor = 1;
	var animTimer;
	var animDelay = 40;
	
	this.stop = function() {
		if (animTimer != null) {
			clearInterval(animTimer);
		}
		rotation = 1;
		factor = 1;
	}

	this.animate = function(callback) {
		//console.log("in this.animate");
		that.stop();
		that.animateCalled = true;
		that.animateCallback = callback;
		if (iconLoaded) {
			//console.log("draw image");
			
			chrome.browserAction.getBadgeText({}, function(previousBadgeText) {					
				chrome.browserAction.setBadgeText({text : ""});
				//canvasContext.drawImage(icon, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
				
				// start animation
				animTimer = setInterval(function() {
					canvasContext.save();
					canvasContext.clearRect(0, 0, canvas.width, canvas.height);
					canvasContext.translate(Math.ceil(canvas.width / 2), Math.ceil(canvas.height / 2));
					canvasContext.rotate(rotation * 2 * Math.PI);
					canvasContext.drawImage(icon, -Math.ceil(canvas.width / 2), -Math.ceil(canvas.height / 2));
					
					// inverts images
					/*
					var imageData = canvasContext.getImageData(0, 0, icon.width, icon.height);
			        var data = imageData.data;

			        for(var i = 0; i < data.length; i += 4) {
			          // red
			          data[i] = 255 - data[i];
			          // green
			          data[i + 1] = 255 - data[i + 1];
			          // blue
			          data[i + 2] = 255 - data[i + 2];
			        }

			        // overwrite original image
			        canvasContext.putImageData(imageData, 0, 0);
			        */
					
					canvasContext.restore();
					
					rotation += 0.05 * factor;
					
					if (rotation <= 0.8 && factor < 0) {
						factor = 1;
					}
					else if (rotation >= 1.2 && factor > 0) {
						factor = -1;
					}
					
					chrome.browserAction.setIcon({
						imageData: canvasContext.getImageData(0, 0, canvas.width, canvas.height)
				   	});
				}, animDelay);
				
				// stop animation
				setTimeout(function() {
					that.stop();
					callback(previousBadgeText);
				}, 2500);
			});
		}
	}
}

var syncOptions = (function() {
	var MIN_STORAGE_EVENTS_COUNT_BEFORE_SAVING = 4;
	var LOCALSTORAGE_CHUNK_PREFIX = "localStorageChunk";
	var INDEXEDDB_CHUNK_PREFIX = "indexedDBChunk";
	var saveTimeout;
	var paused;
	
	// ex. syncChunks(deferreds, localStorageChunks, "localStorageChunk", setDetailsSeparateFromChunks);
	function syncChunks(deferreds, chunks, chunkPrefix, details, setDetailsSeparateFromChunks) {
		
		var previousDeferredsCount = deferreds.length;
		
		$(chunks).each(function(index, chunk) {
			var itemToSave = {};
			
			// let's set details + chunk together
			if (!setDetailsSeparateFromChunks) {
				itemToSave["details"] = details;
			}
			
			itemToSave[chunkPrefix + "_" + index + "_" + details.chunkId] = chunk;
			
			console.log("trying to sync.set json length: ", chunkPrefix + "_" + index + "_" + details.chunkId, chunk.length + "_" + JSON.stringify(chunk).length);
			
			deferred = $.Deferred(function(def) {
				
				// to avoid problems with MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE let's spread out the calls
				var delay;
				var SYNC_OPERATIONS_BEFORE = 1; // .clear were done before
				if (SYNC_OPERATIONS_BEFORE + previousDeferredsCount + chunks.length > chrome.storage.sync.MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE) {
					delay = (previousDeferredsCount+index) * seconds(10); // makes only 6 calls per minute
				} else {
					delay = 0;
				}
				setTimeout(function() {					
					chrome.storage.sync.set(itemToSave, function() {
						if (chrome.runtime.lastError) {
							var error = "sync error: " + chrome.runtime.lastError.message;
							logError(error);
							def.reject(error);
						} else {											
							console.log("saved " + chunkPrefix + " " + index);
							def.resolve("success");
						}
					});
				}, delay);
			});
			deferreds.push(deferred);
		});
	}
	
	// usage: compileChunks(details, items, details.localStorageChunksCount, LOCALSTORAGE_CHUNK_PREFIX) 
	function compileChunks(details, items, chunkCount, prefix) {
		var data = "";
		for (var a=0; a<chunkCount; a++) {
			data += items[prefix + "_" + a + "_" + details.chunkId];
		}
		return JSON.parse(data);
	}
	
	function isSyncable(key) {
		return !key.startsWith("_") && syncOptions.excludeList.indexOf(key) == -1;
	}
	
	return { // public interface
		init: function(excludeList) {
			if (!excludeList) {
				excludeList = [];
			}
			
			// append standard exclusion to custom ones
			excludeList = excludeList.concat(["version", "lastSyncOptionsSave", "lastSyncOptionsLoad", "detectedChromeVersion", "installDate", "installVersion", "DND_endTime"]);
			
			// all private members are accesible here
			syncOptions.excludeList = excludeList;
		},
		storageChanged: function(params) {
			if (!paused) {
				if (isSyncable(params.key)) {
					// we don't want new installers overwriting their synced data from previous installations - so only sync after certain amount of clicks by presuming their just going ahead to reset their own settings manually
					if (!localStorage._storageEventsCount) {
						localStorage._storageEventsCount = 0;
					}
					localStorage._storageEventsCount++;
					
					// if loaded upon new install then we can proceed immediately to save settings or else wait for minimum storage event
					if (localStorage.lastSyncOptionsLoad || localStorage.lastSyncOptionsSave || localStorage._storageEventsCount >= MIN_STORAGE_EVENTS_COUNT_BEFORE_SAVING) {
						console.log("storage event: " + params.key + " will sync it soon...");
						clearTimeout(saveTimeout);
						saveTimeout = setTimeout(function() {
							syncOptions.save("sync data: " + params.key);
						}, seconds(45));
					} else {
						console.log("storage event: " + params.key + " waiting for more storage events before syncing");
					}
				} else {
					//console.log("storage event ignored: " + params.key);
				}
			}
		},
		pause: function() {
			paused = true;
		},
		resume: function() {
			paused = false;
		},
		save: function(reason) {
			return new Promise(function(resolve, reject) {
				if (chrome.storage.sync) {
					// split it up because of max size per item allowed in Storage API
					// because QUOTA_BYTES_PER_ITEM is sum of key + value STRINGIFIED! (again)
					// watchout because the stringify adds quotes and slashes refer to https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
					// so let's only use 80% of the max and leave the rest for stringification when the sync.set is called
					var MAX_CHUNK_SIZE = Math.floor(chrome.storage.sync.QUOTA_BYTES_PER_ITEM * 0.80);
		
					console.log("syncOptions: saving data reason: " + reason + "...");
					
					chrome.storage.local.get(null, function(chromeStorageItems) {
						if (chrome.runtime.lastError) {
							console.error("could not fetch chrome.storage for sync: " + chrome.runtime.lastError.message);
						} else {
							// process chrome.storage.local
							var localStorageItemsToSave = {};
							for (key in chromeStorageItems) {
								// don't incude storage options starting with _blah and use exclude list
								if (isSyncable(key)) {
									console.log(key + ": " + chromeStorageItems[key]);
									localStorageItemsToSave[key] = chromeStorageItems[key];
								}
							}
							//localStorageItemsToSave = JSON.stringify(localStorageItemsToSave);
							
							// remove all items first because we might have less "chunks" of data so must clear the extra unsused ones now
							syncOptions.clear().then(() => {
								if (chrome.runtime.lastError) {
									var error = "sync error: " + chrome.runtime.lastError.message;
									logError(error);
									reject(error);
								} else {
									var deferreds = new Array();
									var deferred;
									
									var chunkId = getUniqueId();

									var localStorageChunks = chunkObject(localStorageItemsToSave, MAX_CHUNK_SIZE);
									//var indexedDBChunks = chunkObject(exportIndexedDBResponse.data, MAX_CHUNK_SIZE);
									
									var details = {chunkId:chunkId, localStorageChunksCount:localStorageChunks.length, extensionVersion:chrome.runtime.getManifest().version, lastSync:new Date().toJSON(), syncReason:reason};
									
									// can we merge details + first AND only chunk into one .set operation (save some bandwidth)
									var setDetailsSeparateFromChunks;
									
									if (localStorageChunks.length == 1 && JSON.stringify(details).length + localStorageChunks.first().length < MAX_CHUNK_SIZE) {
										setDetailsSeparateFromChunks = false;
									} else {
										setDetailsSeparateFromChunks = true;

										// set sync header/details...
										deferred = $.Deferred(function(def) {
											chrome.storage.sync.set({details:details}, function() {
												console.log("saved details");
												def.resolve("success");
											});
										});
										deferreds.push(deferred);
									}
									
									// in 1st call to syncChunks let's pass the last param setDetailsSeparateFromChunks
									// in 2nd call to syncChunks let's hard code setDetailsSeparateFromChunks to true
									syncChunks(deferreds, localStorageChunks, LOCALSTORAGE_CHUNK_PREFIX, details, setDetailsSeparateFromChunks);
									//syncChunks(deferreds, indexedDBChunks, INDEXEDDB_CHUNK_PREFIX, details, true);
									
									$.when.apply($, deferreds)
								   		.done(function() {
								   			localStorage.lastSyncOptionsSave = new Date();
								   			console.log("sync done");
								   			resolve();
								   		})
								   		.fail(function(args) {
								   			console.log(arguments);
								   			// error occured so let's clear storage because we might have only partially written data
								   			syncOptions.clear().catch(error => {
								   				// do nothing
								   			}).then(() => { // acts as a finally
								   				reject("jerror with sync deferreds");
								   			});
								   		})
								   	;
								}
							}).catch(error => {
								reject(error);
							});
						}
					});
				} else {
					reject(new Error("Sync is not supported!"));
				}
			});
		},
		fetch: function() {
			return new Promise(function(resolve, reject) {
				if (chrome.storage.sync) {
					console.log("syncOptions: fetch...");
					chrome.storage.sync.get(null, function(items) {
						if (chrome.runtime.lastError) {
							var error = "sync last error: " + chrome.runtime.lastError.message;
							reject(error);
						} else {
							console.log("items", items);
							if ($.isEmptyObject(items)) {
								reject("Could not find any synced data!<br><br>Make sure you sign in to Chrome on your other computer AND this one <a target='_blank' href='https://support.google.com/chrome/answer/185277'>More info</a>");
							} else {
								var details = items["details"];
								if (details.extensionVersion != chrome.runtime.getManifest().version) {
									reject({items:items, error:"Versions are different: " + details.extensionVersion + " and " + chrome.runtime.getManifest().version});
								} else {
									resolve(items);
								}
							}
						}
					});
				} else {
					reject(new Error("Sync is not supported!"));
				}
			});
		},
		load: function(items) {
			console.log("syncOptions: load...");
			return new Promise(function(resolve, reject) {
				if (chrome.storage.sync) {
					if (items) {
						var details = items["details"]; 
						if (details) {
							// process chrome.storage.local					
							var dataObj = compileChunks(details, items, details.localStorageChunksCount, LOCALSTORAGE_CHUNK_PREFIX);
							console.log("dataObj", dataObj);
							console.log("dataObj", typeof dataObj);
							console.log("dataObj", dataObj.length);
							console.log("dataObj", dataObj.details);
							chrome.storage.local.set(dataObj, () => {
								if (chrome.runtime.lastError) {
									var error = "set storage error: " + chrome.runtime.lastError.message;
									console.error(error);
									reject(error);
								} else {
									// finish stamp
									localStorage.lastSyncOptionsLoad = new Date();
									console.log("done");
									resolve(dataObj);
								}							
							});
						}
					} else {
						reject("No items found");
					}
				} else {
					reject(new Error("Sync is not supported!"));
				}
			});
		},
		exportIndexedDB: function(params, callback) {
			params = initUndefinedObject(params);
			
			db = bg.wrappedDB.db;
			
		    if (!db) {
		    	callback({error: "jerror db not declared"});
		    	return;
		    }

		    //Ok, so we begin by creating the root object:
		    var data = {};
		    var promises = [];
		    for(var i=0; i<db.objectStoreNames.length; i++) {
		        //thanks to http://msdn.microsoft.com/en-us/magazine/gg723713.aspx
		        promises.push(

		            $.Deferred(function(defer) {

		                var objectstore = db.objectStoreNames[i];
		                console.log("objectstore: " + objectstore);

		                var transaction = db.transaction([objectstore], "readonly");  
		                var content = [];

		                transaction.oncomplete = function(event) {
		                    console.log("trans oncomplete for " + objectstore + " with " + content.length + " items");
		                    defer.resolve({name:objectstore, data:content});
		                };

		                transaction.onerror = function(event) {
		                	// Don't forget to handle errors!
		                	console.dir(event);
		                };

		                var handleResult = function(event) {  
		                	var cursor = event.target.result;  
		                	if (cursor) {
		                		//console.log(cursor.key + " " + JSON.stringify(cursor.value).length);
		                		
		                		// don't incude storage options starting with _blah and use exclud list
		                		if (cursor.key.startsWith("_") || (!params.exportAll && syncOptions.excludeList.indexOf(cursor.key) != -1)) {
		                			// exclude this one and do nothing
		                			console.log("excluding this key: " + cursor.key);
		                		} else {
		                			content.push({key:cursor.key,value:cursor.value});
		                		}
		                		
		                		cursor.continue();  
		                	}
		                };  

		                var objectStore = transaction.objectStore(objectstore);
		                objectStore.openCursor().onsuccess = handleResult;

		            }).promise()

		        );
		    }

		    $.when.apply($, promises)
		    	.done(function() {
			        // arguments is an array of structs where name=objectstorename and data=array of crap
			        // make a copy cuz I just don't like calling it argument
			        var dataToStore = arguments;
			        //serialize it
			        var serializedData = JSON.stringify(dataToStore);
			        console.log("datastore:", dataToStore);
			        console.log("length: " + serializedData.length);
			        
			        callback({data:dataToStore});
			        
			        //downloadObject(dataToStore, "indexedDB.json");
			        
			        //The Christian Cantrell solution
			        //var link = $("#exportLink");
			        //document.location = 'data:Application/octet-stream,' + encodeURIComponent(serializedData);
			        //link.attr("href",'data:Application/octet-stream,'+encodeURIComponent(serializedData));
			        //link.trigger("click");
			        //fakeClick(link[0]);
		   		})
		   		.fail(function(args) {
		   			console.log(args)
		   			console.log(arguments)
		   			callback({error:"jerror when exporting"});
		   		})
		    ;
		},
		importIndexedDB: function(obj) {
			return new Promise(function(resolve, reject) {
				// first (and only) item in array should be the "settings" objectstore that i setup when using the indexedb with this gmail checker
				var settingsObjectStore = obj[0];
				if (settingsObjectStore.name == "settings") {
					
					var deferreds = new Array();
					
					for (var a=0; a<settingsObjectStore.data.length; a++) {
						var key = settingsObjectStore.data[a].key;
						var value = settingsObjectStore.data[a].value.value;
						console.log(key + ": " + value);
						var deferred = Settings.store(key, value);
						deferreds.push(deferred);
					}
					
				    $.when.apply($, deferreds)
				    	.done(function() {
					        resolve();
				   		})
				   		.fail(function() {
				   			console.log(arguments)
				   			reject("jerror when importing");
				   		})
				    ;
				} else {
					reject("Could not find 'settings' objectstore!");
				}
			});
		},
		// only clears syncOptions data ie. chunks_ and details etc.
		clear: function() {
			return new Promise((resolve, reject) => {
				if (chrome.storage.sync) {
					chrome.storage.sync.get(null, items => {
						if (chrome.runtime.lastError) {
							var error = "clear sync error: " + chrome.runtime.lastError.message;
							console.error(error);
							reject(error);
						} else {
							var itemsToRemove = [];
							for (key in items) {
								if (key == "details" || key.startsWith(LOCALSTORAGE_CHUNK_PREFIX) || key.startsWith("chunk_") /* old prefix */) {
									itemsToRemove.push(key);
								}
							}
							chrome.storage.sync.remove(itemsToRemove, () => {
								if (chrome.runtime.lastError) {
									var error = "remove sync items error: " + chrome.runtime.lastError.message;
									console.error(error);
									reject(error);
								} else {
									resolve();
								}
							});
						}
					});
				} else {
					reject(new Error("Sync is not supported!"));
				}
			});
		}
	};
})();

function downloadObject(data, filename) {
    if (!data) {
        console.error('No data')
        return;
    }

    if(!filename) filename = 'object.json'

    if(typeof data === "object"){
        data = JSON.stringify(data, undefined, 4)
    }

    var blob = new Blob([data], {type: 'text/json'}),
        e    = document.createEvent('MouseEvents'),
        a    = document.createElement('a')

    a.download = filename
    a.href = window.URL.createObjectURL(blob)
    a.dataset.downloadurl =  ['text/json', a.download, a.href].join(':')
    e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
    a.dispatchEvent(e)
}

function initUndefinedObject(obj) {
    if (typeof obj == "undefined") {
        return {};
    } else {
        return obj;
    }
}

function initUndefinedCallback(callback) {
    if (callback) {
        return callback;
    } else {
        return function() {};
    }
}

function chunkObject(obj, chunkSize) {
	var str = JSON.stringify(obj);
	return str.chunk(chunkSize);
}

function getDefaultVoice(voices, includeExternal) {
	
	function hasVoice(voices, voiceValue) {	
		for (var a=0; a<voices.length; a++) {
			// if extensiond id in value then match voicename and extension id
			if (voiceValue.indexOf("___") != -1 && includeExternal) {
				var voiceName = voiceValue.split("___")[0];
				var extensionId = voiceValue.split("___")[1];
				if (voices[a].voiceName == voiceName && voices[a].extensionId == extensionId) {
					return a;
				}
			} else if (voices[a].voiceName == voiceValue) {
				// no exension id so let's only match name
				return a;
			}
		}
		return -1;
	}
	
	var savedVoice = storage.get("notificationVoice");
	
	if (savedVoice) {
		var voiceIndexMatched = hasVoice(voices, savedVoice);
		if (voiceIndexMatched == -1) {

			// windows
			voiceIndexMatched = hasVoice(voices, "native");
			if (voiceIndexMatched == -1) {
				// linux
				voiceIndexMatched = hasVoice(voices, "default espeak");
			}
		}
		
		if (voiceIndexMatched == -1 && voices.length) {
			voiceIndexMatched = 0;
		}
	} else {
		voiceIndexMatched = -1;
	}
	
	return voiceIndexMatched;
}

function parseVersionString(str) {
    if (typeof(str) != 'string') { return false; }
    var x = str.split('.');
    // parse from string or default to 0 if can't parse
    var maj = parseInt(x[0]) || 0;
    var min = parseInt(x[1]) || 0;
    var pat = parseInt(x[2]) || 0;
    return {
        major: maj,
        minor: min,
        patch: pat
    }
}

function openTemporaryWindowToRemoveFocus() {
	// open a window to take focus away from notification and there it will close automatically
	var win = window.open("about:blank", "emptyWindow", "width=1, height=1, top=-500, left=-500");
	win.close();
}

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function isOnline() {
	// patch because some distributions of linux always returned false for is navigator.online so let's force it to true
	if (DetectClient.isLinux()) {
		return true;
	} else {
		return navigator.onLine;
	}
}

//cross OS used to determine if ctrl or mac key is pressed
function isCtrlPressed(e) {
	return e.ctrlKey || e.metaKey;
}

// make sure it's not a string or empty because it will equate to 0 and thus run all the time!!!
// make sure it's not too small like 0 or smaller than 15 seconds
function setIntervalSafe(func, time) {
	if (isNaN(time) || parseInt(time) < 1000) {
		throw Error("jerror with setinterval safe: " + time + " is NAN or too small");
	} else {
		return setInterval(func, time); 
	}
}

function isDomainEmail(email) {
	if (email) {
		email = email.toLowerCase();
		var POPULAR_DOMAINS = ["zoho", "aim", "videotron", "icould", "inbox", "yandex", "rambler", "ya", "sbcglobal", "msn", "me", "facebook", "twitter", "linkedin", "email", "comcast", "gmx", "aol", "live", "google", "outlook", "yahoo", "gmail", "mail", "comcast", "googlemail", "hotmail"];
		
		var foundPopularDomainFlag = POPULAR_DOMAINS.some(function(popularDomain) {
			if (email.indexOf("@" + popularDomain + ".") != -1) {
				return true;
			}
		});
		
		return !foundPopularDomainFlag;
	}
}

function loadImage($image, callback) {
	return new Promise(function(resolve, reject) {
		$image
			.load(function() {
				resolve($image);
			})
			.error(function(e) {
				reject(e);
			})
		;
	});
}

function alwaysPromise(promises) {
	return new Promise((resolve, reject) => {
        var successfulPromises = [];
        var failedPromises = [];
        
        function checkIfAllComplete() {
        	if (successfulPromises.length + failedPromises.length == promises.length) {
               	resolve({successful:successfulPromises, failures:failedPromises});
            }
        }
        
		promises.forEach(promise => {
  			promise.then(response => {
            	successfulPromises.push(response);
            	checkIfAllComplete();
    		}).catch(error => {
            	failedPromises.push(error);
        		checkIfAllComplete();
        	});
    	});
    });
}

function showMessageNotification(title, message, error) {
   var options = {
		   type: "basic",
		   title: title,
		   message: message,
		   iconUrl: "images/icons/icon-128_whitebg.png",
		   priority: 1
   }
   
   var notificationId;
   if (error) {
	   notificationId = "error";
	   if (DetectClient.isChrome()) {
		   options.contextMessage = "Error: " + error;
		   options.buttons = [{title:"If this is frequent then click here to report it", iconUrl:"images/open.svg"}];
	   } else {
		   options.message += " Error: " + error;
	   }
   } else {
	   notificationId = "message";
   }
   
   chrome.notifications.create(notificationId, options, function(notificationId) {
	   if (chrome.runtime.lastError) {
		   console.error(chrome.runtime.lastError.message);
	   } else {
		   setTimeout(function () {
			   chrome.notifications.clear(notificationId);
		   }, error ? seconds(15) : seconds(5));
	   }
   });
}

function showCouldNotCompleteActionNotification(error) {
	showMessageNotification("Error with last action.", "Try again or sign out and in.", error);
}
class ProgressNotification {
	constructor() {
	    this.PROGRESS_NOTIFICATION_ID = "progress";
	}
	
	show() {
		if (DetectClient.isChrome()) {
			var options = {
				type: "progress",
				title: getMessage("processing"),
				message: "",
				iconUrl: "images/icons/icon-128_whitebg.png",
				requireInteraction: true,
				progress: 0
			}
			
			var that = this;
			chrome.notifications.create(that.PROGRESS_NOTIFICATION_ID, options, function(notificationId) {
				if (chrome.runtime.lastError) {
					console.error(chrome.runtime.lastError.message);
				} else {
					that.progressInterval = setInterval(() => {
						options.progress += 20;
						if (options.progress > 100) {
							options.progress = 0;
						}
						chrome.notifications.update(that.PROGRESS_NOTIFICATION_ID, options);
					}, 200);
				}
			});
		}
	}
	
	cancel() {
		clearInterval(this.progressInterval);
		chrome.notifications.clear(this.PROGRESS_NOTIFICATION_ID);
	}

	complete(title) {
		var that = this;
		clearInterval(this.progressInterval);
		setTimeout(() => {
			chrome.notifications.clear(that.PROGRESS_NOTIFICATION_ID, () => {
				showMessageNotification(title ? title : "Complete", getMessage("clickToolbarIconToContinue"));
			});
		}, 200);
	}
}

function getInstallDate() {
	var installDate = storage.get("installDate");
	if (!installDate) {
		installDate = new Date();
	}
	return installDate;
}

function insertScript(url) {
	var script = document.createElement('script');
	script.async = true;
	script.src = url;
	(document.getElementsByTagName('head')[0]||document.getElementsByTagName('body')[0]).appendChild(script);	
}