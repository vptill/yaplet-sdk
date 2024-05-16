import { dataParser } from "./Helper";

export default class TagManager {
  tags = [];

  // TagManager singleton
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new TagManager();
    }
    return this.instance;
  }

  /**
   * Returns the tags
   * @returns {*}
   */
  getTags() {
    return this.tags;
  }

  /**
   * Sets the tags sent with every ticket.
   * @param {*} tags Array of strings
   */
  setTags(tags) {
    this.tags = tags;
  }
}
