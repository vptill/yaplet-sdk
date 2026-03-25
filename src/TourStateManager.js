const STORAGE_KEY = "yaplet-tour-state";
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Normalizes a URL to origin + pathname (no trailing slash, no query/hash).
 */
function normalizeUrl(url) {
	try {
		const parsed = new URL(url);
		return parsed.origin + parsed.pathname.replace(/\/$/, "");
	} catch {
		return url.replace(/[?#].*$/, "").replace(/\/$/, "");
	}
}

/**
 * Checks if a target URL matches the current page URL.
 * Compares origin + pathname only (ignores query params and hash).
 */
function urlMatchesCurrent(targetUrl) {
	try {
		return normalizeUrl(targetUrl) === normalizeUrl(window.location.href);
	} catch {
		return false;
	}
}

/**
 * Saves tour state to sessionStorage.
 * @param {Object} state - { tourId, config, currentStepIndex, startedAt, startUrl, navigatedByTour }
 */
function save(state) {
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch (e) {
		// sessionStorage unavailable or full — silently fail
	}
}

/**
 * Loads tour state from sessionStorage.
 * Returns null if missing, corrupt, or expired (30 min).
 */
function load() {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;

		const state = JSON.parse(raw);

		// Check expiry
		if (state.startedAt && Date.now() - state.startedAt > EXPIRY_MS) {
			clear();
			return null;
		}

		return state;
	} catch {
		clear();
		return null;
	}
}

/**
 * Removes tour state from sessionStorage.
 */
function clear() {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// silently fail
	}
}

/**
 * Returns true if a valid (non-expired) tour state exists.
 */
function isActive() {
	return load() !== null;
}

export default {
	save,
	load,
	clear,
	isActive,
	urlMatchesCurrent,
};
