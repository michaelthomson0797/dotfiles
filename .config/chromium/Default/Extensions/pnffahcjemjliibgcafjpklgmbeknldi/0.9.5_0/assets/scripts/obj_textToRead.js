
//Text selected by the user
var textToRead = {

	originalText: "",

	currentText: "",

	originalNbOfWords: 0,

	currentNbOfWords: 0,

	currentWord: "",

	init: function(txt){
		this.originalText = txt;
		this.currentText = txt;
		this.originalNbOfWords = wordCount(this.originalText);
		this.currentNbOfWords = this.originalNbOfWords;
	},

	nextWord: function(){
		if (this.currentText.length != 0){
			//If it's not the last word
			if (this.currentText.indexOf(" ") != -1)
		    //Then gets the position of the end of the word
		    var to = this.currentText.indexOf(" ");
		  //If it's the last word
		  else
		  	//Then gets the position of the end of the text
		    var to = this.currentText.length;

		  //Gets the next word knowing its end position
		  this.currentWord = this.currentText.substring(0, to);

		  //Removes this word of the current text
		  this.currentText = this.currentText.substring(to+1, this.currentText.length);
		}
		else this.currentWord = "";
	  return this.currentWord;
	},

	reset: function(){
		this.currentText = this.originalText;
		this.currentNbOfWords = this.originalNbOfWords;
	}
};