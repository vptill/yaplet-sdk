import { startScreenCapture } from "./ScreenCapture";
import { ScreenRecorder } from "./ScreenRecorder";
import Yaplet, {
  ConsoleLogManager,
  StreamedEvent,
  Session,
  CustomDataManager,
  MetaDataManager,
  NetworkIntercepter,
  TagManager,
} from "./Yaplet";

export default class Feedback {
  excludeData = {};
  type = "BUG";
  priority = "LOW";
  customData = {};
  ticketAttributes = {};
  metaData = {};
  consoleLog = [];
  networkLogs = [];
  customEventLog = [];
  formData = {};
  isSilent = false;
  outboundId = undefined;
  screenshotData = undefined;
  webReplay = undefined;
  screenRecordingUrl = undefined;
  spamToken = undefined;

  constructor(
    type,
    priority,
    formData,
    isSilent,
    excludeData,
    outboundId,
    spamToken
  ) {
    this.type = type;
    this.priority = priority;
    this.formData = formData;
    this.isSilent = isSilent;
    this.excludeData = excludeData;
    this.outboundId = outboundId;
    this.spamToken = spamToken;
  }

  takeSnapshot() {
    const yapletInstance = Yaplet.getInstance();
    this.customData = CustomDataManager.getInstance().getCustomData();
    this.metaData = MetaDataManager.getInstance().getMetaData();
    this.consoleLog = ConsoleLogManager.getInstance().getLogs();
    this.networkLogs = NetworkIntercepter.getInstance().getRequests();
    this.customEventLog = StreamedEvent.getInstance().getEventArray();
    this.ticketAttributes =
      CustomDataManager.getInstance().getTicketAttributes();

    var dataPromises = [];

    // Assign replays
    var webReplay = yapletInstance.getGlobalDataItem("webReplay");
    if (webReplay !== null) {
      this.webReplay = webReplay;
    }

    // Prepare screen recording
    var screenRecordingData = yapletInstance.getGlobalDataItem(
      "screenRecordingData"
    );
    if (screenRecordingData != null) {
      var recordingUrlPromise = ScreenRecorder.uploadScreenRecording(
        screenRecordingData
      ).then((recordingUrl) => {
        if (recordingUrl) {
          this.screenRecordingUrl = recordingUrl;
        }
      });
      dataPromises.push(recordingUrlPromise);
    }

    // Prepare screenshot
    if (!(this.excludeData && this.excludeData.screenshot)) {
      var screenshotDataPromise = startScreenCapture(
        yapletInstance.isLiveMode()
      ).then((screenshotData) => {
        if (screenshotData) {
          const snapshotPosition =
            yapletInstance.getGlobalDataItem("snapshotPosition");
          screenshotData["x"] = snapshotPosition.x;
          screenshotData["y"] = snapshotPosition.y;
          this.screenshotData = screenshotData;
        }
      });
      dataPromises.push(screenshotDataPromise);
    }

    return Promise.all(dataPromises);
  }

  getData() {
    var feedbackData = {
      type: this.type,
      priority: this.priority,
      customData: this.customData,
      metaData: this.metaData,
      consoleLog: this.consoleLog,
      networkLogs: this.networkLogs,
      customEventLog: this.customEventLog,
      // Merge ticket attributes and form data.
      formData: {
        ...this.ticketAttributes,
        ...this.formData,
      },
      isSilent: this.isSilent,
      outbound: this.outboundId,
      screenshotData: this.screenshotData,
      webReplay: this.webReplay,
      screenRecordingUrl: this.screenRecordingUrl,
      spamToken: this.spamToken,
    };

    const tags = TagManager.getInstance().getTags();
    if (tags && tags.length > 0) {
      feedbackData.tags = tags;
    }

    if (this.excludeData) {
      const keysToExclude = Object.keys(this.excludeData);
      for (let i = 0; i < keysToExclude.length; i++) {
        const keyToExclude = keysToExclude[i];
        if (this.excludeData[keyToExclude] === true) {
          if (feedbackData[keyToExclude]) {
            delete feedbackData[keyToExclude];
          }

          if (keyToExclude === "screenshot") {
            delete feedbackData.screenshotData;
          }

          if (keyToExclude === "replays") {
            delete feedbackData.webReplay;
          }
        }
      }
    }

    return feedbackData;
  }

  getTicketData() {
    return new Promise((resolve, reject) => {
      this.takeSnapshot()
        .then(() => {
          const dataToSend = this.getData();
          resolve(dataToSend);
        })
        .catch((exp) => {
          console.log("Failed to take snapshot", exp);
          reject();
        });
    });
  }

  sendFeedback() {
    return new Promise((resolve, reject) => {
      this.takeSnapshot()
        .then(() => {
          const dataToSend = this.getData();

          const http = new XMLHttpRequest();
          http.open("POST", Session.getInstance().apiUrl + "/sdk/bugs");
          http.setRequestHeader(
            "Content-Type",
            "application/json;charset=UTF-8"
          );
          Session.getInstance().injectSession(http);
          http.onerror = (error) => {
            reject();
          };
          http.onreadystatechange = function (e) {
            if (http.readyState === 4) {
              if (http.status === 200 || http.status === 201) {
                try {
                  const feedback = JSON.parse(http.responseText);
                  resolve(feedback);
                } catch (exp) {
                  reject();
                }
              } else {
                reject();
              }
            }
          };
          http.send(JSON.stringify(dataToSend));
        })
        .catch((exp) => {
          console.log("Failed to take snapshot", exp);
          reject();
        });
    });
  }
}
