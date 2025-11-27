import Yaplet, {
	BannerManager,
	FrameManager,
	MetaDataManager,
	NotificationManager,
	Session,
} from "./Yaplet";
import { dataParser } from "./Helper";

export default class StreamedEvent {
	eventArray = [];
	streamedEventArray = [];
	eventMaxLength = 500;
	errorCount = 0;
	streamingEvents = false;
	lastUrl = undefined;
	mainLoopTimeout = null;
	socket = null;
	connectedWebSocketYapletId = null;
	connectionTimeout = null;
	pingWS = null;
	handleOpenBound = null;
	handleErrorBound = null;
	handleMessageBound = null;
	handleCloseBound = null;
	heartbeatTimeout = null;
	stopHeartbeatAfterNextCheck = false;

	// StreamedEvent singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new StreamedEvent();
			return this.instance;
		} else {
			return this.instance;
		}
	}

	constructor() {
		this.handleOpenBound = this.handleOpen.bind(this);
		this.handleErrorBound = this.handleError.bind(this);
		this.handleMessageBound = this.handleMessage.bind(this);
		this.handleCloseBound = this.handleClose.bind(this);
	}

	cleanupWebSocket() {
		if (this.connectionTimeout) {
			clearTimeout(this.connectionTimeout);
			this.connectionTimeout = null;
		}

		if (this.pingWS) {
			clearInterval(this.pingWS);
			this.pingWS = null;
		}

		this.stopHeartbeat();

		if (this.socket) {
			this.socket.removeEventListener("open", this.handleOpenBound);
			this.socket.removeEventListener("error", this.handleErrorBound);
			this.socket.removeEventListener("message", this.handleMessageBound);
			this.socket.removeEventListener("close", this.handleCloseBound);
			this.socket.close();
			this.socket = null;
		}
	}

	initWebSocket() {
		this.cleanupWebSocket();

		this.connectedWebSocketYapletId = Session.getInstance().session.yapletId;

		if (!Session.getInstance().session || !Session.getInstance().sdkKey) {
			return;
		}

		this.socket = new WebSocket(
			`${Session.getInstance().wsApiUrl}?token=${
				Session.getInstance().session.yapletHash
			}&apiKey=${Session.getInstance().sdkKey}&sdkVersion=${SDK_VERSION}`
		);
		this.socket.addEventListener("open", this.handleOpenBound);
		this.socket.addEventListener("message", this.handleMessageBound);
		this.socket.addEventListener("error", this.handleErrorBound);
		this.socket.addEventListener("close", this.handleCloseBound);
	}

	handleOpen(event) {
		// Only send Phoenix heartbeat, not outreach ping (handled via HTTP now)
		this.pingWS = setInterval(() => {
			if (this.socket.readyState === this.socket.OPEN) {
				this.socket.send(
					JSON.stringify({
						topic: "phoenix",
						event: "heartbeat",
						payload: {},
						ref: 0,
					})
				);
			}
		}, 10000);

		this.socket.send(
			JSON.stringify({
				topic: "visitor:" + Session.getInstance().session.yapletId,
				event: "phx_join",
				payload: {},
				ref: 0,
			})
		);

		if (this.connectionTimeout) {
			clearTimeout(this.connectionTimeout);
			this.connectionTimeout = null;
		}
	}

	handleMessage(event) {
		this.processMessage(JSON.parse(event.data));
	}

	handleError(error) {}

	handleClose(event) {
		setTimeout(() => {
			this.initWebSocket();
		}, 5000);
	}

	processMessage(message) {
		try {
			if (!FrameManager.getInstance().isOpened()) {
				if (
					message.event === "NEW_MESSAGE" ||
					message.event === "message" ||
					message.event === "survey" ||
					message.event === "banner" ||
					message.event === "tour"
				) {
					Yaplet.getInstance().performActions([message]);
				}
				/*if (u != null) {
            NotificationManager.getInstance().setNotificationCount(u);
          }*/
			} else if (
				["message", "survey", "banner", "tour"].includes(message.event)
			) {
				Yaplet.getInstance().performActions([message]);
			}
		} catch (exp) {
			console.log("Error processing message", exp);
		}
	}

	getEventArray() {
		return this.eventArray;
	}

	stop() {
		this.cleanupMainLoop();
		this.stopHeartbeat();
	}

	resetErrorCountLoop() {
		setInterval(() => {
			this.errorCount = 0;
		}, 60000);
	}

	cleanupMainLoop() {
		if (this.mainLoopTimeout) {
			clearInterval(this.mainLoopTimeout);
			this.mainLoopTimeout = null;
		}
	}

	restart() {
		// Only reconnect websockets when needed.
		if (
			this.connectedWebSocketYapletId !== Session.getInstance().session.yapletId
		) {
			this.initWebSocket();
		}

		this.cleanupMainLoop();
		this.trackInitialEvents();
		this.runEventStreamLoop();
	}

	start() {
		this.startPageListener();
		this.resetErrorCountLoop();
	}

	trackInitialEvents() {
		StreamedEvent.getInstance().logEvent("sessionStart");
		StreamedEvent.getInstance().logCurrentPage();
	}

	logCurrentPage() {
		if (Yaplet.getInstance().disablePageTracking) {
			return;
		}

		const currentUrl = window.location.href;
		if (currentUrl && currentUrl !== this.lastUrl) {
			this.lastUrl = currentUrl;
			this.logEvent("pageView", {
				url: currentUrl,
			});

			const bannerData = BannerManager.getInstance().bannerData;
			if (bannerData && bannerData?.trigger) {
				if (bannerData?.trigger.pageQuery.children.length) {
					const pageQuery = bannerData?.trigger.pageQuery.children[0].value;
					const pageQueryValue = pageQuery[1];
					const operator = pageQuery[0];
					let isValid = false;
					switch (operator) {
						case "is":
							isValid = currentUrl === pageQueryValue;
							break;
						case "isNot":
							isValid = currentUrl !== pageQueryValue;
							break;
						case "contains":
							isValid = currentUrl.includes(pageQueryValue);
							break;
						case "doesNotContain":
							isValid = !currentUrl.includes(pageQueryValue);
							break;
						case "startsWith":
							isValid = currentUrl.startsWith(pageQueryValue);
							break;
						case "endsWith":
							isValid = currentUrl.endsWith(pageQueryValue);
							break;
						default:
							isValid = false;
							break;
					}

					if (!isValid) {
						BannerManager.getInstance().removeBannerUI();
					}
				}
			}
		}
	}

	startPageListener() {
		const self = this;
		setInterval(function () {
			self.logCurrentPage();
		}, 1000);
	}

	logEvent(name, data) {
		var log = {
			name,
			date: new Date(),
		};
		if (data) {
			log.data = dataParser(data);
		}
		this.eventArray.push(log);
		this.streamedEventArray.push(log);

		// Check max size of event log
		if (this.eventArray.length > this.eventMaxLength) {
			this.eventArray.shift();
		}

		// Check max size of streamed event log
		if (this.streamedEventArray.length > this.eventMaxLength) {
			this.streamedEventArray.shift();
		}
	}

	runEventStreamLoop = () => {
		const self = this;
		this.streamEvents();

		this.mainLoopTimeout = setTimeout(function () {
			self.runEventStreamLoop();
		}, 2500);
	};

	streamEvents = () => {
		if (
			!Session.getInstance().ready ||
			this.streamingEvents ||
			this.errorCount > 2
		) {
			return;
		}

		// Nothing to stream.
		if (this.streamedEventArray.length === 0) {
			return;
		}

		const self = this;
		this.streamingEvents = true;

		const http = new XMLHttpRequest();
		http.open("POST", Session.getInstance().apiUrl + "/sdk/ping");
		http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		Session.getInstance().injectSession(http);
		http.onerror = () => {
			self.errorCount++;
			self.streamingEvents = false;
		};
		http.onreadystatechange = function (e) {
			if (http.readyState === 4) {
				if (http.status === 200 || http.status === 201) {
					self.errorCount = 0;

					// Parse response to check for hasQueuedItems
					try {
						const response = JSON.parse(http.responseText);
						if (response && typeof response.hasQueuedItems === "boolean") {
							self.handlePingResponse(response);
						}
					} catch (e) {
						// Response might not be JSON or might be empty - ignore
					}
				} else {
					self.errorCount++;
				}

				self.streamingEvents = false;
			}
		};

		const sessionDuration = MetaDataManager.getInstance().getSessionDuration();
		http.send(
			JSON.stringify({
				time: sessionDuration,
				events: this.streamedEventArray,
				opened: FrameManager.getInstance().isOpened(),
				type: "js",
				sdkVersion: SDK_VERSION,
				ws: true,
			})
		);

		this.streamedEventArray = [];
	};

	handlePingResponse(response) {
		const hasQueuedItems =
			typeof response === "boolean" ? response : response.hasQueuedItems;
		const pollInMs = response?.pollInMs || 10000;

		if (hasQueuedItems) {
			this.scheduleHeartbeat(pollInMs);
			this.stopHeartbeatAfterNextCheck = false;
		} else if (this.heartbeatTimeout) {
			if (this.stopHeartbeatAfterNextCheck) {
				this.stopHeartbeat();
			} else {
				this.stopHeartbeatAfterNextCheck = true;
				this.scheduleHeartbeat(10000); // One more check
			}
		}
	}

	scheduleHeartbeat(delayMs = 10000) {
		// Clear any existing timeout
		if (this.heartbeatTimeout) {
			clearTimeout(this.heartbeatTimeout);
			this.heartbeatTimeout = null;
		}

		const self = this;
		this.heartbeatTimeout = setTimeout(() => {
			self.callHeartbeatEndpoint();
		}, delayMs);
	}

	callHeartbeatEndpoint() {
		if (!Session.getInstance().ready) {
			return;
		}

		const self = this;
		const http = new XMLHttpRequest();
		http.open("POST", Session.getInstance().apiUrl + "/sdk/heartbeat");
		http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		Session.getInstance().injectSession(http);

		http.onerror = () => {
			// On error, schedule retry
			self.scheduleHeartbeat(10000);
		};

		http.onreadystatechange = function () {
			if (http.readyState === 4) {
				if (http.status === 200 || http.status === 201) {
					try {
						const response = JSON.parse(http.responseText);
						if (response && typeof response.hasQueuedItems === "boolean") {
							const pollInMs = response.pollInMs || 10000;

							if (!response.hasQueuedItems) {
								if (self.stopHeartbeatAfterNextCheck) {
									self.stopHeartbeat();
								} else {
									self.stopHeartbeatAfterNextCheck = true;
									self.scheduleHeartbeat(10000); // One more check
								}
							} else {
								// Schedule next heartbeat based on server response
								self.scheduleHeartbeat(pollInMs);
								self.stopHeartbeatAfterNextCheck = false;
							}
						}
					} catch (e) {
						// Response might not be JSON - schedule retry
						self.scheduleHeartbeat(10000);
					}
				} else {
					// Error status - schedule retry
					self.scheduleHeartbeat(10000);
				}
			}
		};

		http.send(JSON.stringify({}));
	}

	stopHeartbeat() {
		if (this.heartbeatTimeout) {
			clearTimeout(this.heartbeatTimeout);
			this.heartbeatTimeout = null;
		}
		this.stopHeartbeatAfterNextCheck = false;
	}
}
