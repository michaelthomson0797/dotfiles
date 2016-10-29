
chrome.extension.onMessage.addListener(
  function(request, sender, sendResponse) {
    if(request.method == "getTextToRead"){
      var content = "";
    	if (document.getSelection().toString() == "")
    		content = document.body.innerText;
    	else
    		content = document.getSelection().toString();
      var response = {
        title: document.title,
        data: content
      }
      sendResponse(response);
    }
    else{
      sendResponse({});
    }
  }
);