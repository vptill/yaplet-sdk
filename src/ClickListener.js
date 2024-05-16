import { ConsoleLogManager, FrameManager, handleYapletLink } from "./Yaplet";
import { getDOMElementDescription } from "./Helper";

export default class ClickListener {
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new ClickListener();
    }
    return this.instance;
  }

  start() {
    document.addEventListener("click", (e) => {
      if (!e.target) {
        return;
      }

      if (e.target.tagName === "A" && e.target.protocol === "yaplet:") {
        e.preventDefault();

        const href = e.target.href;
        handleYapletLink(href);
      }

      if (!FrameManager.getInstance().isOpened()) {
        ConsoleLogManager.getInstance().addLog(
          getDOMElementDescription(e.target),
          "CLICK"
        );
      }
    });
  }
}
