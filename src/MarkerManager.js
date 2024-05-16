import Yaplet, { TranslationManager, FrameManager } from "./Yaplet";
import { ScreenDrawer } from "./ScreenDrawer";
import { ScrollStopper } from "./ScrollStopper";
import { ScreenRecorder } from "./ScreenRecorder";
import { loadIcon } from "./UI";

export default class MarkerManager {
  type = "screenshot";
  dragCursor = null;
  screenRecorder = null;
  callback = null;
  screenDrawer = null;
  escListener = null;
  pageLeaveListener = null;
  overrideLanguage = Yaplet.getInstance().overrideLanguage;

  constructor(type) {
    this.type = type;
  }

  hideWidgetUI() {
    const feedbackButton = document.querySelector(".yy-feedback-button");
    if (feedbackButton) {
      feedbackButton.style.display = "none";
    }

    const dialogUI = document.querySelector(".yy-feedback-dialog-container");
    if (dialogUI) {
      dialogUI.style.display = "none";
    }
  }

  showWidgetUI() {
    if (this.type === "screenshot") {
      ScrollStopper.enableScroll();
    }

    // Stop screenrecording.
    if (this.screenRecorder) {
      this.screenRecorder.stopScreenRecording();
    }

    // Unregister ESC listener
    this.unregisterListeners();

    // Cleanup mouse pointer
    this.cleanupMousePointer();

    if (this.screenDrawer) {
      this.screenDrawer.destroy();
    }

    // Remove the toolbar UI
    const dialog = document.querySelector(".yy-capture-toolbar");
    if (dialog) {
      dialog.remove();
    }

    // Capture SVG ref
    const captureSVG = document.querySelector(".yy-capture-svg");
    if (captureSVG) {
      captureSVG.classList.add("yy-capture-svg--preview");
    }

    // Remove the preview UI
    const videoPreviewContainer = document.querySelector(".yy-capture-preview");
    if (videoPreviewContainer) {
      videoPreviewContainer.remove();
    }

    // Feedback button
    const feedbackButton = document.querySelector(".yy-feedback-button");
    if (feedbackButton) {
      feedbackButton.style.display = "flex";
    }

    // Feedback dialog container
    const dialogUI = document.querySelector(".yy-feedback-dialog-container");
    if (dialogUI) {
      dialogUI.style.display = "block";
    }

    // Dismiss button
    const dismissUI = document.querySelector(".yy-capture-dismiss");
    if (dismissUI) {
      dismissUI.style.display = "none";
    }

    // Hide the color picker
    const colorPicker = document.querySelector(
      ".yy-capture-toolbar-item-colorpicker"
    );
    if (colorPicker) {
      colorPicker.style.display = "none";
    }

    // Border layer
    const borderLayer = document.querySelector(
      ".yy-capture-editor-borderlayer"
    );
    if (borderLayer) {
      borderLayer.style.display = "none";
    }
  }

  clear() {
    const captureEditor = document.querySelector(".yy-capture-editor");
    if (captureEditor) {
      captureEditor.remove();
    }
  }

  setMouseMove(x, y) {
    if (!this.dragCursor) {
      return;
    }

    this.dragCursor.style.left = `${x + 6}px`;
    this.dragCursor.style.top = `${y - 26}px`;
    this.dragCursor.style.right = null;
  }

  mouseMoveEventHandler(e) {
    const x = e.clientX;
    const y = e.clientY;
    this.setMouseMove(x, y);
  }

  touchMoveEventHandler(e) {
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    this.setMouseMove(x, y);
  }

  setupMousePointer() {
    const self = this;
    this.dragCursor = document.querySelector(".yy-capture-editor-drag-info");
    const captureSVG = document.querySelector(".yy-capture-svg");
    captureSVG.addEventListener("mouseenter", (e) => {
      self.dragCursor.style.opacity = 1;
    });

    captureSVG.addEventListener("mouseleave", (e) => {
      self.dragCursor.style.opacity = 0;
    });

    document.documentElement.addEventListener(
      "mousemove",
      this.mouseMoveEventHandler.bind(this)
    );
    document.documentElement.addEventListener(
      "touchmove",
      this.touchMoveEventHandler.bind(this)
    );
  }

