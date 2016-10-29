var response = {};
var subject = document.querySelectorAll("div[role='main'] .hP");
if (subject && subject.length) {
	var desc = document.querySelectorAll("div[role='main'] .ii.gt");
	if (desc && desc.length) {
		desc = desc[0].innerText;
	} else {
		desc = null;
	}
	response = {title:subject[0].innerText, description:desc};
	// weird yes, but the following line will output object and pass it to the callback of chrome.tabs.executeScript
	response;
} else {
	response;
}