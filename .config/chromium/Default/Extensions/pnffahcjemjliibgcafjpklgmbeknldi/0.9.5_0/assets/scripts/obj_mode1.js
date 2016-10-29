
var mode1 = {

  modeName: "Flash",

  modeArea: "#mode1",

  isReading: false,

  start: function(){
    this.isReading = true;
    $('#nbOfWords').text(textToRead.originalNbOfWords + " words");
    putPlay();
    var word;
    var that = this;
    int = setInterval(function(){
    	word = textToRead.nextWord();
      textToRead.currentNbOfWords--;
    	if (word != ""){
        $("#mode1 .word").text(word);
        setProgressBar();
      }
      else
        that.end();

    },wpmToMs(speed));
  },

  pause: function(){
    this.isReading = false;
    clearInterval(int);
    putPause();
  },

  //Reset and come back to the 1st word
  reset: function(){
    this.pause();
    textToRead.reset();
    setProgressBar();
    var word = textToRead.nextWord();
    textToRead.currentNbOfWords--;
    if (word != "")
      $("#mode1 .word").text(word);
  },

  //Reset but stay on the last word
  end: function(){
    this.pause();
    textToRead.reset();
  },

  //Start if it's paused / Pause if it's started
  toggle: function(){
    if(this.isReading == false){
      this.start();
    }
    else
      this.pause();
  }
}