  cleanupMousePointer() {
    document.documentElement.removeEventListener(
      "mousemove",
      this.mouseMoveEventHandler
    );
    document.documentElement.removeEventListener(
      "touchmove",
      this.touchMoveEventHandler
    );

    if (this.dragCursor) {
      this.dragCursor.remove();
    }
  }

  createEditorUI() {
    // Add HTML for drawing and recording
    var bugReportingEditor = document.createElement("div");
    bugReportingEditor.className = "yy-capture-editor";
    bugReportingEditor.innerHTML = `
          <div class="yy-capture-editor-borderlayer"></div>
          <svg class="yy-capture-svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" xml:space="preserve"></svg>
          <div class="yy-capture-dismiss">${loadIcon("dismiss")}</div>
          <div class='yy-capture-editor-drag-info'>${loadIcon("rect")}</div>
          <div class="yy-capture-toolbar">
            ${
              this.type === "capture"
                ? `<div class="yy-capture-toolbar-item yy-capture-item-rec yy-capture-toolbar-item-recording" data-type="recording">
                  ${loadIcon("recorderon")}
                  ${loadIcon("recorderoff")}
                  <span class="yy-tooltip yy-tooltip-screen-recording"></span>
                </div>
                <div class="yy-capture-toolbar-item yy-capture-item-rec" data-type="mic">
                  ${loadIcon("mic")}
                  <span class="yy-tooltip yy-tooltip-audio-recording"></span>
                </div>
                <div class="yy-capture-toolbar-item-timer yy-capture-item-rec">2:00</div>
                <div class="yy-capture-toolbar-item-spacer"></div>
                <div class="yy-capture-toolbar-item yy-capture-toolbar-drawingitem yy-capture-toolbar-item-tool" data-type="pointer">
                  ${loadIcon("pointer")}
                </div>`
                : ""
            }
            <div class="yy-capture-toolbar-item yy-capture-toolbar-drawingitem yy-capture-toolbar-item-tool yy-capture-toolbar-item--active" data-type="rect">
              ${loadIcon("rect")}
            </div>
            <div class="yy-capture-toolbar-item yy-capture-toolbar-drawingitem yy-capture-toolbar-item-tool" data-type="pen">
              ${loadIcon("pen")}
            </div>
            <div class="yy-capture-toolbar-item yy-capture-toolbar-drawingitem yy-capture-toolbar-item-tool" data-type="blur">
              ${loadIcon("blur")}
            </div>
            <div class="yy-capture-toolbar-item yy-capture-toolbar-drawingitem" data-type="colorpicker">
              <div class="yy-capture-toolbar-item-selectedcolor"></div>
              <span class="yy-tooltip">${TranslationManager.translateText(
                `pickAColor`
              )}</span>
            </div>
            <div class="yy-capture-toolbar-item yy-capture-toolbar-drawingitem yy-capture-toolbar-item-tool" data-type="undo">
              ${loadIcon("undo")}
              <span class="yy-tooltip">${TranslationManager.translateText(
                `undo`
              )}</span>
            </div>
            ${
              this.type !== "capture"
                ? `<div class="yy-capture-button-next">${TranslationManager.translateText(
                    `next`
                  )}</div>`
                : ""
            }
          </div>
          <div class="yy-capture-toolbar-item-colorpicker">
            <div class="yy-capture-toolbar-item-color" data-color="#EB144C"></div>
            <div class="yy-capture-toolbar-item-color" data-color="#FF6705"></div>
            <div class="yy-capture-toolbar-item-color" data-color="#FDB903"></div>
            <div class="yy-capture-toolbar-item-color" data-color="#9900EE"></div>
            <div class="yy-capture-toolbar-item-color" data-color="#00D082"></div>
            <div class="yy-capture-toolbar-item-color" data-color="#0A93E4"></div>
            <div class="yy-capture-toolbar-item-color" data-color="#CCCCCC"></div>
          </div>
          <div class="yy-capture-preview">
            <div class="yy-capture-preview-inner">
              <video controls muted autoplay></video>
              <div class="yy-capture-preview-buttons">
                <div class="yy-capture-preview-retrybutton">${TranslationManager.translateText(
                  `retry`
                )}</div>
                <div class="yy-capture-preview-sendbutton">${TranslationManager.translateText(
                  `next`
                )}</div>
              </div>
            </div>
          </div>
        `;
    document.body.appendChild(bugReportingEditor);

    // Set RTL layout
    bugReportingEditor.setAttribute(
      "dir",
      TranslationManager.getInstance().isRTLLayout ? "rtl" : "ltr"
    );
  }

