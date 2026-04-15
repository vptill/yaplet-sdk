import ConsoleLogManager from "./ConsoleLogManager";
import NetworkIntercepter from "./NetworkIntercepter";
import Session from "./Session";
import StreamedEvent from "./StreamedEvent";
import ModuleRegistry from "./ModuleRegistry";
import { evaluatePageRules } from "./RuleEvaluator";

const FLUSH_INTERVAL_MS = 60000;
const RAGE_CLICK_WINDOW_MS = 1200;
const RAGE_CLICK_THRESHOLD = 3;
const RAGE_CLICK_GRID_SIZE = 40;
const MAX_URL_HISTORY = 20;
const JOURNEY_STATE_KEY = "yaplet-replay-journey";
const JOURNEY_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const IDLE_THRESHOLD_MS = 30000;

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
	paused = false;
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
	boundUserActivityHandler = null;
	replayRules = null;
	idleMs = 0;
	lastIdleCheck = 0;
	lastUserActivity = 0;

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
		this.boundUserActivityHandler = this.handleUserActivity.bind(this);
	}

	updateFromConfig(flowConfig) {
		const shouldEnable = !!flowConfig?.enableWebReplays;
		this.enabled = shouldEnable;
		this.replayRules = flowConfig?.replayRules || null;

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

		// Check page rules before starting
		if (this.replayRules?.pageQuery?.children?.length > 0) {
			const matches = evaluatePageRules(this.replayRules.pageQuery, window.location.href);
			if (!matches) {
				// Page doesn't match — don't start, but stay enabled for future URL changes
				this.startUrlMonitoring();
				return;
			}
		}

		this.running = true;
		this.paused = false;
		this.lastIdleCheck = Date.now();
		this.lastUserActivity = Date.now();
		this.idleMs = 0;
		this.ensureJourneyState();
		this.trackCurrentUrl();

		const ReplayRecorder = ModuleRegistry.get("ReplayRecorder");
		if (ReplayRecorder) {
			ReplayRecorder.getInstance().start();
		}

		this.flushInterval = setInterval(() => {
			this.flushReplay("interval");
		}, FLUSH_INTERVAL_MS);

		this.startUrlMonitoring();

		document.addEventListener("visibilitychange", this.boundVisibilityHandler);
		window.addEventListener("pagehide", this.boundPageHideHandler);
		window.addEventListener("beforeunload", this.boundBeforeUnloadHandler);
		document.addEventListener("click", this.boundClickHandler, true);

		const activityOpts = { capture: true, passive: true };
		document.addEventListener("mousemove", this.boundUserActivityHandler, activityOpts);
		document.addEventListener("keydown", this.boundUserActivityHandler, activityOpts);
		document.addEventListener("click", this.boundUserActivityHandler, activityOpts);
		window.addEventListener("scroll", this.boundUserActivityHandler, activityOpts);
		document.addEventListener("touchstart", this.boundUserActivityHandler, activityOpts);
	}

	startUrlMonitoring() {
		if (this.urlInterval) return;
		this.urlInterval = setInterval(() => {
			this.trackCurrentUrl();
			this.trackIdle();
		}, 1000);
	}

	stopUrlMonitoring() {
		if (this.urlInterval) {
			clearInterval(this.urlInterval);
			this.urlInterval = null;
		}
	}

	stop() {
		this.running = false;
		this.paused = false;

		const ReplayRecorder = ModuleRegistry.get("ReplayRecorder");
		if (ReplayRecorder) {
			ReplayRecorder.getInstance().stop();
		}

		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}

		this.stopUrlMonitoring();

		document.removeEventListener("visibilitychange", this.boundVisibilityHandler);
		window.removeEventListener("pagehide", this.boundPageHideHandler);
		window.removeEventListener("beforeunload", this.boundBeforeUnloadHandler);
		document.removeEventListener("click", this.boundClickHandler, true);

		const activityOpts = { capture: true, passive: true };
		document.removeEventListener("mousemove", this.boundUserActivityHandler, activityOpts);
		document.removeEventListener("keydown", this.boundUserActivityHandler, activityOpts);
		document.removeEventListener("click", this.boundUserActivityHandler, activityOpts);
		window.removeEventListener("scroll", this.boundUserActivityHandler, activityOpts);
		document.removeEventListener("touchstart", this.boundUserActivityHandler, activityOpts);

		this.rageClickBuckets = new Map();
		this.rageClicks = 0;
		this.urlHistory = [];
		this.lastTrackedUrl = null;
		this.journeyId = null;
		this.journeyStartedAt = null;
		this.journeySegmentIndex = 0;
		this.previousReplayId = null;
		this.idleMs = 0;
		this.lastIdleCheck = 0;
		this.lastUserActivity = 0;
	}

	/**
	 * Pause recording — stops rrweb but preserves journey state for resume.
	 * Called when URL no longer matches page rules.
	 */
	pause() {
		if (!this.running || this.paused) return;

		this.flushReplay("pause");

		const ReplayRecorder = ModuleRegistry.get("ReplayRecorder");
		if (ReplayRecorder) {
			ReplayRecorder.getInstance().stop();
		}

		this.paused = true;
		this.running = false;

		if (this.flushInterval) {
			clearInterval(this.flushInterval);
			this.flushInterval = null;
		}

		document.removeEventListener("visibilitychange", this.boundVisibilityHandler);
		window.removeEventListener("pagehide", this.boundPageHideHandler);
		window.removeEventListener("beforeunload", this.boundBeforeUnloadHandler);
		document.removeEventListener("click", this.boundClickHandler, true);

		const activityOpts = { capture: true, passive: true };
		document.removeEventListener("mousemove", this.boundUserActivityHandler, activityOpts);
		document.removeEventListener("keydown", this.boundUserActivityHandler, activityOpts);
		document.removeEventListener("click", this.boundUserActivityHandler, activityOpts);
		window.removeEventListener("scroll", this.boundUserActivityHandler, activityOpts);
		document.removeEventListener("touchstart", this.boundUserActivityHandler, activityOpts);

		// Persist journey state with paused flag so we can resume
		this.persistJourneyState(true);
	}

	/**
	 * Resume recording within the same journey after pause.
	 * Called when URL matches page rules again (within idle timeout).
	 */
	resume() {
		if (this.running || !this.paused || !this.enabled) return;

		// Check idle timeout — if too long since last activity, start fresh
		const state = this.loadJourneyState();
		const lastActivityAt = Number(state?.lastActivityAt || 0);
		if (!lastActivityAt || Date.now() - lastActivityAt > JOURNEY_IDLE_TIMEOUT_MS) {
			// Journey expired — start a fresh one
			this.paused = false;
			this.journeyId = null;
			this.start();
			return;
		}

		this.paused = false;
		this.running = true;
		this.lastIdleCheck = Date.now();
		this.lastUserActivity = Date.now();
		this.idleMs = 0;

		const ReplayRecorder = ModuleRegistry.get("ReplayRecorder");
		if (ReplayRecorder) {
			ReplayRecorder.getInstance().start();
		}

		this.flushInterval = setInterval(() => {
			this.flushReplay("interval");
		}, FLUSH_INTERVAL_MS);

		document.addEventListener("visibilitychange", this.boundVisibilityHandler);
		window.addEventListener("pagehide", this.boundPageHideHandler);
		window.addEventListener("beforeunload", this.boundBeforeUnloadHandler);
		document.addEventListener("click", this.boundClickHandler, true);

		const activityOpts = { capture: true, passive: true };
		document.addEventListener("mousemove", this.boundUserActivityHandler, activityOpts);
		document.addEventListener("keydown", this.boundUserActivityHandler, activityOpts);
		document.addEventListener("click", this.boundUserActivityHandler, activityOpts);
		window.addEventListener("scroll", this.boundUserActivityHandler, activityOpts);
		document.addEventListener("touchstart", this.boundUserActivityHandler, activityOpts);

		this.persistJourneyState(false);
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

	persistJourneyState(paused = false) {
		try {
			sessionStorage.setItem(
				JOURNEY_STATE_KEY,
				JSON.stringify({
					journeyId: this.journeyId,
					journeyStartedAt: this.journeyStartedAt,
					journeySegmentIndex: this.journeySegmentIndex,
					previousReplayId: this.previousReplayId,
					lastActivityAt: Date.now(),
					paused,
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
		this.persistJourneyState(false);
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

	handleUserActivity() {
		this.lastUserActivity = Date.now();
	}

	trackCurrentUrl() {
		try {
			const currentUrl = window.location.href;
			if (!currentUrl || currentUrl === this.lastTrackedUrl) {
				return;
			}

			this.lastTrackedUrl = currentUrl;

			// Evaluate page rules on URL change
			if (this.replayRules?.pageQuery?.children?.length > 0) {
				const matches = evaluatePageRules(this.replayRules.pageQuery, currentUrl);

				if (!matches && this.running && !this.paused) {
					this.pause();
					return;
				}

				if (matches && !this.running) {
					if (this.paused) {
						this.resume();
					} else {
						// First time URL matches — start recording
						this.start();
					}
				}
			}

			if (this.running) {
				this.urlHistory.push(currentUrl);
				if (this.urlHistory.length > MAX_URL_HISTORY) {
					this.urlHistory = this.urlHistory.slice(-MAX_URL_HISTORY);
				}
			}
		} catch (error) {}
	}

	/**
	 * Track idle time — called every 1s from urlInterval.
	 * Increments idleMs when no user interaction for > IDLE_THRESHOLD_MS.
	 */
	trackIdle() {
		if (!this.running || this.paused) return;

		try {
			const now = Date.now();

			if (this.lastUserActivity && now - this.lastUserActivity > IDLE_THRESHOLD_MS) {
				const elapsed = now - this.lastIdleCheck;
				this.idleMs += elapsed;
			}

			this.lastIdleCheck = now;
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

			// Handle server response
			http.onload = () => {
				try {
					const response = JSON.parse(http.responseText);
					if (response?.skipped) {
						if (response.reason === "rules_not_matched" || response.reason === "ceiling_reached") {
							this.stop();
						}
					}
				} catch (e) {}
			};

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
					idleMs: this.idleMs,
				}),
			);

			this.journeySegmentIndex = nextSegmentIndex;
			this.previousReplayId = clientReplayId;
			this.idleMs = 0;
			this.persistJourneyState(false);
		} catch (error) {}
	}
}

ModuleRegistry.register("ReplayManager", ReplayManager);
