import AdminHelper from "./AdminHelper";

export default class AdminManager {
	libraryInstance = null;
	lastUrl = undefined;
	injectedFrame = false;
	yapletFrameContainer = null;
	yapletFrame = null;
	frameUrl = "https://yaplet.com";
	configData = null;
	adminHelper = null;
	status = "navigate";

	// AdminManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new AdminManager();
		}

		return this.instance;
	}

	logCurrentPage() {
		const currentUrl = window.location.href;
		if (currentUrl && currentUrl !== this.lastUrl) {
			this.lastUrl = currentUrl;

			this.sendMessageToTourBuilder({
				name: "page-changed",
				data: {
					page: currentUrl,
				},
			});
		}
	}

	startPageListener() {
		const self = this;
		setInterval(function () {
			self.logCurrentPage();
		}, 1000);
	}

	initAdminHelper() {
		const self = this;

		self.adminHelper = new AdminHelper();

		try {
			self.adminHelper.onElementPicked = (selector) => {
				self.sendMessageToTourBuilder({
					name: "element-picked",
					data: {
						selector,
					},
				});
			};
		} catch (e) {
			console.log(e);
		}

		self.injectFrame();
		self.setFrameHeight("loading");
	}

	setFrameHeight(state) {
		if (this.yapletFrameContainer) {
			var height = "";
			if (state === "picker" || state === "navigate") {
				height = "65px";
			} else if (state === "minimized") {
				height = "48px";
			} else if (state === "editor") {
				height = "100vh";
			} else {
				height = "0px";
			}
			this.yapletFrameContainer.style.height = height;
		}
	}

	start() {
		if (typeof window === "undefined") {
			return;
		}

		if (window.yapletAdminDisabled) {
			return;
		}

		var self = this;

		// Add window message listener.
		window.addEventListener("message", (event) => {
			if (!event.origin /*|| !event.origin === "https://yaplet.com"*/) {
				return;
			}

			try {
				const data = JSON.parse(event.data);
				if (data.type === "admin") {
					if (data.name === "load") {
						self.configData = data.data;
						self.initAdminHelper();
						this.sendMessage({ name: "builder-init" });
					}

					if (data.name === "smartlink-search-result") {
						this.sendMessageToTourBuilder({
							name: "smartlink-search-result",
							data: data.data,
						});
					}
				}

				if (data.type === "tourbuilder") {
					if (data.name === "loaddata") {
						this.sendMessageToTourBuilder({
							name: "data",
							data: self.configData,
							url: window.location.href,
						});
					}

					if (data.name === "smartlink-search") {
						this.sendMessage({
							name: "smartlink-search",
							data: data.data,
						});
					}

					if (data.name === "save") {
						this.sendMessage({
							name: "save",
							data: data.data,
						});
					}

					if (data.name === "click") {
						try {
							document.querySelector(data.data.selector).click();
						} catch (e) {
							console.log(e);
						}
					}

					if (data.name === "status-changed") {
						self.status = data.data;
						this.setFrameHeight(self.status);
						self.adminHelper.stopPicker();

						if (self.status === "picker") {
							self.adminHelper.startPicker();
						}
					}
				}
			} catch (exp) {}
		});

		this.sendMessage({
			name: "init",
		});

		this.startPageListener();
	}

	sendMessage(data) {
		try {
			if (window && window.opener) {
				window.opener.postMessage(
					JSON.stringify({
						...data,
						type: "admin",
					}),
					"*",
				);
			}
		} catch (e) {}
	}

	sendMessageToTourBuilder(data) {
		try {
			if (this.yapletFrame && this.yapletFrame.contentWindow) {
				this.yapletFrame.contentWindow.postMessage(
					JSON.stringify({
						...data,
						type: "tourbuilder",
					}),
					"*",
				);
			}
		} catch (e) {}
	}

	injectFrame = () => {
		if (this.injectedFrame) {
			return;
		}
		this.injectedFrame = true;

		// Inject widget HTML.
		var elem = document.createElement("div");
		elem.className = "yaplet-admin-frame-container";
		elem.innerHTML = `<iframe src="${this.frameUrl}/${
			this?.configData?.type === "tooltips" ? "tooltipbuilder" : "tourbuilder"
		}" class="yaplet-admin-frame" scrolling="no" title="yaplet Admin Window" allow="autoplay; encrypted-media; fullscreen;" frameborder="0"></iframe>`;
		document.body.appendChild(elem);

		this.yapletFrameContainer = elem;
		this.yapletFrame = document.querySelector(".yaplet-admin-frame");
	};
}
