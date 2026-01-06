import {
	FrameManager,
	ConfigManager,
	NotificationManager,
	TranslationManager,
	Session,
} from "./Yaplet";
import { loadIcon } from "./UI";

export default class FeedbackButtonManager {
	feedbackButton = null;
	injectedFeedbackButton = false;
	buttonHidden = null;
	lastButtonIcon = null;

	// Feedback button types
	static FEEDBACK_BUTTON_BOTTOM_RIGHT = "BOTTOM_RIGHT";
	static FEEDBACK_BUTTON_BOTTOM_LEFT = "BOTTOM_LEFT";
	static FEEDBACK_BUTTON_CLASSIC = "BUTTON_CLASSIC";
	static FEEDBACK_BUTTON_CLASSIC_LEFT = "BUTTON_CLASSIC_LEFT";
	static FEEDBACK_BUTTON_CLASSIC_BOTTOM = "BUTTON_CLASSIC_BOTTOM";
	static FEEDBACK_BUTTON_NONE = "BUTTON_NONE";

	// FeedbackButtonManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new FeedbackButtonManager();
		}
		return this.instance;
	}

	/**
	 * Toggles the feedback button visibility.
	 * @param {*} show
	 * @returns
	 */
	toggleFeedbackButton(show) {
		this.buttonHidden = !show;

		FeedbackButtonManager.getInstance().updateFeedbackButtonState();
		NotificationManager.getInstance().updateContainerStyle();
	}

	feedbackButtonPressed() {
		var frameManager = FrameManager.getInstance();
		if (frameManager.isOpened()) {
			frameManager.hideWidget();
		} else {
			frameManager.setAppMode("widget");
			frameManager.showWidget();
		}
	}

	/**
	 * Injects the feedback button into the current DOM.
	 */
	injectFeedbackButton() {
		if (this.injectedFeedbackButton) {
			return;
		}
		this.injectedFeedbackButton = true;

		var elem = document.createElement("div");
		elem.addEventListener("click", () => {
			this.feedbackButtonPressed();
		});
		document.body.appendChild(elem);
		this.feedbackButton = elem;

		this.updateFeedbackButtonState();
	}

	updateNotificationBadge(count) {
		const notificationBadge = document.querySelector(".yy-notification-bubble");
		if (!notificationBadge) {
			return;
		}

		const notificationHiddenClass = "yy-notification-bubble--hidden";
		if (count > 0) {
			notificationBadge.classList.remove(notificationHiddenClass);
			notificationBadge.innerText = count;
		} else {
			notificationBadge.classList.add(notificationHiddenClass);
		}
	}

	refresh() {
		const feedbackButton = document.querySelector(".yy-feedback-button");
		if (feedbackButton) {
			this.updateFeedbackButtonText();
			this.updateFeedbackButtonState();
		} else {
			this.injectedFeedbackButton = false;
			this.feedbackButton = null;
			this.buttonHidden = null;
			this.lastButtonIcon = null;
			this.injectFeedbackButton();
		}
	}

	updateFeedbackButtonText() {
		const flowConfig = ConfigManager.getInstance().getFlowConfig();

		if (
			!(
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC ||
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_BOTTOM ||
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_LEFT
			)
		) {
			return;
		}

		const feedbackButton = document.querySelector(
			".yy-feedback-button-classic"
		);
		if (!feedbackButton) {
			return;
		}

		feedbackButton.innerText = flowConfig.widgetButtonText || "Support";
	}

	/**
	 * Updates the feedback button state
	 * @returns
	 */
	updateFeedbackButtonState() {
		if (this.feedbackButton === null) {
			return;
		}

		const flowConfig = ConfigManager.getInstance().getFlowConfig();

		var buttonIcon = "";
		const iconName = flowConfig?.buttonIcon || "button";
		buttonIcon = loadIcon(iconName, "#fff");

		this.feedbackButton.className = "yy-feedback-button yaplet-font gl-block";
		this.feedbackButton.setAttribute(
			"dir",
			TranslationManager.getInstance().isRTLLayout ? "rtl" : "ltr"
		);

		if (
			flowConfig &&
			(flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC ||
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_BOTTOM ||
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_LEFT)
		) {
			this.feedbackButton.classList.add(
				"yy-feedback-button--classic-button-style"
			);

			this.feedbackButton.innerHTML = `<div class="yy-feedback-button-classic ${flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_LEFT
				? "yy-feedback-button-classic--left"
				: ""
				}${flowConfig.feedbackButtonPosition ===
					FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_BOTTOM
					? "yy-feedback-button-classic--bottom"
					: ""
				}">${flowConfig.widgetButtonText}</div>`;
		} else {
			if (buttonIcon !== this.lastButtonIcon) {
				this.feedbackButton.innerHTML = `<div class="yy-feedback-button-icon">${buttonIcon}${loadIcon(
					"arrowdown",
					"#fff"
				)}</div><div class="yy-notification-bubble yy-notification-bubble--hidden"></div>`;
			}
		}

		// Prevent dom update if not needed.
		this.lastButtonIcon = buttonIcon;

		var hideButton = false;
		if (FeedbackButtonManager.getInstance().buttonHidden === null) {
			if (
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_NONE
			) {
				hideButton = true;
			}
		} else {
			if (FeedbackButtonManager.getInstance().buttonHidden) {
				hideButton = true;
			}
		}
		if (hideButton) {
			this.feedbackButton.classList.add("yy-feedback-button--disabled");
		}

		if (
			flowConfig.feedbackButtonPosition ===
			FeedbackButtonManager.FEEDBACK_BUTTON_BOTTOM_LEFT
		) {
			this.feedbackButton.classList.add("yy-feedback-button--bottomleft");
		}

		if (FrameManager.getInstance().isOpened()) {
			this.feedbackButton.classList.add("yy-feedback-button--open");
		}

		const appMode = FrameManager.getInstance().appMode;
		if (
			appMode === "survey" ||
			appMode === "survey_full" ||
			appMode === "survey_web"
		) {
			this.feedbackButton.classList.add("yy-feedback-button--survey");
		}

		if (flowConfig.hideForGuests === true && !Session.getInstance().isUser()) {
			this.feedbackButton.classList.add("yy-feedback-button--hidden");
		}
	}
}
