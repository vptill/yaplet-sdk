import {
	FrameManager,
	FeedbackButtonManager,
	Session,
	ConfigManager,
} from "./Yaplet";

export default class TranslationManager {
	overrideLanguage = "";
	isRTLLayout = false;

	// TranslationManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new TranslationManager();
		}
		return this.instance;
	}

	/**
	 * Returns the language to override the default language.
	 * @returns {string}
	 */
	getOverrideLanguage() {
		return this.overrideLanguage;
	}

	/**
	 * Sets the language to override the default language.
	 * @param {*} language
	 */
	setOverrideLanguage(language) {
		this.overrideLanguage = language;
	}

	updateRTLSupport() {
		// Update RTL support.
		const flowConfig = ConfigManager.getInstance().getFlowConfig();

		this.isRTLLayout = false;
		if (
			flowConfig &&
			flowConfig.localizationOptions &&
			flowConfig.localizationOptions.rtl
		) {
			this.isRTLLayout = true;
		}

		FeedbackButtonManager.getInstance().updateFeedbackButtonState();
		FrameManager.getInstance().updateFrameStyle();
	}

	getActiveLanguage() {
		var language = "en";
		if (typeof navigator !== "undefined") {
			language = navigator.language.toLowerCase();
		}
		if (this.overrideLanguage && this.overrideLanguage !== "") {
			language = this.overrideLanguage.toLowerCase();
		}

		return language;
	}

	static translateText(key) {
		if (!key) {
			return "";
		}

		const flowConfig = ConfigManager.getInstance().getFlowConfig();
		const staticTranslation = flowConfig.staticTranslations;

		if (staticTranslation && staticTranslation[key]) {
			return staticTranslation[key];
		}

		return key;
	}
}