  showNextStep = function () {
    // Adapt the UI
    this.showWidgetUI();

    if (this.callback) {
      FrameManager.getInstance().sendMessage({
        name: "set-form-data",
        data: {
          formKey: "capture",
          data: {
            value: this.type,
            dirty: true,
          },
        },
      });
      this.callback(true);
    }
  };

  unregisterListeners() {
    if (this.escListener) {
      document.removeEventListener("keydown", this.escListener);
    }

    if (this.pageLeaveListener) {
      window.removeEventListener("beforeunload", this.pageLeaveListener);
    }
  }

  registerListeners() {
    const self = this;

    // Esc listener
    this.escListener = function (evt) {
      evt = evt || window.event;
      var isEscape = false;
      var isEnter = false;
      if ("key" in evt) {
        isEscape = evt.key === "Escape";
        isEnter = evt.key === "Enter";
      }
      if (isEscape) {
        self.dismiss();
      }
      if (self.type === "screenshot" && isEnter) {
        self.showNextStep();
      }
    };
    document.addEventListener("keydown", this.escListener);

    // Page leave listener
    this.pageLeaveListener = function (event) {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", this.pageLeaveListener);
  }

  show(callback) {
    this.callback = callback;
    const self = this;

    // Register for listeners
    this.registerListeners();

    // Hide widget UI
    this.hideWidgetUI();

    // Create the editor UI
    this.createEditorUI();

    // Setup the mouse pointer
    this.setupMousePointer();

    // Setup screenshot data
    if (this.type === "screenshot") {
      // Overwrite snapshot position
      Yaplet.getInstance().setGlobalDataItem("snapshotPosition", {
        x: window.scrollX,
        y: window.scrollY,
      });

      // Disable scroll
      ScrollStopper.disableScroll();
    } else {
      // Setup screen recording
      this.setupScreenRecording();
    }

    // Hook up the drawing.
    this.screenDrawer = new ScreenDrawer(
      this.captureScreenDrawerRerender.bind(this)
    );

    this.setupColorPicker();
    this.setupToolbar();
  }

  setupColorPicker() {
    const self = this;
    const selectedColor = document.querySelector(
      ".yy-capture-toolbar-item-selectedcolor"
    );
    const colorItems = document.querySelectorAll(
      ".yy-capture-toolbar-item-color"
    );
    const colorpicker = document.querySelector(
      ".yy-capture-toolbar-item-colorpicker"
    );

    for (var i = 0; i < colorItems.length; i++) {
      const colorItem = colorItems[i];
      const hexColor = colorItem.getAttribute("data-color");
      colorItem.style.backgroundColor = hexColor;
      colorItem.onclick = function () {
        if (colorItem) {
          self.screenDrawer.setColor(hexColor);
          if (colorpicker) {
            colorpicker.style.display = "none";
          }
          selectedColor.style.backgroundColor = colorItem.style.backgroundColor;
          MarkerManager.setPenColor(hexColor);
        }
      };
    }
  }

  static setPenColor(hexColor) {
    const penTips = document.querySelectorAll(".yy-pen-tip");
    for (var j = 0; j < penTips.length; j++) {
      penTips[j].style.fill = hexColor;
    }
  }

  dismiss() {
    this.showWidgetUI();

    if (this.callback) {
      this.callback(false);
    }
  }

  setupToolbar() {
    const self = this;

    // Hook up dismiss button
    const dismissButton = document.querySelector(".yy-capture-dismiss");
    dismissButton.onclick = function () {
      self.dismiss();
    };

    // Hook up send button
    const nextButton = document.querySelector(".yy-capture-button-next");
    if (nextButton) {
      nextButton.onclick = this.showNextStep.bind(this);
    }

    const colorpicker = document.querySelector(
      ".yy-capture-toolbar-item-colorpicker"
    );

    // Capture SVG ref
    const captureSVG = document.querySelector(".yy-capture-svg");

    const chooseTool = function (type, toolbarItem) {
      const toolbarTools = document.querySelectorAll(
        ".yy-capture-toolbar-item-tool"
      );
      for (let j = 0; j < toolbarTools.length; j++) {
        toolbarTools[j].classList.remove("yy-capture-toolbar-item--active");
      }
      toolbarItem.classList.add("yy-capture-toolbar-item--active");
      self.screenDrawer.setTool(type);
      self.dragCursor.innerHTML = "";
      if (type === "pointer") {
        captureSVG.style.pointerEvents = "none";
      } else {
        captureSVG.style.pointerEvents = "auto";
        try {
          var svgClone = toolbarItem.querySelector("svg").cloneNode(true);
          if (svgClone && self.dragCursor) {
            self.dragCursor.appendChild(svgClone);
          }
        } catch (exp) {}
      }
    };

    // Setup toolbar items
    var toolbarItems = document.querySelectorAll(".yy-capture-toolbar-item");
    for (var i = 0; i < toolbarItems.length; i++) {
      const toolbarItem = toolbarItems[i];
      toolbarItem.onclick = function () {
        const type = toolbarItem.getAttribute("data-type");
        if (colorpicker && type !== "colorpicker") {
          colorpicker.style.display = "none";
        }

        // Mic & recording buttons
        if (type === "mic") {
          self.screenRecorder.toggleAudio();
        }
        if (type === "recording") {
          if (self.screenRecorder.isRecording) {
            self.screenRecorder.stopScreenRecording();
          } else {
            self.screenRecorder.startScreenRecording();
            chooseTool(
              "pointer",
              document.querySelector(
                ".yy-capture-toolbar-item[data-type='pointer']"
              )
            );
          }
        }

        // Marker buttons
        if (self.type === "capture" && !self.screenRecorder.isRecording) {
          // Inactivate buttons.
          return;
        }
        if (
          type === "pen" ||
          type === "blur" ||
          type === "rect" ||
          type === "pointer"
        ) {
          chooseTool(type, toolbarItem);
        }
        if (type === "colorpicker") {
          if (colorpicker.style.display === "flex") {
            colorpicker.style.display = "none";
          } else {
            colorpicker.style.display = "flex";
          }
        }
        if (type === "undo") {
          self.screenDrawer.removeLastAddedPathFromSvg();
        }
      };
    }
  }

  captureScreenDrawerRerender() {
    if (!this.screenDrawer) {
      return;
    }

    const itemInactiveClass = "yy-capture-editor-item-inactive";
    const toolbarItems = document.querySelectorAll(".yy-capture-toolbar-item");
    for (var i = 0; i < toolbarItems.length; i++) {
      const toolbarItem = toolbarItems[i];
      const type = toolbarItem.getAttribute("data-type");
      switch (type) {
        case "undo":
          if (
            this.screenDrawer.pathBuffer != null &&
            this.screenDrawer.pathBuffer.length > 0
          ) {
            toolbarItem.classList.remove(itemInactiveClass);
          } else {
            toolbarItem.classList.add(itemInactiveClass);
          }
          break;
        default:
          break;
      }
    }
  }

  captureRenderer() {
    if (!this.screenRecorder) {
      return;
    }

    if (this.screenRecorder.file) {
      Yaplet.getInstance().setGlobalDataItem(
        "screenRecordingData",
        this.screenRecorder.file
      );
    }

    const itemInactiveClass = "yy-capture-editor-item-inactive";
    const timerLabel = document.querySelector(".yy-capture-toolbar-item-timer");
    const toolbarItems = document.querySelectorAll(".yy-capture-toolbar-item");
    const screenRecordingTooltip = document.querySelector(
      ".yy-tooltip-screen-recording"
    );
    const audioRecordingTooltip = document.querySelector(
      ".yy-tooltip-audio-recording"
    );
    const captureEditor = document.querySelector(".yy-capture-editor");
    const recordingClass = "yy-capture-editor-recording";
    const notRecordingClass = "yy-capture-editor-notrecording";
    if (this.screenRecorder.isRecording) {
      captureEditor.classList.add(recordingClass);
      captureEditor.classList.remove(notRecordingClass);
    } else {
      captureEditor.classList.add(notRecordingClass);
      captureEditor.classList.remove(recordingClass);
    }

    // Update UI.
    const dialog = document.querySelector(".yy-capture-toolbar");
    const videoPreviewContainer = document.querySelector(".yy-capture-preview");
    videoPreviewContainer.style.display = this.screenRecorder.file
      ? "flex"
      : "none";
    dialog.style.display = !this.screenRecorder.file ? "flex" : "none";

    for (var i = 0; i < toolbarItems.length; i++) {
      const toolbarItem = toolbarItems[i];
      const type = toolbarItem.getAttribute("data-type");
      switch (type) {
        case "mic":
          if (
            this.screenRecorder.audioAvailable &&
            this.screenRecorder.available
          ) {
            toolbarItem.classList.remove(itemInactiveClass);
            if (!this.screenRecorder.audioMuted) {
              toolbarItem.classList.remove(
                "yy-capture-toolbar-item--inactivecross"
              );
              audioRecordingTooltip.innerHTML =
                TranslationManager.translateText("mute");
            } else {
              toolbarItem.classList.add(
                "yy-capture-toolbar-item--inactivecross"
              );
              audioRecordingTooltip.innerHTML =
                TranslationManager.translateText("unmute");
            }
          } else {
            toolbarItem.classList.add(itemInactiveClass);
            toolbarItem.classList.add("yy-capture-toolbar-item--inactivecross");
            audioRecordingTooltip.innerHTML = TranslationManager.translateText(
              "browserNotSupported"
            );
          }
          break;

        case "recording":
          if (this.screenRecorder.available) {
            toolbarItem.classList.remove(itemInactiveClass);
            if (this.screenRecorder.isRecording) {
              toolbarItem.setAttribute("data-active", "true");
              screenRecordingTooltip.innerHTML =
                TranslationManager.translateText("stopRecording");
              timerLabel.style.display = "block";
            } else {
              toolbarItem.setAttribute("data-active", "false");
              screenRecordingTooltip.innerHTML =
                TranslationManager.translateText("startRecording");
              timerLabel.style.display = "none";
            }
          } else {
            // Recording is not available.
            toolbarItem.classList.add(itemInactiveClass);
            screenRecordingTooltip.innerHTML = TranslationManager.translateText(
              "browserNotSupported"
            );
          }
          break;

        default:
          break;
      }
    }
  }

  setupScreenRecording() {
    const self = this;

    // Hook preview next button
    const nextButtonPreview = document.querySelector(
      ".yy-capture-preview-sendbutton"
    );
    nextButtonPreview.onclick = this.showNextStep.bind(this);

    // Hook retry button
    const retryButton = document.querySelector(
      ".yy-capture-preview-retrybutton"
    );
    retryButton.onclick = function () {
      self.screenRecorder.clearPreview();
      if (self.screenDrawer) {
        self.screenDrawer.clear();
      }
    };

    // Setup screen recorder
    this.screenRecorder = new ScreenRecorder(
      this.captureRenderer.bind(this),
      TranslationManager.translateText("accessToScreenSharingDenied")
    );
  }
}
