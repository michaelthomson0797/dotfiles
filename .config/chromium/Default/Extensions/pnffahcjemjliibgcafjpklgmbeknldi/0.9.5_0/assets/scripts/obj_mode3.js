
var mode3 = {

  modeName: "Flow",

  modeArea: "#mode3",

  isReading: false,

  nbOfWordAtATime: 4,

	start: function(){
    this.isReading = true;
    $('#nbOfWords').text(textToRead.originalNbOfWords + " words");
    putPlay();
    var word;
    var i;
    var that = this;
    int = setInterval(function(){

    	if(textToRead.currentNbOfWords > 0){
    		$("#mode3 .words").text("");
	    	for (var i = 0; i < that.nbOfWordAtATime; i++) {
	    		word = textToRead.nextWord();
		      textToRead.currentNbOfWords--;
	        $("#mode3 .words").append(word + " ");
	        setProgressBar();
		    	if (word == ""){break;}
	    	};
	    	if(word == "")
	        that.end();
    	}
    	else
    		that.end();

    },wpmToMs(speed)*this.nbOfWordAtATime); //speed x nb of words
  },

  pause: function(){
    this.isReading = false;
    clearInterval(int);
    putPause();
  },

  //Resets and comes back to the 1st word
  reset: function(){
    this.pause();
    textToRead.reset();
    $("#mode3 .words").text("");
    setProgressBar();
    var word;
  	for (var i = 0; i < this.nbOfWordAtATime; i++) {
  		word = textToRead.nextWord();
      textToRead.currentNbOfWords--;
      $("#mode3 .words").append(word + " ");
    	if (word == ""){break;}
  	};
  	if(word == "")
      that.end();
  },

  //Resets but stays on the last word
  end: function(){
  	this.pause();
    textToRead.reset();
  },

  //Starts if it's paused / Pauses if it's started
  toggle: function(){
    if(this.isReading == false)
      this.start();
    else
      this.pause();
  }
}