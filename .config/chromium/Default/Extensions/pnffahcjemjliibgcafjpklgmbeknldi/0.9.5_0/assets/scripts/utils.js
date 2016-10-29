
/* Cleans the text (converts double spaces into spaces...)
Thanks http://www.mediacollege.com/internet/javascript/text/count-words.html
================================================== */
function cleanTxt(s){
  //Remove whitespaces (global, case insensitive)
  s = s.replace(/(^\s*)|(\s*$)/gi,"");
  //Line feed (000A) become 1 space (global, case insensitive)
  s = s.replace(/[\u000A]/gi," ");
  //2 spaces or more become 1 space (global, case insensitive)
  s = s.replace(/[\u0020]{2,}/gi," ");
  //Oo?
  s = s.replace(/\n /,"\n");
  return s;
}

/* Counts the number of words
================================================== */
function wordCount(s){
  return s.split(' ').length;
}


/* Converts wpm into ms (ex: 300wpm = 200ms)
================================================== */
function wpmToMs(wpm){
	var ms = 60000/wpm;
	return ms;
}


/* Returns the percentage of read text so far
================================================== */
function getProgress(){
  return Math.round((((textToRead.originalNbOfWords - textToRead.currentNbOfWords)*100)/textToRead.originalNbOfWords)*100)/100;
}