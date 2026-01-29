export default class AudioManager {
  static audio;
  static settings = {
    play: true,
  };

  static playSound(play) {
    this.settings.play = play;
  }

  static ping() {
    try {
      if (!this.settings.play) {
        return;
      }

      if (!this.audio) {
        this.audio = new Audio("https://yaplet.com/sounds/newmessage.mp3");
      }

      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then((_) => { }).catch((error) => { });
      }
    } catch (exp) { }
  }
}
