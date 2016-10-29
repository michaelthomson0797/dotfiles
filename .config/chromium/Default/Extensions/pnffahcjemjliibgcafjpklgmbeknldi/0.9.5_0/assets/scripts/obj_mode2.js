
var mode2 = {

  modeName: "Diamond",

  modeArea: "#mode2",

  isReading: false,

  words: ["","","","",""],

  start: function(){
    this.isReading = true;
    $('#nbOfWords').text(textToRead.originalNbOfWords + " words");
    putPlay();
    if(this.words[2] == ""){
      this.words[3] = textToRead.nextWord();
      this.words[4] = textToRead.nextWord();
    }
    var that = this;
    int = setInterval(function(){
      that.words[0] = that.words[1];
      that.words[1] = that.words[2];
      that.words[2] = that.words[3];
      that.words[3] = that.words[4];
      that.words[4] = textToRead.nextWord();
      textToRead.currentNbOfWords--;
      if (that.words[2] != ""){
        $("#mode2 .word1").text(that.words[0]);
        $("#mode2 .word2").text(that.words[1]);
        $("#mode2 .word3").text(that.words[2]);
        $("#mode2 .word4").text(that.words[3]);
        $("#mode2 .word5").text(that.words[4]);
        setProgressBar();
      }
      else{
        that.end();
      }

    },wpmToMs(speed));
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
    setProgressBar();
    this.words = ["","","","",""];
    $("#mode2 .word1").text("");
    $("#mode2 .word2").text("");
    $("#mode2 .word3").text("");
    $("#mode2 .word4").text("");
    $("#mode2 .word5").text("");
    this.words[3] = textToRead.nextWord();
    this.words[4] = textToRead.nextWord();
    this.words[2] = this.words[3];
    this.words[3] = this.words[4];
    this.words[4] = textToRead.nextWord();
    textToRead.currentNbOfWords--;
    if (this.words[2] != ""){
      $("#mode2 .word3").text(this.words[2]);
      $("#mode2 .word4").text(this.words[3]);
      $("#mode2 .word5").text(this.words[4]);
    }
  },

  //Resets but stays on the last word
  end: function(){
    this.pause()
    textToRead.reset();
    this.words = ["","","","",""];
  },

  //Starts if it's paused / Pauses if it's started
  toggle: function(){
    if(this.isReading == false)
      this.start();
    else
      this.pause();
  }
}