import StreamedEvent from "./StreamedEvent";
import AudioManager from "./AudioManager";
import NotificationManager from "./NotificationManager";
import CustomActionManager from "./CustomActionManager";
import EventManager from "./EventManager";
import MarkerManager from "./MarkerManager";
import Feedback from "./Feedback";
import FeedbackButtonManager from "./FeedbackButtonManager";
import TranslationManager from "./TranslationManager";
import Session from "./Session";
import ConfigManager from "./ConfigManager";
import CustomDataManager from "./CustomDataManager";
import MetaDataManager from "./MetaDataManager";
import ConsoleLogManager from "./ConsoleLogManager";
import NetworkIntercepter from "./NetworkIntercepter";
import TagManager from "./TagManager";
import BannerManager from "./BannerManager";
import { widgetMaxHeight } from "./UI";
import { runFunctionWhenDomIsReady } from "./Helper";
import { getYaplet, getYapletInstance } from "./YapletRuntime";

// How long the widget's close animation runs before the container is taken out of
// the layout. Keep in sync with .yaplet-frame-container--closing in UI.js.
const CLOSE_ANIMATION_MS = 280;

// The max-width transition of the panel in UI.js — keep the two in step. The widget is
// told the panel has landed this many ms before the transition actually ends: by then an
// ease-out curve has under a percent of the distance left (a pixel or two), and the
// widget's body fades in from transparent, so that last hair of motion is never seen —
// while the screen feels like it arrives as the panel lands rather than after it.
const FRAME_RESIZE_MS = 240;
const FRAME_REVEAL_LEAD_MS = 50;
// Upper bound on how long the widget is left waiting for "frame-resized" (see
// reportFrameSettled); past this the browser never fired transitionend (a background
// tab, for instance).
const FRAME_SETTLE_CAP_MS = 700;

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
	closeTimeout = null;
	settleCleanup = null;
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
		this.cancelPendingClose();
		this.cancelPendingSettle();
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

	injectFrame = ({ preload = false } = {}) => {
		if (this.injectedFrame) {
			return;
		}
		this.injectedFrame = true;
		this.preloadOnly = preload;

		this.autoWhiteListCookieManager();

		// Inject the frame manager after it has been loaded.
		runFunctionWhenDomIsReady(() => {
			ConfigManager.getInstance().onConfigLoaded(() => {
				// Apply CSS.
				ConfigManager.getInstance().applyStylesFromConfig();

				// Inject widget HTML.
				var elem = document.createElement("div");
				// If the user clicked during the preload-mount async gap, treat this
				// as a normal open — the click intent overrides the preload mode.
				const userClickedDuringMount = this.pendingShow;
				const effectivePreload = preload && !userClickedDuringMount;
				// In preload mode, use --preloading (visibility:hidden) instead of
				// --hidden (display:none) so the browser actually loads the iframe
				// src + executes the widget bundle in the background.
				const initialHideClass = effectivePreload
					? "yaplet-frame-container--preloading"
					: "yaplet-frame-container--hidden";
				elem.className =
					"yaplet-frame-container " + initialHideClass + " gl-block";
				// Yaplet.setLanguage() also decides which language the chat widget itself
				// opens in. It has to travel on the iframe URL: the config-update message
				// that also carries overrideLanguage can only arrive once the widget has
				// painted, which would show the wrong language for a moment first. The
				// widget takes the two-letter prefix and ignores anything it cannot speak.
				const overrideLanguage =
					TranslationManager.getInstance().getOverrideLanguage();
				const languageParam = overrideLanguage
					? "&lang=" + encodeURIComponent(overrideLanguage)
					: "";
				elem.innerHTML = `<div class="yaplet-frame-container-inner"><iframe src="${this.frameUrl +
					"/widget/" +
					Session.getInstance().sdkKey +
					"?access_token=" +
					Session.getInstance().session.yapletHash +
					languageParam
					}" class="yaplet-frame" scrolling="yes" title="Yaplet Widget Window" allow="autoplay; encrypted-media; fullscreen;" frameborder="0"></iframe><div class="yaplet-frame-loader" aria-hidden="true"><div class="yaplet-frame-loader-spinner" role="status" aria-label="Loading"><div class="yaplet-frame-loader-spin"><div class="yaplet-frame-loader-ring"></div><div class="yaplet-frame-loader-cap"></div></div></div></div></div>`;
				document.body.appendChild(elem);

				this.yapletFrameContainer = elem;
				this.yapletFrame = document.querySelector(".yaplet-frame");
				this.preloadOnly = effectivePreload;

				this.updateFrameStyle();

				// Auto-show if either: this is a normal (non-preload) injection, or
				// the user clicked while the preload was mid-mount. In the latter
				// case we always show with the loader since the iframe just started.
				const shouldAutoShow =
					(!effectivePreload && this.appMode === "widget") ||
					userClickedDuringMount;
				if (shouldAutoShow) {
					this.pendingShow = false;
					this.showFrameContainer(true);
				}
			});
		});
	};

	/**
	 * Mounts the widget iframe in the background so it is fully booted by the
	 * time the user clicks the feedback button. Safe to call multiple times —
	 * second call no-ops because injectFrame is idempotent.
	 */
	preloadFrame = () => {
		if (this.injectedFrame) {
			return;
		}
		this.injectFrame({ preload: true });
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
			// Re-opened while the close animation was still running: drop the closing
			// state (and its pending hide) so the panel eases back in instead of being
			// yanked to display:none a moment later.
			this.cancelPendingClose();
			this.yapletFrameContainer.classList.remove(
				"yaplet-frame-container--hidden"
			);
			// Strip the preload-only hidden state too — first user-initiated open
			// after a background preload reveals the already-booted iframe.
			this.yapletFrameContainer.classList.remove(
				"yaplet-frame-container--preloading"
			);
			this.preloadOnly = false;
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

	/**
	 * Takes the loading skin off without any of showFrameContainer's side effects
	 * (which mark the widget open and clear notifications). The widget calls this via
	 * the "widget-ready" message when it has something to show that is NOT the normal
	 * booted UI — today that means its "couldn't connect, retry" screen, which would
	 * otherwise sit invisible under our loading overlay forever.
	 */
	hideLoadingSkin() {
		if (!this.yapletFrameContainer || !this.yapletFrameContainer.classList) {
			return;
		}
		this.yapletFrameContainer.classList.remove(
			"yaplet-frame-container--loading"
		);
	}

	runWidgetShouldOpenCallback() {
		if (!this.yapletFrameContainer) {
			return;
		}

		this.workThroughQueue();

		const yapletInstance = getYapletInstance();
		if (yapletInstance) {
			yapletInstance.setGlobalDataItem("snapshotPosition", {
				x: window.scrollX,
				y: window.scrollY,
			});
		}

		// Show the loader if the widget hasn't pinged ready yet — happens when the
		// user clicks during the preload window before the widget bundle finishes
		// booting. comReady is set in startCommunication when the iframe pings.
		this.showFrameContainer(!this.comReady);
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
			} else if (this.injectedFrame) {
				// Preload was kicked off but the async mount hasn't completed yet.
				// Record the click intent — injectFrame's onConfigLoaded callback
				// will pick this up and auto-show with the loader once the container
				// is in the DOM.
				this.pendingShow = true;
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

	prefersReducedMotion() {
		try {
			return (
				typeof window !== "undefined" &&
				typeof window.matchMedia === "function" &&
				window.matchMedia("(prefers-reduced-motion: reduce)").matches
			);
		} catch (e) {
			return false;
		}
	}

	/**
	 * Drops any in-flight close animation and the timer that would have hidden the
	 * container when it finished. Safe to call at any time.
	 */
	cancelPendingClose() {
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = null;
		}
		if (this.yapletFrameContainer && this.yapletFrameContainer.classList) {
			this.yapletFrameContainer.classList.remove(
				"yaplet-frame-container--closing"
			);
		}
	}

	/**
	 * Tells the widget when the panel has finished changing size.
	 *
	 * Opening an article widens the frame (the "extended" mode) and leaving one narrows
	 * it again. Text laid out during that motion reflows on every frame, so the widget
	 * keeps its body blank from the moment it asks for the change until this message
	 * arrives, and only then lets the new screen fade in. The message goes out a few
	 * frames before the container's max-width transition ends (FRAME_REVEAL_LEAD_MS — the
	 * panel is within a pixel or two of its final size by then), or almost at once when no
	 * transition begins at all: on phones the panel is full-width either way, under
	 * reduced motion the change is instant, and a page change that keeps the same mode
	 * moves nothing. The widget also watches its own viewport for stillness, so a message
	 * that never arrives costs it a beat, never a blank screen.
	 */
	reportFrameSettled(seq) {
		this.cancelPendingSettle();
		const container = this.yapletFrameContainer;
		if (!container) {
			return;
		}

		let started = false;
		let landingTimer = null;
		const finish = () => {
			this.cancelPendingSettle();
			this.sendMessage({ name: "frame-resized", data: { seq } });
		};
		const isOurs = (event) =>
			event.target === container && event.propertyName === "max-width";
		const onRun = (event) => {
			if (isOurs(event) && !started) {
				started = true;
				// Report the landing a few frames early; transitionend below is the backstop
				// for a transition that runs slower than FRAME_RESIZE_MS says.
				landingTimer = setTimeout(
					finish,
					Math.max(0, FRAME_RESIZE_MS - FRAME_REVEAL_LEAD_MS)
				);
			}
		};
		const onEnd = (event) => {
			if (isOurs(event)) {
				finish();
			}
		};
		container.addEventListener("transitionrun", onRun);
		container.addEventListener("transitionend", onEnd);
		container.addEventListener("transitioncancel", onEnd);

		// A transition that is going to happen has begun within two or three frames of
		// the class change; none by then means the panel is not moving.
		const noTransitionTimer = setTimeout(() => {
			if (!started) {
				finish();
			}
		}, 50);
		const capTimer = setTimeout(finish, FRAME_SETTLE_CAP_MS);

		this.settleCleanup = () => {
			clearTimeout(noTransitionTimer);
			clearTimeout(capTimer);
			clearTimeout(landingTimer);
			container.removeEventListener("transitionrun", onRun);
			container.removeEventListener("transitionend", onEnd);
			container.removeEventListener("transitioncancel", onEnd);
		};
	}

	/**
	 * Drops the listeners and timers of a settle report that has not gone out yet. A
	 * newer page change supersedes it: the widget waits for whichever resize is the
	 * current one.
	 */
	cancelPendingSettle() {
		if (this.settleCleanup) {
			this.settleCleanup();
			this.settleCleanup = null;
		}
	}

	/**
	 * Plays the close animation, then takes the container out of the layout. The
	 * container has to stay displayed for the length of the animation — adding
	 * --hidden (display: none) straight away is what used to make the widget
	 * disappear in a single frame.
	 */
	animateFrameContainerOut(instant = false) {
		const container = this.yapletFrameContainer;
		if (!container || !container.classList) {
			return;
		}

		this.cancelPendingClose();

		// Cases that never animate: full-screen surveys (CSS disables the animation),
		// a container that is only preloading or already hidden, and visitors who
		// asked their OS for reduced motion.
		const hideImmediately =
			instant ||
			this.prefersReducedMotion() ||
			this.appMode === "survey_full" ||
			this.appMode === "survey_web" ||
			container.classList.contains("yaplet-frame-container--hidden") ||
			container.classList.contains("yaplet-frame-container--preloading");

		if (hideImmediately) {
			container.classList.add("yaplet-frame-container--hidden");
			return;
		}

		container.classList.add("yaplet-frame-container--closing");
		this.closeTimeout = setTimeout(() => {
			this.closeTimeout = null;
			// Re-opened mid-animation — showFrameContainer already removed --closing,
			// so this hide is stale and must not run.
			if (!container.classList.contains("yaplet-frame-container--closing")) {
				return;
			}
			container.classList.add("yaplet-frame-container--hidden");
			container.classList.remove("yaplet-frame-container--closing");
		}, CLOSE_ANIMATION_MS);
	}

	/**
	 * @param {boolean} instant Skip the close animation and take the widget out of
	 *   the layout in the same frame. Used when something else is about to draw over
	 *   the page (screen drawing / screen recording) and must not catch the widget
	 *   still fading out.
	 */
	hideWidget(instant = false) {
		// Prevent for survey web.
		if (this.appMode === "survey_web") {
			return;
		}

		this.hideMarkerManager();
		if (this.yapletFrameContainer) {
			this.yapletFrameContainer.classList.remove(
				"yaplet-frame-container--animate"
			);
			this.animateFrameContainerOut(instant);
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
		this.hideWidget(true);

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
				// shouldOpen: the widget says "I'm freshly loaded, please open me."
				// Suppress auto-open while the container is still in preload-only state
				// — the user's actual click clears preloadOnly via showFrameContainer.
				if (data.shouldOpen && !this.preloadOnly) {
					setTimeout(() => {
						this.runWidgetShouldOpenCallback();
					}, 300);
				}
			}

			// The widget has something to show that is not the normal booted UI (its
			// connection-error screen). Reveal the iframe without treating this as an
			// "open" — the visitor may not even have the widget open right now.
			if (data.name === "widget-ready") {
				this.comReady = true;
				this.hideLoadingSkin();
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
				// Every page change is answered, whether or not the panel actually moved:
				// the widget holds its body blank until it hears back. The number it sent
				// travels back with the answer so it can tell a stale reply from a current one.
				this.reportFrameSettled(data.data ? data.data.seq : undefined);
			}

			if (data.name === "collect-ticket-data") {
				var ticketData = {
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
							const yaplet = getYaplet();
							if (yaplet) {
								yaplet.trackEvent(`outbound-${outboundId}-submitted`, formData);
							}
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
