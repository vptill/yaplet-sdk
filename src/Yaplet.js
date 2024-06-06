import { injectStyledCSS } from "./UI";
import NetworkIntercepter from "./NetworkIntercepter";
import { dataParser, runFunctionWhenDomIsReady } from "./Helper";
import Session from "./Session";
import StreamedEvent from "./StreamedEvent";
import ConfigManager from "./ConfigManager";
import Feedback from "./Feedback";
import FrameManager from "./FrameManager";
import MetaDataManager from "./MetaDataManager";
import ConsoleLogManager from "./ConsoleLogManager";
import ClickListener from "./ClickListener";
import FeedbackButtonManager from "./FeedbackButtonManager";
import CustomDataManager from "./CustomDataManager";
import EventManager from "./EventManager";
import CustomActionManager from "./CustomActionManager";
import ReplayRecorder from "./ReplayRecorder";
import MarkerManager from "./MarkerManager";
import TranslationManager from "./TranslationManager";
import ShortcutListener from "./ShortcutListener";
import PreFillManager from "./PreFillManager";
import NotificationManager from "./NotificationManager";
import BannerManager from "./BannerManager";
import AudioManager from "./AudioManager";
import TagManager from "./TagManager";
import AdminManager from "./AdminManager";
import ProductTours from "./ProductTours";

if (
  typeof HTMLCanvasElement !== "undefined" &&
  HTMLCanvasElement.prototype &&
  HTMLCanvasElement.prototype.__originalGetContext === undefined
) {
  HTMLCanvasElement.prototype.__originalGetContext =
    HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    return this.__originalGetContext(type, {
      ...options,
      preserveDrawingBuffer: true,
    });
  };
}

class Yaplet {
  static invoked = true;
  static silentCrashReportSent = false;
  initialized = false;
  offlineMode = false;
  disablePageTracking = false;
  disableInAppNotifications = false;

  // Global data
  globalData = {
    screenRecordingData: null,
    webReplay: null,
    snapshotPosition: {
      x: 0,
      y: 0,
    },
  };

  // Yaplet singleton
  static instance;
  static getInstance() {
    if (!this.instance) {
      this.instance = new Yaplet();
      return this.instance;
    } else {
      return this.instance;
    }
  }

  /**
   * Main constructor
   */
  constructor() {
    if (typeof window !== "undefined") {
      // Make sure all instances are ready.
      MetaDataManager.getInstance();
      ConsoleLogManager.getInstance().start();
      ClickListener.getInstance().start();
      AdminManager.getInstance().start();
    }
  }

  /**
   * Sets the development environment
   * @param {*} environment
   */
  static setEnvironment(environment) {
    MetaDataManager.getInstance().environment = environment;
  }

  /**
   * Set tags to be submitted with each ticket.
   * @param {*} tags
   */
  static setTags(tags) {
    TagManager.getInstance().setTags(tags);
  }

  /**
   * Sets a custom URL handler.
   * @param {*} urlHandler
   */
  static setUrlHandler(urlHandler) {
    FrameManager.getInstance().setUrlHandler(urlHandler);
  }

  /**
   * Active the Yaplet offline mode.
   * @param {*} offlineMode
   */
  static setOfflineMode(offlineMode) {
    const instance = this.getInstance();
    instance.offlineMode = offlineMode;
  }

  /**
   * Disable the in-app notifications.
   * @param {*} disableInAppNotifications
   */
  static setDisableInAppNotifications(disableInAppNotifications) {
    const instance = this.getInstance();
    instance.disableInAppNotifications = disableInAppNotifications;
  }

  /**
   * Disable the default page tracking.
   * @param {*} disablePageTracking
   */
  static setDisablePageTracking(disablePageTracking) {
    const instance = this.getInstance();
    instance.disablePageTracking = disablePageTracking;
  }

  /**
   * Revert console log overwrite.
   */
  static disableConsoleLogOverwrite() {
    ConsoleLogManager.getInstance().stop();
  }

  /**
   * Set the AI tools.
   * @param {*} tools
   */
  static setAiTools(tools) {
    ConfigManager.getInstance().setAiTools(tools);
  }

  /**
   * Attaches external network logs.
   */
  static attachNetworkLogs(networkLogs) {
    NetworkIntercepter.getInstance().externalRequests = dataParser(networkLogs);
  }

  /**
   * Add entry to logs.
   * @param {*} message
   * @param {*} logLevel
   * @returns
   */
  static log(message, logLevel = "INFO") {
    ConsoleLogManager.getInstance().addLog(message, logLevel);
  }

