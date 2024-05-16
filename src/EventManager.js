import Yaplet from "./Yaplet";

export default class EventManager {
  eventListeners = {};

  // EventManager singleton
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new EventManager();
    }
    return this.instance;
  }

  /**
   * Notify all registrants for event.
   */
  static notifyEvent(event, data = {}) {
    if (event === "flow-started") {
      const yapletInstance = Yaplet.getInstance();
      yapletInstance.setGlobalDataItem("webReplay", null);
      yapletInstance.setGlobalDataItem("screenRecordingData", null);
      yapletInstance.takeCurrentReplay();
    }

    const eventListeners = this.getInstance().eventListeners[event];
    if (eventListeners) {
      for (var i = 0; i < eventListeners.length; i++) {
        const eventListener = eventListeners[i];
        if (eventListener) {
          eventListener(data);
        }
      }
    }
  }

  /**
   * Register events for Yaplet.
   * @param {*} eventName
   * @param {*} callback
   */
  static on(eventName, callback) {
    const instance = this.getInstance();
    if (!instance.eventListeners[eventName]) {
      instance.eventListeners[eventName] = [];
    }
    instance.eventListeners[eventName].push(callback);
  }
}
