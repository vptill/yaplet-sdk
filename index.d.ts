export namespace Yaplet {
    function initialize(sdkKey: string): void;
    function sendSilentCrashReport(
      description: string,
      priority?: "LOW" | "MEDIUM" | "HIGH",
      excludeData?: {
        customData?: Boolean;
        metaData?: Boolean;
        attachments?: Boolean;
        consoleLog?: Boolean;
        networkLogs?: Boolean;
        customEventLog?: Boolean;
        screenshot?: Boolean;
        replays?: Boolean;
      }
    ): void;
    function sendSilentCrashReportWithFormData(
      formData: {
        [key: string]: string;
      },
      priority?: "LOW" | "MEDIUM" | "HIGH",
      excludeData?: {
        customData: Boolean;
        metaData: Boolean;
        attachments: Boolean;
        consoleLog: Boolean;
        networkLogs: Boolean;
        customEventLog: Boolean;
        screenshot: Boolean;
        replays: Boolean;
      }
    ): void;
    function startClassicForm(
      formId: string,
      showBackButton?: boolean
    ): void;
    function startBot(botId: string, showBackButton?: boolean): void;
    function startConversation(showBackButton?: boolean): void;
    function attachCustomData(customData: any): void;
    function setTicketAttribute(key: string, value: string): void;
    function setCustomData(key: string, value: string): void;
    function removeCustomData(key: string): void;
    function clearCustomData(): void;
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
      feedbackButtonIconColor?: string | null
    ): void;
    function disableConsoleLogOverwrite(): void;
    function enableShortcuts(enabled: boolean): void;
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
     * Note: `userHash` is reserved for server-side identity verification. It is
     * accepted but NOT yet enforced, so identity is currently trust-on-write —
     * safe for first-party use, not yet for verifying untrusted end users.
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
      userHash?: string
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