  /**
   * Initializes the SDK
   * @param {*} sdkKey
   */
  static initialize(sdkKey) {
    const instance = this.getInstance();
    if (instance.initialized) {
      console.warn("Yaplet already initialized.");
      return;
    }
    instance.initialized = true;

    // Start session
    const sessionInstance = Session.getInstance();
    sessionInstance.sdkKey = sdkKey;
    sessionInstance.setOnSessionReady(() => {
      // Run auto configuration.
      setTimeout(() => {
        ConfigManager.getInstance()
          .start()
          .then(() => {
            StreamedEvent.getInstance().start();

            runFunctionWhenDomIsReady(() => {
              // Inject the widget buttons
              FeedbackButtonManager.getInstance().injectFeedbackButton();

              // Inject the notification container
              NotificationManager.getInstance().injectNotificationUI();

              // Check for URL params.
              Yaplet.checkForUrlParams();

              // Notify event.
              EventManager.notifyEvent("initialized");
            });
          })
          .catch(function (err) {
            console.warn("Failed to initialize Yaplet.", err);
          });
      }, 0);
    });
    sessionInstance.startSession();
  }

  static checkForUrlParams() {
    if (typeof window === "undefined" || !window.location.search) {
      return;
    }

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const feedbackFlow = urlParams.get("yaplet_feedback");
      if (feedbackFlow && feedbackFlow.length > 0) {
        Yaplet.startFeedbackFlow(feedbackFlow);
      }
      const surveyFlow = urlParams.get("yaplet_survey");
      const surveyFlowFormat = urlParams.get("yaplet_survey_format");
      if (surveyFlow && surveyFlow.length > 0) {
        Yaplet.showSurvey(
          surveyFlow,
          surveyFlowFormat === "survey_full" ? "survey_full" : "survey"
        );
      }
      const tourId = urlParams.get("yaplet_tour");
      if (tourId && tourId.length > 0) {
        var tourDelay = parseInt(urlParams.get("yaplet_tour_delay"));
        if (isNaN(tourDelay)) {
          tourDelay = 4;
        }

        setTimeout(() => {
          Yaplet.startProductTour(tourId);
        }, tourDelay * 1000);
      }
    } catch (exp) {}
  }

  /**
   * Destroy
   * @returns
   */
  static destroy() {
    ReplayRecorder.getInstance().stop();
    StreamedEvent.getInstance().stop();
    FrameManager.getInstance().destroy();
    FeedbackButtonManager.getInstance().toggleFeedbackButton(false);
    NotificationManager.getInstance().clearAllNotifications(true);
    Session.getInstance().clearSession(0, false);
    BannerManager.getInstance().removeBannerUI();
  }

  /**
   * Close any open banner.
   */
  static closeBanner() {
    BannerManager.getInstance().removeBannerUI();
  }

  /**
   * Enable or disable Yaplet session tracking through cookies.
   * @param {*} useCookies
   */
  static setUseCookies(useCookies) {
    Session.getInstance().useCookies = useCookies;
  }

  /**
   * Indentifies the user session
   * @param {string} userId
   * @param {*} userData
   */
  static identify(userId, userData, userHash) {
    return Session.getInstance().identifySession(
      userId,
      dataParser(userData),
      userHash
    );
  }

  /**
   * Updates the contact data.
   * @param {*} userData
   */
  static updateContact(userData) {
    return Session.getInstance().updateSession(dataParser(userData));
  }

  /**
   * Clears the current contact.
   */
  static clearIdentity() {
    Session.getInstance().clearSession();
  }

  /**
   * Returns the current user session
   */
  static getIdentity() {
    return Session.getInstance().getSession();
  }

  /**
   * Returns whether the user is identified or not.
   */
  static isUserIdentified() {
    const session = Session.getInstance().session;
    if (session && session.userId && session.userId.length > 0) {
      return true;
    }
    return false;
  }

  /**
   * Widget opened status
   * @returns {boolean} isOpened
   */
  static isOpened() {
    return FrameManager.getInstance().isOpened();
  }

  /**
   * Hides any open Yaplet dialogs.
   */
  static hide() {
    FrameManager.getInstance().hideWidget();
  }

  /**
   * Sets the maximum network request count.
   */
  static setMaxNetworkRequests(maxRequests) {
    NetworkIntercepter.getInstance().setMaxRequests(maxRequests);
  }

  /**
   * Sets the maximum network request count.
   */
  static startNetworkLogger() {
    NetworkIntercepter.getInstance().start();
  }

  /**
   * Sets the network logger blacklist.
   * @param {Array} networkLogBlacklist
   */
  static setNetworkLogsBlacklist(networkLogBlacklist) {
    NetworkIntercepter.getInstance().setBlacklist(networkLogBlacklist);
  }

  /**
   * Sets the network logger props to ignore.
   * @param {Array} filters
   */
  static setNetworkLogPropsToIgnore(filters) {
    NetworkIntercepter.getInstance().setFilters(filters);
  }

  /**
   * Set custom replay options.
   * @param {*} options
   */
  static setReplayOptions(options) {
    ReplayRecorder.getInstance().setOptions(options);
  }

  /**
   * Closes any open Yaplet dialogs.
   */
  static close() {
    FrameManager.getInstance().hideWidget();
  }

  /**
   * Starts the Yaplet flow.
   */
  static open() {
    FrameManager.getInstance().setAppMode("widget");
    FrameManager.getInstance().showWidget();
  }

  /**
   * Track a custom event
   * @param {string} name
   * @param {any} data
   */
  static trackEvent(name, data) {
    StreamedEvent.getInstance().logEvent(name, data);
  }

  /**
   * Logs a custom event
   * @param {string} name
   * @param {any} data
   * @deprecated Please use trackEvent instead.
   */
  static logEvent(name, data) {
    StreamedEvent.getInstance().logEvent(name, data);
  }

  /**
   * Prefills a specific form field.
   * @param {*} key
   * @param {*} value
   */
  static preFillForm(data) {
    const cleanedData = dataParser(data);
    PreFillManager.getInstance().formPreFill = cleanedData;
    FrameManager.getInstance().sendMessage(
      {
        name: "prefill-form-data",
        data: cleanedData,
      },
      true
    );
  }

  /**
   * Register events for Yaplet.
   * @param {*} eventName
   * @param {*} callback
   */
  static on(eventName, callback) {
    EventManager.on(eventName, callback);
  }

  /**
   * Enable or disable shortcuts
   * @param {boolean} enabled
   */
  static enableShortcuts(enabled) {
    if (enabled) {
      ShortcutListener.getInstance().start();
    } else {
      ShortcutListener.getInstance().stop();
    }
  }

  /**
   * Show or hide the feedback button
   * @param {*} show
   * @returns
   */
  static showFeedbackButton(show) {
    FeedbackButtonManager.getInstance().toggleFeedbackButton(show);
  }

  /**
   * Sets the app version code.
   * @param {string} appVersionCode
   */
  static setAppVersionCode(appVersionCode) {
    MetaDataManager.setAppVersionCode(appVersionCode);
  }

  /**
   * Sets the app version code.
   * @param {string} appVersionCode
   */
  static setAppBuildNumber(appBuildNumber) {
    MetaDataManager.setAppBuildNumber(appBuildNumber);
  }

  /**
   * Set a custom ws api url.
   * @param {string} wsApiUrl
   */
  static setWSApiUrl(wsApiUrl) {
    Session.getInstance().wsApiUrl = wsApiUrl;
  }

  /**
   * Set a custom api url.
   * @param {string} apiUrl
   */
  static setApiUrl(apiUrl) {
    Session.getInstance().apiUrl = apiUrl;
  }

  /**
   * Set a custom banner url.
   * @param {string} bannerUrl
   */
  static setBannerUrl(bannerUrl) {
    BannerManager.getInstance().setBannerUrl(bannerUrl);
  }

  /**
   * Set a custom frame api url.
   * @param {string} frameUrl
   */
  static setFrameUrl(frameUrl) {
    FrameManager.getInstance().frameUrl = frameUrl;
  }

  /**
   * This method is used to set ticket attributes programmatically.
   * @param {*} key The key of the attribute you want to add.
   * @param {*} value The value to set.
   */
  static setTicketAttribute(key, value) {
    CustomDataManager.getInstance().setTicketAttribute(key, value);
  }

  /**
   * Set custom data that will be attached to the bug-report.
   * @param {*} data
   */
  static attachCustomData(data) {
    CustomDataManager.getInstance().attachCustomData(data);
  }

  /**
   * Add one key value pair to the custom data object
   * @param {*} key The key of the custom data entry you want to add.
   * @param {*} value The custom data you want to add.
   */
  static setCustomData(key, value) {
    CustomDataManager.getInstance().setCustomData(key, value);
  }

  /**
   * Remove one key value pair of the custom data object
   * @param {*} key The key of the custom data entry you want to remove.
   */
  static removeCustomData(key) {
    CustomDataManager.getInstance().removeCustomData(key);
  }

  /**
   * Clear the custom data
   */
  static clearCustomData() {
    CustomDataManager.getInstance().clearCustomData();
  }

  /**
   * Play or mute the sound.
   * @param {*} play
   */
  static playSound(play) {
    AudioManager.playSound(play);
  }

  /**
   * Show or hide the notification badge count.
   * @param {boolean} showNotificationBadge show or hide the notification badge
   *
   */
  static showTabNotificationBadge(showNotificationBadge) {
    const notificationInstance = NotificationManager.getInstance();
    notificationInstance.showNotificationBadge = showNotificationBadge;
    notificationInstance.updateTabBarNotificationCount();
  }

  /**
   * Override the browser language.
   * @param {string} language country code with two letters
   */
  static setLanguage(language) {
    TranslationManager.getInstance().setOverrideLanguage(language);

    if (Yaplet.getInstance().initialized) {
      setTimeout(() => {
        Yaplet.getInstance().softReInitialize();

        // Update language for contact.
        Yaplet.updateContact({
          lang: language,
        });
      }, 1000);
    }
  }

  /**
   * Register custom action
   * @param {*} action
   */
  static registerCustomAction(customAction) {
    CustomActionManager.registerCustomAction(customAction);
  }

  /**
   * Triggers a custom action
   * @param {*} actionName
   */
  static triggerCustomAction(name) {
    CustomActionManager.triggerCustomAction(name);
  }

  /**
   * Sets a custom color scheme.
   * @param {string} primaryColor
   */
  static setStyles(
    primaryColor,
    headerColor,
    buttonColor,
    backgroundColor = "#ffffff",
    borderRadius = 20,
    buttonX = 20,
    buttonY = 20,
    buttonStyle = FeedbackButtonManager.FEEDBACK_BUTTON_BOTTOM_LEFT,
    zIndexBase = 2147483600
  ) {
    runFunctionWhenDomIsReady(() => {
      injectStyledCSS(
        primaryColor,
        headerColor,
        buttonColor,
        borderRadius,
        backgroundColor,
        buttonX,
        buttonY,
        buttonStyle,
        zIndexBase
      );
    });
  }

  /**
   * Sends a silent feedback report
   * @param {*} formData
   * @param {*} priority
   * @param {*} excludeData
   */
  static sendSilentCrashReport(
    description = "",
    priority = "MEDIUM",
    excludeData = {
      screenshot: true,
      replays: true,
      attachments: true,
    }
  ) {
    return Yaplet.sendSilentCrashReportWithFormData(
      {
        description,
      },
      priority,
      excludeData
    );
  }

  /**
   * Sends a silent feedback report
   * @param {*} formData
   * @param {*} priority
   * @param {*} excludeData
   */
  static sendSilentCrashReportWithFormData(
    formData,
    priority = "MEDIUM",
    excludeData = {
      screenshot: false,
      replays: false,
      attachments: true,
    }
  ) {
    if (this.silentCrashReportSent) {
      return;
    }

    this.silentCrashReportSent = true;
    setTimeout(() => {
      this.silentCrashReportSent = false;
    }, 10000);

    const excludeDataCleaned = excludeData ? dataParser(excludeData) : {};
    const sessionInstance = Session.getInstance();
    if (!sessionInstance.ready) {
      return;
    }

    var newFormData = formData ? formData : {};
    if (sessionInstance.session.email) {
      newFormData.reportedBy = sessionInstance.session.email;
    }

    const feedback = new Feedback(
      "CRASH",
      priority,
      newFormData,
      true,
      excludeDataCleaned
    );
    feedback
      .sendFeedback()
      .then(() => {})
      .catch((error) => {});
  }

  /**
   * Shows a survey manually.
   * @param {*} actionType
   * @param {*} format
   */
  static showSurvey(actionType, format = "survey") {
    Yaplet.startFeedbackFlowWithOptions(
      actionType,
      {
        hideBackButton: true,
        format,
      },
      true
    );
  }

  /**
   * Starts a classic feedback form.
   */
  static startClassicForm(formId, showBackButton) {
    Yaplet.startFeedbackFlowWithOptions(formId, {
      hideBackButton: !showBackButton,
    });
  }

  /**
   * Starts the bug reporting flow.
   */
  static startFeedbackFlow(feedbackFlow, showBackButton) {
    Yaplet.startFeedbackFlowWithOptions(feedbackFlow, {
      hideBackButton: !showBackButton,
    });
  }

  /**
   * Starts the bug reporting flow.
   */
  static startFeedbackFlowWithOptions(
    feedbackFlow,
    options = {},
    isSurvey = false
  ) {
    const { autostartDrawing, hideBackButton, format } = options;
    const sessionInstance = Session.getInstance();
    if (!sessionInstance.ready) {
      return;
    }

    // Initially set scroll position
    Yaplet.getInstance().setGlobalDataItem("snapshotPosition", {
      x: window.scrollX,
      y: window.scrollY,
    });

    var action = "start-feedbackflow";
    if (isSurvey) {
      action = "start-survey";
    }

    FrameManager.getInstance().setAppMode(isSurvey ? format : "widget");

    FrameManager.getInstance().sendMessage(
      {
        name: action,
        data: {
          flow: feedbackFlow,
          hideBackButton: hideBackButton,
          format,
        },
      },
      true
    );

    if (autostartDrawing) {
      FrameManager.getInstance().showDrawingScreen("screenshot");
    } else {
      FrameManager.getInstance().showWidget();
    }
  }

  /**
   * Opens the conversations overview.
   */
  static openConversations(showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-conversations",
        data: {
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens a conversation
   */
  static openConversation(shareToken, showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-conversation",
        data: {
          shareToken,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Starts a new conversation
   */
  static startConversation(showBackButton = true) {
    Yaplet.startBot("", showBackButton);
  }

  /**
   * Starts a new conversation and attaches the bot with the given id.
   */
  static startBot(botId, showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");
    FrameManager.getInstance().sendMessage(
      {
        name: "start-bot",
        data: {
          botId: botId ? botId : "",
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens a help center collection
   */
  static openHelpCenterCollection(collectionId, showBackButton = true) {
    if (!collectionId) {
      return;
    }

    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-help-collection",
        data: {
          collectionId,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens a help article
   */
  static openHelpCenterArticle(articleId, showBackButton = true) {
    if (!articleId) {
      return;
    }

    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-help-article",
        data: {
          articleId,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens the help center.
   */
  static openHelpCenter(showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-helpcenter",
        data: {
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Search for news articles in the help center
   */
  static searchHelpCenter(term, showBackButton = true) {
    if (!term) {
      return;
    }

    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-helpcenter-search",
        data: {
          term,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens a news article
   */
  static openNewsArticle(id, showBackButton = true) {
    if (!id) {
      return;
    }

    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-news-article",
        data: {
          id,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Open the checklists overview.
   */
  static openChecklists(showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-checklists",
        data: {
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Starts a new checklist and opens it.
   */
  static startChecklist(outboundId, showBackButton = true) {
    if (!outboundId) {
      return false;
    }

    FrameManager.getInstance().setAppMode("widget");
    FrameManager.getInstance().sendMessage(
      {
        name: "start-checklist",
        data: {
          outboundId: outboundId,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();

    return true;
  }

  /**
   * Open an existing checklist.
   */
  static openChecklist(checklistId, showBackButton = true) {
    if (!checklistId) {
      return;
    }

    FrameManager.getInstance().setAppMode("widget");
    FrameManager.getInstance().sendMessage(
      {
        name: "open-checklist",
        data: {
          id: checklistId,
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens the news overview.
   */
  static openNews(showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-news",
        data: {
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  /**
   * Opens the feature requests overview.
   */
  static openFeatureRequests(showBackButton = true) {
    FrameManager.getInstance().setAppMode("widget");

    FrameManager.getInstance().sendMessage(
      {
        name: "open-feature-requests",
        data: {
          hideBackButton: !showBackButton,
        },
      },
      true
    );

    FrameManager.getInstance().showWidget();
  }

  static setFlowConfig(flowConfig) {
    ConfigManager.getInstance().setFlowConfig(flowConfig);
  }

  isLiveMode() {
    if (this.offlineMode === true) {
      return false;
    }

    var hostname = window.location.hostname;
    const isLocalHost =
      ["localhost", "127.0.0.1", "0.0.0.0", "", "::1"].includes(hostname) ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.0.") ||
      hostname.endsWith(".local") ||
      !hostname.includes(".");
    return !isLocalHost;
  }

  softReInitialize() {
    FrameManager.getInstance().destroy();
    ConfigManager.getInstance()
      .start()
      .then(() => {
        // Update the feedback button.
        FeedbackButtonManager.getInstance().refresh();

        // Inject the notification container
        NotificationManager.getInstance().injectNotificationUI();
      })
      .catch(function (err) {
        console.warn("Failed to initialize Yaplet.");
      });
  }

  /**
   * Performs an action.
   * @param {*} action
   */
  performActions(actions) {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log("Performing action", action);
      if (action && action.event) {
        if (action.event === "NEW_MESSAGE" || action.event === "message") {
          if (!this.disableInAppNotifications) {
            Yaplet.showNotification(action);
          }
        } else if (action.event === "banner") {
          Yaplet.showBanner(action.payload.data);
        } else if (action.event === "tour") {
          Yaplet.startProductTourWithConfig(action.outbound, action.data);
        } else if (action.event === "survey") {
          Yaplet.showSurvey(action.payload.data.action.flow, "survey");
        }
      }
    }
  }

  static startProductTour(tourId) {
    const self = this;
    Session.getInstance()
      .startProductTourConfig(tourId)
      .then((config) => {
        self.startProductTourWithConfig(tourId, config);
      })
      .catch((error) => {});
  }

  static startProductTourWithConfig(tourId, config) {
    ProductTours.getInstance().startWithConfig(tourId, config, (data) => {
      const comData = {
        tourId: data.tourId,
      };

      EventManager.notifyEvent("productTourCompleted", comData);
      Yaplet.trackEvent(`tour-${data.tourId}-completed`, comData);
    });
  }

  static showBanner(data) {
    try {
      BannerManager.getInstance().showBanner(data);
    } catch (e) {}
  }

  static showNotification(data) {
    NotificationManager.getInstance().showNotification(data);
  }

  /**
   * Sets a global data value
   * @param {*} key
   * @param {*} value
   */
  setGlobalDataItem(key, value) {
    this.globalData[key] = value;
  }

  /**
   * Gets a global data value
   * @param {*} key
   * @returns
   */
  getGlobalDataItem(key) {
    return this.globalData[key];
  }

  /**
   * Takes the current replay and assigns it to the global data array.
   */
  takeCurrentReplay() {
    const replayData = ReplayRecorder.getInstance().getReplayData();
    this.setGlobalDataItem("webReplay", replayData);
  }
}

// Check for unperformed Yaplet actions.
if (typeof window !== "undefined") {
  const YapletActions = window.YapletActions;
  if (YapletActions && YapletActions.length > 0) {
    for (var i = 0; i < YapletActions.length; i++) {
      const GLAction = YapletActions[i];
      if (GLAction && GLAction.e && Yaplet[GLAction.e]) {
        Yaplet[GLAction.e].apply(Yaplet, GLAction.a);
      }
    }
  }
}

const handleYapletLink = (href) => {
  try {
    const urlParts = href.split("/");
    const type = urlParts[2];
    if (type === "article") {
      const identifier = urlParts[3];
      Yaplet.openHelpCenterArticle(identifier, true);
    }

    if (type === "collection") {
      const identifier = urlParts[3];
      Yaplet.openHelpCenterCollection(identifier, true);
    }

    if (type === "flow") {
      const identifier = urlParts[3];
      Yaplet.startFeedbackFlow(identifier, true);
    }

    if (type === "survey") {
      const identifier = urlParts[3];
      Yaplet.showSurvey(identifier);
    }

    if (type === "bot") {
      const identifier = urlParts[3];
      Yaplet.startBot(identifier, true);
    }

    if (type === "news") {
      const identifier = urlParts[3];
      Yaplet.openNewsArticle(identifier, true);
    }

    if (type === "checklist") {
      const identifier = urlParts[3];
      Yaplet.startChecklist(identifier, true);
    }

    if (type === "tour") {
      const identifier = urlParts[3];
      Yaplet.startProductTour(identifier);
    }
  } catch (e) {
    console.error("Failed to handle Yaplet link: ", href);
  }
};

export {
  NetworkIntercepter,
  AudioManager,
  NotificationManager,
  BannerManager,
  PreFillManager,
  ShortcutListener,
  MarkerManager,
  TranslationManager,
  ReplayRecorder,
  Feedback,
  ConsoleLogManager,
  CustomActionManager,
  EventManager,
  CustomDataManager,
  FeedbackButtonManager,
  ClickListener,
  Session,
  StreamedEvent,
  ConfigManager,
  FrameManager,
  MetaDataManager,
  TagManager,
  handleYapletLink,
};
export default Yaplet;
