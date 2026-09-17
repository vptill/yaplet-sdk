export namespace Yaplet {
    function initialize(sdkKey: string): void;
    function startClassicForm(
      formId: string,
      showBackButton?: boolean
    ): void;
    function startBot(botId: string, showBackButton?: boolean): void;
    function startConversation(showBackButton?: boolean): void;
    // attachCustomData / setCustomData / removeCustomData / clearCustomData and
    // sendSilentCrashReport / sendSilentCrashReportWithFormData were retired 2026-08-13
    // (owner decision) - see the notes in src/Yaplet.js. setTicketAttribute below is the
    // one custom-data path that actually reaches the ticket. Do not re-declare the retired
    // names here unless they come back in the bundle: `npm test` fails on declarations
    // that do not exist at runtime.
    function setTicketAttribute(key: string, value: string): void;
    function playSound(play: boolean): void;
    function destroy(): void;
    function isOpened(): boolean;
    function setApiUrl(apiUrl: string): void;
    function setWSApiUrl(wsApiUrl: string): void;
    function setFrameUrl(frameUrl: string): void;
    function setAdminUrl(builderUrl: string): void;
    function closeBanner(): void;
    function setBannerUrl(bannerUrl: string): void;
    function setMaxNetworkRequests(maxRequests: number): void;
    function startNetworkLogger(): void;
    function setNetworkLogsBlacklist(networkLogBlacklist: string[]): void;
    function setNetworkLogPropsToIgnore(filters: string[]): void;
    function registerCustomAction(
      customAction: (action: { name: string }) => void
    ): void;
    function triggerCustomAction(name: string): void;
    function log(message: string, logLevel?: "INFO" | "WARNING" | "ERROR"): void;
    /**
     * @deprecated Please use trackEvent instead.
     */
    function logEvent(name: string, data?: any): void;
    function trackEvent(name: string, data?: any): void;
    function setAppBuildNumber(buildNumber: string): void;
    function setAppVersionCode(versionCode: string): void;
    function setStyles(
      primaryColor: string,
      headerColor: string,
      buttonColor: string,
      backgroundColor?: string,
      borderRadius?: number,
      buttonX?: number,
      buttonY?: number,
      buttonStyle?: string,
      zIndexBase?: number,
      feedbackButtonGradient?: { colors: string[]; angle: number } | null,
      feedbackButtonIconColor?: string | null,
      /**
       * The widget's Home background — what the loading skin is painted with while the widget
       * boots. One colour is a flat paint, more is a gradient. Omitted: the skin falls back to
       * a header band over `backgroundColor`.
       */
      heroBackground?: { colors: string[]; angle: number } | null,
      /** The text colour readable on `heroBackground`; the spinner uses it when the brand colour would not show. */
      heroTextColor?: string | null,
      /**
       * The launcher bubble's corner in px, on a 48px box (24 = a circle). Computed by the server
       * from the widget's corner preset. Omitted or null: the bubble stays a circle.
       */
      launcherRadius?: number | null,
      /**
       * The highlight ring's color: a thin line that travels clockwise around the launcher's rim.
       * Computed by the server from the launcher's own settings. Omitted or null: no ring at all.
       */
      launcherRing?: string | null
    ): void;
    function disableConsoleLogOverwrite(): void;
    function enableShortcuts(enabled: boolean): void;
    /**
     * Sets the language Yaplet speaks to this user in.
     *
     * As well as the SDK's own texts, this now also switches the CHAT WIDGET's language:
     * its whole interface, the status lines inside a conversation, and the greeting,
     * cards and buttons the widget's owner has translated. The widget speaks 38
     * languages: "en", "de", "fr", "es", "zh", "pt", "it", "nl", "ja", "hi", "sv", "da",
     * "hu", "pl", "cs", "fi", "ru", "tr", "id", "no", "sk", "hr", "bg", "ko", "th", "vi",
     * "ro", "el", "uk", "ms", "fil", "et", "ga", "lv", "lt", "mt", "sl" and "sr". Only the
     * language part of a tag matters, so "hu" and "hu-HU" are the same request, and so are
     * "fil" and "fil-PH" (Filipino keeps all three letters). A few other tags are read as
     * the language they name: "nb" and "nn" as Norwegian ("no"), "tl" as Filipino, "in" as
     * Indonesian. Chinese is Simplified ("zh-TW" also gets it) and Serbian is written in
     * Latin script. A language the widget does not speak leaves it in the brand's own
     * language rather than falling back to English.
     *
     * A visitor who picks a language themselves in the widget's language selector keeps
     * that choice: it outranks this call.
     *
     * @param language language code or BCP-47 tag, e.g. "hu", "hu-HU" or "fil"
     */
    function setLanguage(language: string): void;
    function setAiTools(tools: {
      name: string;
      description: string;
      executionType?: 'button' | 'auto';
      response?: string;
      parameters: {
        name: string;
        description: string;
        type: "string" | "number" | "boolean";
        required: boolean;
        enums?: string[];
      }[];
    }[]): void;
    function showTabNotificationBadge(showNotificationBadge: boolean): void;
    function attachNetworkLogs(networkLogs: string): void;
    function clearIdentity(): void;
    function setTags(tags: string[]): void;
    function setOfflineMode(offlineMode: boolean): void;
    function setDisableInAppNotifications(
      disableInAppNotifications: boolean
    ): void;
    function setDisablePageTracking(
      disablePageTracking: boolean
    ): void;
    /**
     * Attaches a known identity to the current widget visitor record.
     *
     * Field persistence (server `/sdk/identify`):
     *  - `name`, `email`, `phone`, `value`, `plan` → dedicated visitor columns.
     *  - `userId` → stored as the visitor's `external_id` (the stable key that
     *    links a widget visitor back to your own user account — set this).
     *  - `companyId`, `companyName`, `sla`, `createdAt` and anything under
     *    `customData` → folded into the visitor's `custom_data` (shown to agents).
     *
     * `userHash` is REQUIRED: an HMAC-SHA256 of `userId`, hex encoded, computed
     * on YOUR server with the widget's identity secret (Yaplet dashboard →
     * Widgets → your widget → Embed → Identity verification). Calls without a
     * valid hash are rejected with a 401 (logged to the console as
     * "[Yaplet] identify() was rejected") and the visitor stays anonymous.
     * Never compute it in the browser — the secret would ship to every visitor.
     */
    function identify(
      userId: string,
      customerData: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        value?: number | null;
        companyId?: string | null;
        companyName?: string | null;
        sla?: number | null;
        plan?: string | null;
        customData?: object | null;
        createdAt?: Date | null;
      },
      userHash: string
    ): void;
    /**
     * Updates contact data for the current session without a userId.
     *
     * Note: the server `/sdk/sessions` endpoint does not currently persist these
     * contact fields to the visitor record (only session/language state is
     * updated). To reliably store visitor details, use `identify()`.
     */
    function updateContact(
      customerData: {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        value?: number | null;
        companyId?: string | null;
        companyName?: string | null;
        sla?: number | null;
        plan?: string | null;
        customData?: object | null;
      }
    ): void;
    function getInstance(): any;
    function open(): void;
    function openNewsArticle(id: string, showBackButton?: boolean): void;
    function startProductTour(tourId: string): void;
    function checkForTourResume(): void;
    function startProductTourWithConfig(tourId: string, config: any, resumeStepIndex?: number): void;
    function openConversation(
      shareToken?: string,
      showBackButton?: boolean
    ): void;
    function setUrlHandler(
      urlHandler: (url: string, newTab?: boolean) => void
    ): void;
    function openHelpCenterCollection(
      collectionId: string,
      showBackButton?: boolean
    ): void;
    function openHelpCenterArticle(
      articleId: string,
      showBackButton?: boolean
    ): void;
    function showBanner(data: any): void;
    function showNotification(data: any): void;
    function checkForUrlParams(): void;
    function close(): void;
    function hide(): void;
    function setUseCookies(useCookies: boolean): void;
    function setEnvironment(environment: "dev" | "staging" | "prod"): void;
    function showFeedbackButton(show: boolean): void;
    function startFeedbackFlow(
      feedbackFlow: string,
      showBackButton?: boolean
    ): void;
    function startFeedbackFlowWithOptions(
      id: string,
      options?: {
        autostartDrawing?: boolean;
        hideBackButton?: boolean;
        format?: string;
      },
      isSurvey?: boolean
    ): void;
    function setFlowConfig(flowConfig: any): void;
    function showSurvey(surveyId: string, format?: string): void;
    function on(event: string, callback: (data?: any) => void): void;
    function getIdentity(): any;
    function isUserIdentified(): boolean;
    function setReplayOptions(options: {
      blockClass?: string | RegExp;
      blockSelector?: string;
      ignoreClass?: string | RegExp;
      ignoreSelector?: string;
      ignoreCSSAttributes?: string[];
      maskTextClass?: string | RegExp;
      maskTextSelector?: string;
      maskAllInputs?: boolean;
      maskInputOptions?: {
        password?: boolean;
        [key: string]: any;
      };
      maskInputFn?: (text: string) => string;
      maskTextFn?: (text: string) => string;
      slimDOMOptions?: {
        [key: string]: any;
      };
      dataURLOptions?: {
        [key: string]: any;
      };
      hooks?: {
        [key: string]: any;
      };
      packFn?: (events: any) => any;
      sampling?: any;
      recordCanvas?: boolean;
      recordCrossOriginIframes?: boolean;
      recordAfter?: 'DOMContentLoaded' | 'load';
      inlineImages?: boolean;
      collectFonts?: boolean;
      userTriggeredOnInput?: boolean;
      plugins?: {
        [key: string]: any;
      }[];
      errorHandler?: (error: Error) => void;
    }): void;
  }
  export default Yaplet;