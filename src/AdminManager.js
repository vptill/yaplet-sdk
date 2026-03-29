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
	pillPosition = "bottom-center";

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

	setFrameHeight(state, pillPosition) {
		if (this.yapletFrameContainer) {
			var isPill = state === "picker" || state === "navigate" || state === "minimized";
			var height = state === "editor" ? "100vh" : "0px";

			if (isPill) {
				// Shrink container to exact pill size so clicks pass through to the page
				var pillHeight = "36px";
				var pillWidth = "170px";
				var pillBottom = "12px";
				var pillRadius = "9999px";

				this.yapletFrameContainer.style.height = pillHeight;
				this.yapletFrameContainer.style.width = pillWidth;
				this.yapletFrameContainer.style.bottom = pillBottom;
				this.yapletFrameContainer.style.borderRadius = pillRadius;
				this.yapletFrameContainer.style.overflow = "hidden";
				this.yapletFrameContainer.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)";
				this.yapletFrameContainer.style.transform = "";

				// Position based on pill placement
				var pos = pillPosition || this.pillPosition || "bottom-center";
				if (pos === "bottom-left") {
					this.yapletFrameContainer.style.left = "16px";
					this.yapletFrameContainer.style.right = "auto";
				} else if (pos === "bottom-right") {
					this.yapletFrameContainer.style.left = "auto";
					this.yapletFrameContainer.style.right = "16px";
				} else {
					this.yapletFrameContainer.style.left = "50%";
					this.yapletFrameContainer.style.right = "auto";
					this.yapletFrameContainer.style.transform = "translateX(-50%)";
				}

				// Round the iframe too
				if (this.yapletFrame) {
					this.yapletFrame.style.borderRadius = pillRadius;
				}
			} else {
				// Full-width for editor/loading states
				this.yapletFrameContainer.style.width = "100vw";
				this.yapletFrameContainer.style.height = height;
				this.yapletFrameContainer.style.bottom = "0px";
				this.yapletFrameContainer.style.left = "0px";
				this.yapletFrameContainer.style.right = "0px";
				this.yapletFrameContainer.style.transform = "";
				this.yapletFrameContainer.style.borderRadius = "";
				this.yapletFrameContainer.style.overflow = "";
				this.yapletFrameContainer.style.boxShadow = "";

				if (this.yapletFrame) {
					this.yapletFrame.style.borderRadius = "";
				}
			}
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
						// data.data can be a string ("editor"/"navigate") or object { status, pillPosition }
						var statusData = data.data;
						if (typeof statusData === "object" && statusData.status) {
							self.status = statusData.status;
							self.pillPosition = statusData.pillPosition || self.pillPosition;
						} else {
							self.status = statusData;
						}
						this.setFrameHeight(self.status, self.pillPosition);
						self.adminHelper.stopPicker();

						if (self.status === "picker") {
							self.adminHelper.startPicker();
						}
					}

					if (data.name === "pill-position-changed") {
						self.pillPosition = data.data;
						// Re-apply frame positioning if currently in pill mode
						if (self.status === "picker" || self.status === "minimized" || self.status === "navigate") {
							this.setFrameHeight(self.status, self.pillPosition);
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
		}" class="yaplet-admin-frame" scrolling="no" title="yaplet Admin Window" allow="autoplay; encrypted-media; fullscreen;" frameborder="0" allowtransparency="true" style="background: transparent;"></iframe>`;
		document.body.appendChild(elem);

		this.yapletFrameContainer = elem;
		this.yapletFrame = document.querySelector(".yaplet-admin-frame");
	};
}
