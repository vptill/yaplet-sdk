import { loadFromYapletCache, saveToYapletCache } from "./Helper";
import Yaplet, {
  FrameManager,
  FeedbackButtonManager,
  TranslationManager,
  NetworkIntercepter,
  Session,
  ReplayRecorder,
  NotificationManager,
} from "./Yaplet";

const parseIntWithDefault = (val, def) => {
  const parsed = parseInt(val);
  if (isNaN(parsed)) {
    return def;
  }
  return parsed;
};

export default class ConfigManager {
  flowConfig = null;
  flowConfigOverride = {};
  projectActions = null;
  onConfigLoadedListener = [];
  aiTools = [];

  onConfigLoaded = (onConfigLoaded) => {
    if (this.flowConfig !== null) {
      onConfigLoaded();
    } else {
      this.onConfigLoadedListener.push(onConfigLoaded);
    }
  };

  // ConfigManager singleton
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new ConfigManager();
    }
    return this.instance;
  }

  /**
   * Returns the loaded flow config.
   * @returns
   */
  getFlowConfig() {
    return this.flowConfig;
  }

  setFlowConfig(flowConfig) {
    this.flowConfigOverride = { ...flowConfig };
    this.applyStylesFromConfig();
    FeedbackButtonManager.getInstance().refresh();
    NotificationManager.getInstance().updateContainerStyle();
  }

  setAiTools = (aiTools) => {
    this.aiTools = aiTools;
  };

  getAiTools = () => {
    return this.aiTools;
  };

  /**
   * Load config.
   * @returns {string}
   */
  start = () => {
    if (this.flowConfig) {
      return Promise.resolve();
    }
    const session = Session.getInstance();
    const cachedConfig = loadFromYapletCache(
      `config-${session.sdkKey
      }-${TranslationManager.getInstance().getActiveLanguage()}`
    );
    if (cachedConfig) {
      this.applyConfig(cachedConfig);
      return Promise.resolve();
    }

    return this.loadConfigFromServer();
  };

  loadConfigFromServer = () => {
    const self = this;
    return new Promise(function (resolve, reject) {
      const session = Session.getInstance();
      const http = new XMLHttpRequest();
      const lang = TranslationManager.getInstance().getActiveLanguage();
      http.open("GET", session.apiUrl + "/sdk/config");
      http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      session.injectSession(http);
      http.onerror = function () {
        reject();
      };
      http.onreadystatechange = function (e) {
        if (http.readyState === 4) {
          if (http.status === 200 || http.status === 201) {
            try {
              const config = JSON.parse(http.responseText);
              try {
                saveToYapletCache(`config-${session.sdkKey}-${lang}`, config);
              } catch (exp) { }
              self.applyConfig(config);
              return resolve();
            } catch (e) { }
          }
          reject();
        }
      };
      http.send();
    });
  };

  applyStylesFromConfig() {
    const flowConfig = { ...this.flowConfig, ...this.flowConfigOverride };

    Yaplet.setStyles(
      flowConfig.primaryColor ? flowConfig.primaryColor : "#485BFF",
      flowConfig.headerColor ? flowConfig.headerColor : "#485BFF",
      flowConfig.primaryColor ? flowConfig.primaryColor : "#485BFF",
      flowConfig.backgroundColor ? flowConfig.backgroundColor : "#FFFFFF",
      parseIntWithDefault(flowConfig.borderRadius, 20),
      parseIntWithDefault(flowConfig.buttonX, 20),
      parseIntWithDefault(flowConfig.buttonY, 20),
      flowConfig.feedbackButtonPosition,
      flowConfig.zIndexBase || 2147483600
    );

    FeedbackButtonManager.getInstance().updateFeedbackButtonState();
    NotificationManager.getInstance().updateContainerStyle();
  }

  notifyConfigLoaded() {
    if (this.onConfigLoadedListener.length > 0) {
      for (var i = 0; i < this.onConfigLoadedListener.length; i++) {
        this.onConfigLoadedListener[i]();
      }
    }
    this.onConfigLoadedListener = [];
  }

  /**
   * Applies the Yaplet config.
   * @param {*} config
   */
  applyConfig(config) {
    try {
      const flowConfig = { ...config.flowConfig, ...this.flowConfigOverride };
      this.flowConfig = flowConfig;

      // Update styles.
      this.applyStylesFromConfig();

      // Send config update.
      FrameManager.getInstance().sendConfigUpdate();
      FeedbackButtonManager.getInstance().updateFeedbackButtonState();
      NotificationManager.getInstance().updateContainerStyle();

      if (flowConfig.enableWebReplays) {
        ReplayRecorder.getInstance().start();
      } else {
        ReplayRecorder.getInstance().stop();
      }

      if (flowConfig.enableNetworkLogs) {
        NetworkIntercepter.getInstance().start();
      }

      NetworkIntercepter.getInstance().setLoadAllResources(
        flowConfig.sendNetworkResources ? true : false
      );

      if (flowConfig.networkLogPropsToIgnore) {
        NetworkIntercepter.getInstance().setFilters(
          flowConfig.networkLogPropsToIgnore
        );
      }

      if (flowConfig.networkLogBlacklist) {
        NetworkIntercepter.getInstance().setBlacklist(
          flowConfig.networkLogBlacklist
        );
      }

      TranslationManager.getInstance().updateRTLSupport();

      Yaplet.enableShortcuts(flowConfig.enableShortcuts ? true : false);

      this.notifyConfigLoaded();
    } catch (e) { }
  }
}
