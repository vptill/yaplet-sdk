import { ConsoleLogManager, NetworkIntercepter, Session, StreamedEvent } from "./Yaplet";
import ModuleRegistry from "./ModuleRegistry";

const FLUSH_INTERVAL_MS = 60000;
const RAGE_CLICK_WINDOW_MS = 1200;
const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_GRID_SIZE = 40;
const MAX_URL_HISTORY = 20;
const JOURNEY_STATE_KEY = "yaplet-replay-journey";
const JOURNEY_IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function generateId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

export default class ReplayManager {
	enabled = false;
	running = false;
	flushInterval = null;
	urlInterval = null;
	urlHistory = [];
	lastTrackedUrl = null;
	rageClickBuckets = new Map();
	rageClicks = 0;
	journeyId = null;
	journeyStartedAt = null;
	journeySegmentIndex = 0;
	previousReplayId = null;
	navigationType = "navigate";
	boundVisibilityHandler = null;
	boundPageHideHandler = null;
	boundBeforeUnloadHandler = null;
	boundClickHandler = null;

	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new ReplayManager();
		}
		return this.instance;
	}

	constructor() {
		this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
		this.boundPageHideHandler = this.handlePageHide.bind(this);
		this.boundBeforeUnloadHandler = this.handleBeforeUnload.bind(this);
		this.boundClickHandler = this.handleClick.bind(this);
	}

	updateFromConfig(flowConfig) {
		const shouldEnable = !!flowConfig?.enableWebReplays;
		this.enabled = shouldEnable;

		if (shouldEnable) {
			this.start();
		} else {
			this.stop();
		}
	}

	start() {
		if (!this.enabled || this.running) {
			return;
		}

		this.running = true;
		this.ensureJourneyState();
		this.trackCurrentUrl();

		this.flushInterval = setInterval(() => {
			this.flushReplay("interval");
		}, FLUSH_INTERVAL_MS);

		this.urlInterval = setInterval(() => {
			this.trackCurrentUrl();
		}, 1000);

		document.addEventListener("visibilitychange", this.boundVisibilityHandler);
		window.addEventListener("pagehide", this.boundPageHideHandler);
		window.addEventListener("beforeunload", this.boundBeforeUnloadHandler);
		document.addEventListener("click", this.boundClickHandler, true);
	}

	stop() {
		this.running = false;

		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}

		if (this.urlInterval) {
			clearInterval(this.urlInterval);
			this.urlInterval = null;
		}

		document.removeEventListener("visibilitychange", this.boundVisibilityHandler);
		window.removeEventListener("pagehide", this.boundPageHideHandler);
		window.removeEventListener("beforeunload", this.boundBeforeUnloadHandler);
		document.removeEventListener("click", this.boundClickHandler, true);

		this.rageClickBuckets = new Map();
		this.rageClicks = 0;
		this.urlHistory = [];
		this.lastTrackedUrl = null;
		this.journeyId = null;
		this.journeyStartedAt = null;
		this.journeySegmentIndex = 0;
		this.previousReplayId = null;
	}

	loadJourneyState() {
		try {
			const raw = sessionStorage.getItem(JOURNEY_STATE_KEY);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== "object") return null;
			return parsed;
		} catch (error) {
			return null;
		}
	}

	persistJourneyState() {
		try {
			sessionStorage.setItem(
				JOURNEY_STATE_KEY,
				JSON.stringify({
					journeyId: this.journeyId,
					journeyStartedAt: this.journeyStartedAt,
					journeySegmentIndex: this.journeySegmentIndex,
					previousReplayId: this.previousReplayId,
					lastActivityAt: Date.now(),
				}),
			);
		} catch (error) {}
	}

	getNavigationType() {
		try {
			if (typeof performance === "undefined" || typeof performance.getEntriesByType !== "function") {
				return "navigate";
			}

			const entries = performance.getEntriesByType("navigation");
			const entry = entries && entries.length > 0 ? entries[0] : null;
			if (entry && entry.type) {
				return entry.type;
			}
		} catch (error) {}
		return "navigate";
	}

	ensureJourneyState() {
		const now = Date.now();
		const current = this.loadJourneyState();
		const lastActivityAt = Number(current?.lastActivityAt || 0);
		const shouldRenew = !current?.journeyId || !lastActivityAt || now - lastActivityAt > JOURNEY_IDLE_TIMEOUT_MS;

		if (shouldRenew) {
			this.journeyId = generateId();
			this.journeyStartedAt = new Date(now).toISOString();
			this.journeySegmentIndex = 0;
			this.previousReplayId = null;
		} else {
			this.journeyId = current.journeyId;
			this.journeyStartedAt = current.journeyStartedAt || new Date(now).toISOString();
			this.journeySegmentIndex = Number(current.journeySegmentIndex || 0);
			this.previousReplayId = current.previousReplayId || null;
		}

		this.navigationType = this.getNavigationType();
		this.persistJourneyState();
	}

	handleVisibilityChange() {
		if (document.visibilityState === "hidden") {
			this.flushReplay("visibility_hidden");
		}
	}

	handlePageHide() {
		this.flushReplay("page_hide");
	}

	handleBeforeUnload() {
		this.flushReplay("before_unload");
	}

	handleClick(event) {
		try {
			if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
				return;
			}

			const gridX = Math.floor(event.clientX / RAGE_CLICK_GRID_SIZE);
			const gridY = Math.floor(event.clientY / RAGE_CLICK_GRID_SIZE);
			const key = `${gridX}:${gridY}`;
			const now = Date.now();

			const existing = this.rageClickBuckets.get(key) || [];
			const fresh = existing.filter((t) => now - t <= RAGE_CLICK_WINDOW_MS);
			fresh.push(now);
			this.rageClickBuckets.set(key, fresh);

			if (fresh.length === RAGE_CLICK_THRESHOLD) {
				this.rageClicks += 1;
				StreamedEvent.getInstance().logEvent("rageClick", {
					x: event.clientX,
					y: event.clientY,
					url: window.location.href,
				});
			}
		} catch (error) {}
	}

	trackCurrentUrl() {
		try {
			const currentUrl = window.location.href;
			if (!currentUrl || currentUrl === this.lastTrackedUrl) {
				return;
			}

			this.lastTrackedUrl = currentUrl;
			this.urlHistory.push(currentUrl);

			if (this.urlHistory.length > MAX_URL_HISTORY) {
				this.urlHistory = this.urlHistory.slice(-MAX_URL_HISTORY);
			}
		} catch (error) {}
	}

	flushReplay(reason = "manual") {
		if (!this.running || !this.enabled) {
			return;
		}

		const ReplayRecorder = ModuleRegistry.get("ReplayRecorder");
		if (!ReplayRecorder) {
			return;
		}

		const recorder = ReplayRecorder.getInstance();
		const replayData = recorder.getReplayData();
		const events = replayData?.events || [];

		if (!events || events.length < 20) {
			return;
		}

		this.sendReplay(replayData, reason);
		recorder.start();
		this.rageClickBuckets = new Map();
		this.rageClicks = 0;
		this.urlHistory = this.lastTrackedUrl ? [this.lastTrackedUrl] : [];
	}

	buildSignalSummary(replayData) {
		const events = replayData?.events || [];
		let replayClickCount = 0;
		let inputCount = 0;
		let scrollCount = 0;

		for (let i = 0; i < events.length; i++) {
			const ev = events[i];
			if (!ev || ev.type !== 3 || !ev.data) continue;
			if (ev.data.source === 2) replayClickCount++;
			if (ev.data.source === 5) inputCount++;
			if (ev.data.source === 3) scrollCount++;
		}

		const streamedEvents = StreamedEvent.getInstance().getEventArray() || [];
		const consoleLogs = ConsoleLogManager.getInstance().getLogs() || [];
		const networkRequests = NetworkIntercepter.getInstance().getRequests() || [];
		const consoleErrors = consoleLogs.filter((log) => log?.priority === "ERROR").length;
		const networkErrors = networkRequests.filter((request) => request?.success === false).length;
		const customEventCount = streamedEvents.filter((ev) => ev?.name && !["sessionStart", "pageView", "rageClick"].includes(ev.name)).length;

		return {
			rageClicks: this.rageClicks,
			replayClickCount,
			inputCount,
			scrollCount,
			consoleErrors,
			networkErrors,
			customEventCount,
		};
	}

	sendReplay(replayData, reason) {
		try {
			if (!Session.getInstance().ready) {
				return;
			}

			this.ensureJourneyState();
			const clientReplayId = generateId();
			const nextSegmentIndex = this.journeySegmentIndex + 1;

			const http = new XMLHttpRequest();
			http.open("POST", Session.getInstance().apiUrl + "/sdk/replays");
			http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
			Session.getInstance().injectSession(http);

			http.send(
				JSON.stringify({
					clientReplayId,
					webReplay: replayData,
					reason,
					urlHistory: this.urlHistory,
					sessionJourneyId: this.journeyId,
					segmentIndex: nextSegmentIndex,
					previousReplayId: this.previousReplayId,
					navigationType: this.navigationType,
					journeyStartedAt: this.journeyStartedAt,
					signalSummary: this.buildSignalSummary(replayData),
				}),
			);

			this.journeySegmentIndex = nextSegmentIndex;
			this.previousReplayId = clientReplayId;
			this.persistJourneyState();
		} catch (error) {}
	}
}

ModuleRegistry.register("ReplayManager", ReplayManager);
