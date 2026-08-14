export default class CustomDataManager {
  // attachCustomData / setCustomData were retired 2026-08-13 (owner decision): the
  // bug-report endpoint never stored the payload — board_tickets has no column for it —
  // so the calls silently swallowed data for their whole life. Ticket attributes are the
  // one custom-data path that actually reaches the ticket (merged into the form answers).
  ticketAttributes = {};

  // CustomDataManager singleton
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new CustomDataManager();
    }
    return this.instance;
  }

  /**
   * This method is used to set ticket attributes programmatically.
   * @param {*} key The key of the attribute you want to add.
   * @param {*} value The value to set.
   */
  setTicketAttribute(key, value) {
    this.ticketAttributes[key] = value;
  }

  getTicketAttributes() {
    return this.ticketAttributes;
  }
}
