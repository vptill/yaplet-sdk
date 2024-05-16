export default class PreFillManager {
  formPreFill = {};

  // PreFillManager singleton
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new PreFillManager();
    }
    return this.instance;
  }
}
