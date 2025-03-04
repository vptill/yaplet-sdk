import {
	EventManager,
	TranslationManager,
	FrameManager,
	NotificationManager,
	StreamedEvent,
	BannerManager,
} from "./Yaplet";
import {
	eraseYapletCookie,
	getYapletCookie,
	loadFromYapletCache,
	saveToYapletCache,
	setYapletCookie,
} from "./Helper";
//import TooltipManager from "./TooltipManager";

export default class Session {
	apiUrl = "https://widget.yaplet.com/api";
	wsApiUrl = "wss://phx.yaplet.com/socket/websocket";
	sdkKey = null;
	updatingSession = false;
	useCookies = false;
	session = {
		yapletId: null,
		yapletHash: null,
		name: "",
		email: "",
		userId: "",
		phone: "",
		value: 0,
	};
	ready = false;
	onSessionReadyListener = [];

	// Session singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new Session();
			return this.instance;
		} else {
			return this.instance;
		}
	}

	/**
	 * Returns the current session name.
	 * @returns string
	 */
	getName() {
		try {
			return this.session.name
				? this.session.name
						.split(" ")[0]
						.split("@")[0]
						.split(".")[0]
						.split("+")[0]
				: "";
		} catch (exp) {
			return this.session.name;
		}
	}

	/**
	 * Returns the Yaplet session object.
	 * @returns
	 */
	getSession() {
		return this.session;
	}

	/**
	 * Returns the Yaplet session object.
	 * @returns
	 */
	getYapletId() {
		if (this.session && this.session.yapletId) {
			return this.session.yapletId;
		}

		return null;
	}

	/**
	 * Determines if the current session is a identified user.
	 * @returns boolean
	 */
	isUser() {
		if (this.session && this.session.userId) {
			return true;
		}
		return false;
	}

	constructor() {}

	setOnSessionReady = (onSessionReady) => {
		if (this.ready) {
			onSessionReady();
		} else {
			this.onSessionReadyListener.push(onSessionReady);
		}
	};

	injectSession = (http) => {
		if (http && this.session) {
			http.setRequestHeader("Api-Token", this.sdkKey);
			http.setRequestHeader("Yaplet-Id", this.session.yapletId);
			http.setRequestHeader(
				"Y-Authorization",
				"Bearer " + this.session.yapletHash
			);
		}
	};

	clearSession = (attemp = 0, retry = true) => {
		if (this.session && this.session.yapletHash) {
			EventManager.notifyEvent(
				"unregister-pushmessage-group",
				`yapletuser-${this.session.yapletHash}`
			);
		}

		try {
			saveToYapletCache(`session-${this.sdkKey}`, null);
		} catch (exp) {}

		if (this.useCookies) {
			try {
				eraseYapletCookie(`session-${this.sdkKey}`);
			} catch (exp) {}
		}

		this.ready = false;
		this.session = {
			yapletId: null,
			yapletHash: null,
			name: "",
			email: "",
			userId: "",
			phone: "",
			value: 0,
		};

		FrameManager.getInstance().sendMessage(
			{
				name: "session-cleared",
			},
			true
		);
		NotificationManager.getInstance().clearAllNotifications(false);
		NotificationManager.getInstance().setNotificationCount(0);
		BannerManager.getInstance().removeBannerUI();

		if (retry) {
			if (!isNaN(attemp)) {
				// Exponentially retry to renew session.
				const newTimeout = Math.pow(attemp, 2) * 10;
				setTimeout(() => {
					this.startSession(attemp + 1);
				}, newTimeout * 1000);
			}
		}
	};

	validateSession = (session) => {
		if (!session || !session.yapletId) {
			return;
		}

		// Unregister previous group.
		if (this.session && this.session.yapletHash) {
			EventManager.notifyEvent(
				"unregister-pushmessage-group",
				`yapletuser-${this.session.yapletHash}`
			);
		}

		saveToYapletCache(`session-${this.sdkKey}`, session);
		if (this.useCookies) {
			setYapletCookie(
				`session-${this.sdkKey}`,
				encodeURIComponent(JSON.stringify(session)),
				365
			);
		}

		this.session = session;
		this.ready = true;

		// Register new push group.
		if (this.session && this.session.yapletHash) {
			EventManager.notifyEvent(
				"register-pushmessage-group",
				`yapletuser-${this.session.yapletHash}`
			);
		}

		this.notifySessionReady();
	};

	startSession = (attemp = 0) => {
		// Check if we already have a session cookie.
		try {
			if (this.useCookies) {
				const sessionCookie = getYapletCookie(`session-${this.sdkKey}`);
				if (sessionCookie) {
					const sessionData = JSON.parse(decodeURIComponent(sessionCookie));
					this.validateSession(sessionData);
				}
			}
		} catch (exp) {}

		// Try to load session from local storage, if not already loaded.
		if (
			!(
				this.session &&
				this.session.yapletId &&
				this.session.yapletId.length > 0
			)
		) {
			const cachedSession = loadFromYapletCache(`session-${this.sdkKey}`);
			if (cachedSession) {
				this.validateSession(cachedSession);
			}
		}

		const self = this;
		const http = new XMLHttpRequest();
		http.open("POST", self.apiUrl + "/sdk/sessions");
		http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
		http.setRequestHeader("Api-Token", self.sdkKey);

		const oldCachedSession = localStorage.getItem(`yaplet-access-token`);
		try {
			if (this.session && this.session.yapletId && this.session.yapletHash) {
				http.setRequestHeader("Yaplet-Id", this.session.yapletId);
				http.setRequestHeader(
					"Y-Authorization",
					"Bearer " + this.session.yapletHash
				);
			} else {
				if (oldCachedSession) {
					http.setRequestHeader(
						"Y-Authorization",
						"Bearer " + oldCachedSession
					);
				}
			}
		} catch (exp) {}

		http.onreadystatechange = function (e) {
			if (http.readyState === 4) {
				if (http.status === 200 || http.status === 201) {
					try {
						const sessionData = JSON.parse(http.responseText);
						self.validateSession(sessionData);
						NotificationManager.getInstance().setNotificationCount(
							sessionData.unreadCount
						);

						// Initially track.
						StreamedEvent.getInstance().restart();

						// Load tooltips.
						//TooltipManager.getInstance().load();
					} catch (exp) {}
				} else {
					if (http.status !== 429) {
						self.clearSession(attemp, true);
					}
				}
			}
		};
		http.send(
			JSON.stringify({
				lang: TranslationManager.getInstance().getActiveLanguage(),
				url: window.location.href,
			})
		);
	};

	notifySessionReady() {
		if (this.onSessionReadyListener.length > 0) {
			for (var i = 0; i < this.onSessionReadyListener.length; i++) {
				this.onSessionReadyListener[i]();
			}
		}
		this.onSessionReadyListener = [];

		// Send session update to frame.
		FrameManager.getInstance().sendSessionUpdate();
	}

	checkIfSessionNeedsUpdate = (userId, userData) => {
		if (!this.session || !this.session.userId || !userId) {
			return true;
		}

		try {
			if (this.session.userId.toString() !== userId.toString()) {
				return true;
			}
		} catch (exp) {}

		return this.checkIfSessionDataNeedsUpdate(userData);
	};

	checkIfSessionDataNeedsUpdate = (userData) => {
		if (userData) {
			var userDataKeys = Object.keys(userData);
			for (var i = 0; i < userDataKeys.length; i++) {
				var userDataKey = userDataKeys[i];
				if (
					JSON.stringify(this.session[userDataKey]) !==
					JSON.stringify(userData[userDataKey])
				) {
					// Check custom data for a match.
					if (
						!(
							this.session.customData &&
							JSON.stringify(this.session.customData[userDataKey]) ===
								JSON.stringify(userData[userDataKey])
						)
					) {
						return true;
					}
				}
			}
		}

		return false;
	};

	updateSession = (userData) => {
		// Check if session needs update.
		const sessionNeedsUpdate = this.checkIfSessionDataNeedsUpdate(userData);
		if (!sessionNeedsUpdate) {
			return;
		}

		const self = this;
		return new Promise((resolve, reject) => {
			// Wait for yaplet session to be ready.
			this.setOnSessionReady(function () {
				if (!self.session.yapletId || !self.session.yapletHash) {
					return reject("Session not ready yet.");
				}

				const http = new XMLHttpRequest();
				http.open("POST", self.apiUrl + "/sdk/sessions");
				http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
				http.setRequestHeader("Api-Token", self.sdkKey);
				try {
					http.setRequestHeader("Yaplet-Id", self.session.yapletId);
					http.setRequestHeader(
						"Y-Authorization",
						"Bearer " + self.session.yapletHash
					);
				} catch (exp) {}

				http.onerror = () => {
					reject();
				};
				http.onreadystatechange = function (e) {
					if (http.readyState === 4) {
						if (http.status === 200 || http.status === 201) {
							try {
								const sessionData = JSON.parse(http.responseText);
								self.validateSession(sessionData);
								resolve(sessionData);
							} catch (exp) {
								reject(exp);
							}
						} else {
							reject();
						}
					}
				};

				http.send(
					JSON.stringify({
						data: {
							...userData,
							lang: TranslationManager.getInstance().getActiveLanguage(),
						},
						type: "js",
						sdkVersion: SDK_VERSION,
						ws: true,
						url: window.location.href,
					})
				);
			});
		});
	};

	identifySession = (userId, userData, userHash) => {
		const sessionNeedsUpdate = this.checkIfSessionNeedsUpdate(userId, userData);
		if (!sessionNeedsUpdate) {
			return;
		}

		const self = this;
		return new Promise((resolve, reject) => {
			// Wait for yaplet session to be ready.
			this.setOnSessionReady(function () {
				if (!self.session.yapletId || !self.session.yapletHash) {
					return reject("Session not ready yet.");
				}

				const http = new XMLHttpRequest();
				http.open("POST", self.apiUrl + "/sdk/identify");
				http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
				http.setRequestHeader("Api-Token", self.sdkKey);
				try {
					http.setRequestHeader("Yaplet-Id", self.session.yapletId);
					http.setRequestHeader(
						"Y-Authorization",
						"Bearer " + self.session.yapletHash
					);
				} catch (exp) {}

				http.onerror = () => {
					reject();
				};
				http.onreadystatechange = function (e) {
					if (http.readyState === 4) {
						if (http.status === 200 || http.status === 201) {
							try {
								const sessionData = JSON.parse(http.responseText);
								self.validateSession(sessionData);

								// Initially track.
								StreamedEvent.getInstance().restart();

								// Load tooltips.
								//TooltipManager.getInstance().load();
								resolve(sessionData);
							} catch (exp) {
								reject(exp);
							}
						} else {
							reject();
						}
					}
				};

				var dataToSend = {
					...userData,
				};

				if (userData.customData) {
					delete dataToSend["customData"];
					dataToSend = {
						...dataToSend,
						...userData.customData,
					};
				}

				http.send(
					JSON.stringify({
						...dataToSend,
						userId,
						userHash,
						lang: TranslationManager.getInstance().getActiveLanguage(),
					})
				);
			});
		});
	};

	startProductTourConfig = (tourId) => {
		const self = this;
		return new Promise((resolve, reject) => {
			this.setOnSessionReady(function () {
				if (!self.session.yapletId || !self.session.yapletHash) {
					return reject("Session not ready yet.");
				}

				const http = new XMLHttpRequest();
				http.open("POST", self.apiUrl + "/sdk/tours");
				http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
				http.setRequestHeader("Api-Token", self.sdkKey);
				try {
					http.setRequestHeader("Yaplet-Id", self.session.yapletId);
					http.setRequestHeader(
						"Y-Authorization",
						"Bearer " + self.session.yapletHash
					);
				} catch (exp) {}

				http.onerror = () => {
					reject();
				};
				http.onreadystatechange = function (e) {
					if (http.readyState === 4) {
						if (http.status === 200 || http.status === 201) {
							try {
								const tourData = JSON.parse(http.responseText);
								if (tourData && tourData.config) {
									resolve(tourData.config);
								}
							} catch (exp) {
								reject(exp);
							}
						} else {
							reject();
						}
					}
				};
				http.send(
					JSON.stringify({
						outboundId: tourId,
					})
				);
			});
		});
	};
}
