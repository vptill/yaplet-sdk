import Yaplet, {
	StreamedEvent,
	AudioManager,
	NotificationManager,
	CustomActionManager,
	EventManager,
	MarkerManager,
	Feedback,
	FeedbackButtonManager,
	TranslationManager,
	Session,
	ConfigManager,
	CustomDataManager,
	MetaDataManager,
	ConsoleLogManager,
	NetworkIntercepter,
	TagManager,
	BannerManager,
} from "./Yaplet";
import { widgetMaxHeight } from "./UI";
import { runFunctionWhenDomIsReady } from "./Helper";

export default class FrameManager {
	frameUrl = "https://embed.yaplet.com";
	yapletFrameContainer = null;
	yapletFrame = null;
	comReady = false;
	injectedFrame = false;
	widgetOpened = false;
	listeners = [];
	appMode = "widget";
	markerManager = undefined;
	escListener = undefined;
	frameHeight = 0;
	queue = [];
	urlHandler = function (url, newTab) {
		if (url && url.length > 0) {
			// Basic protocol validation to prevent javascript: or data: URIs
			const lowerUrl = url.toLowerCase().trim();
			if (
				!lowerUrl.startsWith("http://") &&
				!lowerUrl.startsWith("https://") &&
				!lowerUrl.startsWith("/") &&
				!lowerUrl.startsWith("./") &&
				!lowerUrl.startsWith("../")
			) {
				console.warn("Yaplet: Blocked potentially unsafe URL:", url);
				return;
			}

			if (newTab) {
				const newWindow = window.open(url, "_blank");

				// Check if the new window was successfully created and not blocked
				if (
					!newWindow ||
					newWindow.closed ||
					typeof newWindow.closed === "undefined"
				) {
					// If the new window was blocked, navigate in the same tab instead
					window.location.href = url;
				} else {
					// If the new window was created successfully, bring it into focus
					newWindow.focus();
				}
			} else {
				window.location.href = url;
			}
		}
	};

	// FrameManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new FrameManager();
		}
		return this.instance;
	}

	constructor() {
		this.startCommunication();
		if (typeof window !== "undefined") {
			function appHeight() {
				try {
					const doc = document.documentElement;
					doc.style.setProperty("--glvh", window.innerHeight * 0.01 + "px");
				} catch (e) { }
			}

			try {
				window.addEventListener("resize", appHeight);
				appHeight();
			} catch (e) { }
		}
	}

	setUrlHandler(handler) {
		this.urlHandler = handler;
	}

	isSurvey() {
		return (
			this.appMode === "survey" ||
			this.appMode === "survey_full" ||
			this.appMode === "survey_web"
		);
	}

	setAppMode(appMode) {
		this.appMode = appMode;
		this.updateFrameStyle();

		const innerContainer = document.querySelector(
			".yaplet-frame-container-inner"
		);
		if (
			(this.appMode === "widget" ||
				this.appMode === "survey_full" ||
				this.appMode === "survey_web") &&
			innerContainer
		) {
			innerContainer.style.maxHeight = `${widgetMaxHeight}px`;
		}
	}

	registerEscListener() {
		if (this.escListener) {
			return;
		}

		this.escListener = (evt) => {
			evt = evt || window.event;
			if (evt.key === "Escape") {
				this.hideWidget();
			}
		};
		document.addEventListener("keydown", this.escListener);
	}

	unregisterEscListener() {
		if (this.escListener) {
			document.removeEventListener("keydown", this.escListener);
			this.escListener = null;
		}
	}

	destroy() {
		if (this.yapletFrame) {
			this.yapletFrame.remove();
		}
		if (this.yapletFrameContainer) {
			this.yapletFrameContainer.remove();
		}
		this.injectedFrame = false;
		this.widgetOpened = false;
		this.markerManager = undefined;
		this.yapletFrameContainer = null;
		this.yapletFrame = null;
	}

	isOpened() {
		return this.widgetOpened || this.markerManager != null;
	}

	autoWhiteListCookieManager = () => {
		if (window && window.cmp_block_ignoredomains) {
			window.cmp_block_ignoredomains.concat(["yaplet.com"]);
		}
	};

	injectFrame = () => {
		if (this.injectedFrame) {
			return;
		}
		this.injectedFrame = true;

		this.autoWhiteListCookieManager();

		// Inject the frame manager after it has been loaded.
		runFunctionWhenDomIsReady(() => {
			ConfigManager.getInstance().onConfigLoaded(() => {
				// Apply CSS.
				ConfigManager.getInstance().applyStylesFromConfig();

				// Inject widget HTML.
				var elem = document.createElement("div");
				elem.className =
					"yaplet-frame-container yaplet-frame-container--hidden gl-block";
				elem.innerHTML = `<div class="yaplet-frame-container-inner"><iframe src="${this.frameUrl +
					"/widget/" +
					Session.getInstance().sdkKey +
					"?access_token=" +
					Session.getInstance().session.yapletHash
					}" class="yaplet-frame" scrolling="yes" title="Yaplet Widget Window" allow="autoplay; encrypted-media; fullscreen;" frameborder="0"></iframe></div>`;
				document.body.appendChild(elem);

				this.yapletFrameContainer = elem;
				this.yapletFrame = document.querySelector(".yaplet-frame");

				this.updateFrameStyle();

				// Show loading preview for widget app mode.
				if (this.appMode === "widget") {
					this.showFrameContainer(true);
				}
			});
		});
	};

	showImage = (url) => {
		runFunctionWhenDomIsReady(() => {
			var elem = document.createElement("div");
			elem.className = "yaplet-image-view";

			var closeContainer = document.createElement("div");
			closeContainer.className = "yaplet-image-view-close";
			closeContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm97.9-320l-17 17-47 47 47 47 17 17L320 353.9l-17-17-47-47-47 47-17 17L158.1 320l17-17 47-47-47-47-17-17L192 158.1l17 17 47 47 47-47 17-17L353.9 192z"/></svg>`;

			var img = document.createElement("img");
			img.className = "yaplet-image-view-image";
			img.src = url;

			elem.appendChild(closeContainer);
			elem.appendChild(img);
			document.body.appendChild(elem);

			const closeElement = () => {
				elem.remove();
			};

			closeContainer.addEventListener("click", () => {
				closeElement();
			});

			elem.addEventListener("click", (e) => {
				if (e.target === elem) {
					closeElement();
				}
			});
		});
	};

	updateFrameStyle = () => {
		if (!this.yapletFrameContainer) {
			return;
		}

		const surveyStyle = "yaplet-frame-container--survey";
		const extendedStyle = "yaplet-frame-container--extended";
		const surveyFullStyle = "yaplet-frame-container--survey-full";
		const classicStyle = "yaplet-frame-container--classic";
		const classicStyleLeft = "yaplet-frame-container--classic-left";
		const modernStyleLeft = "yaplet-frame-container--modern-left";
		const noButtonStyleLeft = "yaplet-frame-container--no-button";
		const allStyles = [
			classicStyle,
			classicStyleLeft,
			extendedStyle,
			modernStyleLeft,
			noButtonStyleLeft,
			surveyStyle,
			surveyFullStyle,
		];
		for (let i = 0; i < allStyles.length; i++) {
			this.yapletFrameContainer.classList.remove(allStyles[i]);
		}

		var styleToApply = undefined;
		const flowConfig = ConfigManager.getInstance().getFlowConfig();
		if (
			flowConfig?.feedbackButtonPosition ===
			FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC ||
			flowConfig?.feedbackButtonPosition ===
			FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_BOTTOM
		) {
			styleToApply = classicStyle;
		}
		if (
			flowConfig?.feedbackButtonPosition ===
			FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_LEFT
		) {
			styleToApply = classicStyleLeft;
		}
		if (
			flowConfig?.feedbackButtonPosition ===
			FeedbackButtonManager.FEEDBACK_BUTTON_BOTTOM_LEFT
		) {
			styleToApply = modernStyleLeft;
		}
		if (FeedbackButtonManager.getInstance().buttonHidden === null) {
			if (
				flowConfig?.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_NONE
			) {
				styleToApply = noButtonStyleLeft;
			}
		} else {
			if (FeedbackButtonManager.getInstance().buttonHidden) {
				styleToApply = noButtonStyleLeft;
			}
		}
		if (styleToApply) {
			this.yapletFrameContainer.classList.add(styleToApply);
		}

		if (this.appMode === "survey") {
			this.yapletFrameContainer.classList.add(surveyStyle);
		}
		if (this.appMode === "survey_full" || this.appMode === "survey_web") {
			this.yapletFrameContainer.classList.add(surveyFullStyle);
		}
		if (this.appMode === "extended") {
			this.yapletFrameContainer.classList.add(extendedStyle);
		}

		this.yapletFrameContainer.setAttribute(
			"dir",
			TranslationManager.getInstance().isRTLLayout ? "rtl" : "ltr"
		);
	};

	showFrameContainer(showLoader) {
		if (!this.yapletFrameContainer) {
			return;
		}

		const flowConfig = ConfigManager.getInstance().getFlowConfig();
		const loadingClass = "yaplet-frame-container--loading";
		if (this.yapletFrameContainer.classList) {
			this.yapletFrameContainer.classList.remove(
				"yaplet-frame-container--hidden"
			);
			if (showLoader) {
				this.yapletFrameContainer.classList.add(loadingClass);

				if (flowConfig.disableBGFade) {
					this.yapletFrameContainer.classList.add(
						"yaplet-frame-container--loading-nofade"
					);
				}
				if (flowConfig.disableBGGradient) {
					this.yapletFrameContainer.classList.add(
						"yaplet-frame-container--loading-nogradient"
					);
				}
			} else {
				this.yapletFrameContainer.classList.remove(loadingClass);
			}

			setTimeout(() => {
				this.yapletFrameContainer.classList.add(
					"yaplet-frame-container--animate"
				);
			}, 500);
		}

		this.widgetOpened = true;
		this.updateUI();
	}

	runWidgetShouldOpenCallback() {
		if (!this.yapletFrameContainer) {
			return;
		}

		this.workThroughQueue();

		Yaplet.getInstance().setGlobalDataItem("snapshotPosition", {
			x: window.scrollX,
			y: window.scrollY,
		});

		this.showFrameContainer(false);
		this.updateWidgetStatus();

		EventManager.notifyEvent("open");
		this.registerEscListener();
	}

	updateUI() {
		// Clear notifications only when not opening a survey.
		NotificationManager.getInstance().clearAllNotifications(this.isSurvey());
		NotificationManager.getInstance().setNotificationCount(0);
		FeedbackButtonManager.getInstance().updateFeedbackButtonState();
	}

	showWidget() {
		setTimeout(() => {
			if (this.yapletFrameContainer) {
				this.runWidgetShouldOpenCallback();
			} else {
				FrameManager.getInstance().injectFrame();
			}
			this.updateUI();
		}, 0);
	}

	updateWidgetStatus() {
		this.sendMessage({
			name: "widget-status-update",
			data: {
				isWidgetOpen: this.widgetOpened,
			},
		});
	}

	hideMarkerManager() {
		if (this.markerManager) {
			this.markerManager.clear();
			this.markerManager = null;
		}
	}

	hideWidget() {
		// Prevent for survey web.
		if (this.appMode === "survey_web") {
			return;
		}

		this.hideMarkerManager();
		if (this.yapletFrameContainer) {
			this.yapletFrameContainer.classList.add("yaplet-frame-container--hidden");
			this.yapletFrameContainer.classList.remove(
				"yaplet-frame-container--animate"
			);
		}
		this.widgetOpened = false;
		this.updateWidgetStatus();
		FeedbackButtonManager.getInstance().updateFeedbackButtonState();
		EventManager.notifyEvent("close");
		NotificationManager.getInstance().reloadNotificationsFromCache();

		this.unregisterEscListener();

		if (typeof window !== "undefined" && typeof window.focus !== "undefined") {
			window.focus();
		}
	}

	sendMessage(data, queue = false) {
		try {
			this.yapletFrame = document.querySelector(".yaplet-frame");
			if (this.comReady && this.yapletFrame && this.yapletFrame.contentWindow) {
				this.yapletFrame.contentWindow.postMessage(
					JSON.stringify(data),
					this.frameUrl
				);
			} else {
				if (queue) {
					this.queue.push(data);
				}
			}
		} catch (e) { }
	}

	sendSessionUpdate() {
		this.sendMessage({
			name: "session-update",
			data: {
				sessionData: Session.getInstance().getSession(),
				apiUrl: Session.getInstance().apiUrl,
				sdkKey: Session.getInstance().sdkKey,
			},
		});
	}

	sendConfigUpdate() {
		this.sendMessage({
			name: "config-update",
			data: {
				config: ConfigManager.getInstance().getFlowConfig(),
				aiTools: ConfigManager.getInstance().getAiTools(),
				overrideLanguage:
					TranslationManager.getInstance().getOverrideLanguage(),
			},
		});

		this.updateFrameStyle();
	}

	showDrawingScreen(type) {
		this.hideWidget();

		// Show screen drawing.
		this.markerManager = new MarkerManager(type);
		this.markerManager.show((success) => {
			if (!success) {
				this.hideMarkerManager();
			}
			this.showWidget();
		});
	}

	workThroughQueue() {
		const workQueue = [...this.queue];
		this.queue = [];
		for (let i = 0; i < workQueue.length; i++) {
			this.sendMessage(workQueue[i], true);
		}
	}

	startCommunication() {
		// Listen for messages.
		this.addMessageListener((data) => {
			if (data.name === "ping") {
				this.comReady = true;
				this.sendConfigUpdate();
				this.sendSessionUpdate();
				this.workThroughQueue();
				if (data.shouldOpen) {
					setTimeout(() => {
						this.runWidgetShouldOpenCallback();
					}, 300);
				}
			}

			if (data.name === "play-ping") {
				AudioManager.ping();
			}

			if (data.name === "open-image") {
				this.showImage(data.data.url);
			}

			if (data.name === "page-changed") {
				if (
					data.data &&
					(data.data.name === "newsdetails" || data.data.name === "appextended")
				) {
					this.setAppMode("extended");
				} else {
					if (this.appMode === "extended") {
						this.setAppMode("widget");
					}
				}
			}

			if (data.name === "collect-ticket-data") {
				var ticketData = {
					customData: CustomDataManager.getInstance().getCustomData(),
					metaData: MetaDataManager.getInstance().getMetaData(),
					consoleLog: ConsoleLogManager.getInstance().getLogs(),
					networkLogs: NetworkIntercepter.getInstance().getRequests(),
					customEventLog: StreamedEvent.getInstance().getEventArray(),
					formData: CustomDataManager.getInstance().getTicketAttributes(),
				};

				// Add tags
				const tags = TagManager.getInstance().getTags();
				if (tags && tags.length > 0) {
					ticketData.tags = tags;
				}

				this.sendMessage({
					name: "collect-ticket-data",
					data: ticketData,
				});
			}

			if (data.name === "height-update") {
				this.frameHeight = data.data;

				const innerContainer = document.querySelector(
					".yaplet-frame-container-inner"
				);
				if (
					(this.appMode === "survey" ||
						this.appMode === "survey_full" ||
						this.appMode === "survey_web") &&
					innerContainer
				) {
					innerContainer.style.maxHeight = `${this.frameHeight}px`;
				}
			}

			if (data.name === "notify-event") {
				EventManager.notifyEvent(data.data.type, data.data.data);
			}

			if (data.name === "cleanup-drawings") {
				this.hideMarkerManager();
			}

			if (data.name === "open-url") {
				const url = data.data;
				const newTab = data.newTab ? true : false;
				this.urlHandler(url, newTab);
			}

			if (data.name === "run-custom-action") {
				CustomActionManager.triggerCustomAction(data.data, {
					shareToken: data.shareToken,
				});
			}

			if (data.name === "close-widget") {
				this.hideWidget();
			}

			if (data.name === "tool-execution") {
				EventManager.notifyEvent("tool-execution", data.data);
			}

			if (data.name === "send-feedback") {
				const formId = data.data.formId;
				const formData = data.data.formData;
				const action = data.data.action;
				const outboundId = data.data.outboundId;
				const spamToken = data.data.spamToken;

				const feedback = new Feedback(
					action.feedbackType,
					"MEDIUM",
					formId,
					formData,
					false,
					action.excludeData,
					outboundId,
					spamToken
				);
				feedback
					.sendFeedback()
					.then((feedbackData) => {
						this.sendMessage({
							name: "feedback-sent",
							data: feedbackData,
						});
						EventManager.notifyEvent("feedback-sent", formData);

						if (outboundId && outboundId.length > 0) {
							EventManager.notifyEvent("outbound-sent", {
								outboundId: outboundId,
								outbound: action,
								formData: formData,
							});

							try {
								delete formData.reportedBy;
							} catch (e) { }
							Yaplet.trackEvent(`outbound-${outboundId}-submitted`, formData);
						}
					})
					.catch((error) => {
						console.log("Error sending feedback", error);
						this.sendMessage({
							name: "feedback-sending-failed",
							data: "Something went wrong, please try again.",
						});
						EventManager.notifyEvent("error-while-sending");
					});
			}

			if (data.name === "start-screen-drawing") {
				this.showDrawingScreen(data.data);
			}
		});

		// Add window message listener.
		window.addEventListener("message", (event) => {
			if (
				event.origin !== this.frameUrl &&
				event.origin !== BannerManager.getInstance().bannerUrl
			) {
				return;
			}

			try {
				const data = JSON.parse(event.data);
				for (var i = 0; i < this.listeners.length; i++) {
					if (this.listeners[i]) {
						this.listeners[i](data);
					}
				}
			} catch (exp) { }
		});
	}

	addMessageListener(callback) {
		this.listeners.push(callback);
	}
}
