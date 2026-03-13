import { getYaplet } from "./YapletRuntime";

export default class BannerManager {
	bannerUrl = "https://embed.yaplet.com";
	bannerContainer = null;
	bannerData = null;

	// BannerManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new BannerManager();
		}
		return this.instance;
	}

	constructor() {
		this.startCommunication();
	}

	setBannerUrl(url) {
		this.bannerUrl = url;
	}

	startCommunication() {
		// Add window message listener.
		window.addEventListener("message", (event) => {
			if (event.origin !== this.bannerUrl) {
				return;
			}

			try {
				const data = JSON.parse(event.data);
				const yaplet = getYaplet();
				if (data.name === "banner-loaded" && this.bannerData) {
					this.sendMessage({
						name: "banner-data",
						data: this.bannerData.data,
					});
				}
				if (data.name === "banner-height") {
					document.documentElement.style.setProperty(
						"--yaplet-margin-top",
						data.data.height + "px"
					);
				}
				if (data.name === "banner-data-set") {
					document.body.classList.add("yaplet-b-shown");

					if (this.bannerData?.data?.style === "FLOATING") {
						document.body.classList.add("yaplet-b-f");
						const borderRadius = this.bannerData?.data?.borderRadius;
						if (borderRadius != null && borderRadius !== "") {
							document.documentElement.style.setProperty(
								"--yaplet-banner-radius",
								borderRadius + "px"
							);
						} else {
							document.documentElement.style.removeProperty(
								"--yaplet-banner-radius"
							);
						}
					} else if (this.bannerData?.data?.style === "FIXED_INLINE") {
						document.body.classList.add("yaplet-b-fi");
					}
				}
				if (data.name === "banner-close") {
					this.removeBannerUI();
				}
				if (data.name === "start-conversation") {
					if (yaplet) {
						yaplet.startBot(data.data?.botId);
					}
				}
				if (data.name === "start-custom-action") {
					if (yaplet) {
						yaplet.triggerCustomAction(data.data?.action);
					}
				}
				if (data.name === "show-form") {
					if (yaplet) {
						yaplet.startFeedbackFlow(data.data?.formId);
					}
				}
				if (data.name === "show-survey") {
					if (yaplet) {
						yaplet.showSurvey(data.data?.formId, data.data?.surveyFormat);
					}
				}
				if (data.name === "show-news-article") {
					if (yaplet) {
						yaplet.openNewsArticle(data.data?.articleId);
					}
				}
				if (data.name === "show-help-article") {
					if (yaplet) {
						yaplet.openHelpCenterArticle(data.data?.articleId);
					}
				}
			} catch (exp) { }
		});
	}

	removeBannerUI() {
		if (this.bannerContainer) {
			document.body.removeChild(this.bannerContainer);
			this.bannerContainer = null;
		}

		document.body.classList.remove("yaplet-b-shown");
		document.body.classList.remove("yaplet-b-f");
		document.body.classList.remove("yaplet-b-fi");
		document.documentElement.style.removeProperty("--yaplet-banner-radius");
		document.documentElement.style.removeProperty("--yaplet-margin-top"); // Add this
	}

	/**
	 * Injects the feedback button into the current DOM.
	 */
	injectBannerUI(bannerData) {
		if (this.bannerContainer || !document.body) {
			return false;
		}

		this.bannerData = bannerData;

		var elem = document.createElement("div");
		elem.className = "yaplet-b";
		elem.innerHTML = `<iframe src="${this.bannerUrl}/banner" class="yaplet-b-frame" scrolling="no" title="Yaplet Banner" role="dialog" frameborder="0"></iframe>`;
		document.body.appendChild(elem);
		this.bannerContainer = elem;
	}

	sendMessage(data) {
		try {
			const yapletBFrame = document.querySelector(".yaplet-b-frame");
			if (yapletBFrame && yapletBFrame.contentWindow) {
				yapletBFrame.contentWindow.postMessage(
					JSON.stringify({
						...data,
						type: "banner",
					}),
					"*"
				);
			}
		} catch (e) { }
	}

	showBanner(bannerData) {
		this.injectBannerUI(bannerData);
	}
}
