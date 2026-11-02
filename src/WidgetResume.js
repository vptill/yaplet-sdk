import Session from "./Session";

/**
 * Remembers where the visitor was in the chat widget, so it picks up where they left it.
 *
 * Two things are kept, each in its own storage:
 *   - the SCREEN they were on (home, the chat, a help article, a news post, the roadmap) —
 *     in localStorage, so it is shared by every tab of the site;
 *   - whether the widget was OPEN when the page went away — in sessionStorage, so only the
 *     same tab reopens it after following a link. A new tab, or a visit after closing the
 *     tab, never pops the widget open by itself.
 *
 * Both count only for RESUME_WINDOW_MS after the visitor last had the widget in front of
 * them. After that the widget starts fresh, as it always did.
 *
 * Storage can be blocked (privacy modes, some embeds); every access is guarded and a
 * failure simply means "nothing remembered".
 */
export const RESUME_WINDOW_MS = 30 * 60 * 1000;

const SCREEN_KEY = "yaplet-widget-screen-";
const OPEN_KEY = "yaplet-widget-open-";
const TABS = ["HOME", "CHAT", "KNOWLEDGEBASE", "NEWS", "ROADMAP"];

const storageKey = (prefix) => prefix + (Session.getInstance().sdkKey || "");

const read = (storage, prefix) => {
	try {
		const raw = storage.getItem(storageKey(prefix));
		const value = raw ? JSON.parse(raw) : null;
		if (!value || typeof value.at !== "number") {
			return null;
		}
		if (Date.now() - value.at > RESUME_WINDOW_MS) {
			storage.removeItem(storageKey(prefix));
			return null;
		}
		return value;
	} catch (e) {
		return null;
	}
};

const write = (storage, prefix, value) => {
	try {
		if (value) {
			storage.setItem(storageKey(prefix), JSON.stringify({ ...value, at: Date.now() }));
		} else {
			storage.removeItem(storageKey(prefix));
		}
	} catch (e) { }
};

const cleanId = (value) =>
	typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null;

/** Only the fields the widget understands, so nothing else ever reaches the iframe URL. */
const cleanScreen = (screen) => {
	if (!screen || TABS.indexOf(screen.tab) === -1) {
		return null;
	}
	const clean = { tab: screen.tab };
	const article = screen.tab === "KNOWLEDGEBASE" ? cleanId(screen.article) : null;
	const news = screen.tab === "NEWS" ? cleanId(screen.news) : null;
	if (article) clean.article = article;
	if (news) clean.news = news;
	return clean;
};

export default class WidgetResume {
	/** The widget reported a new screen. */
	static saveScreen(screen) {
		const clean = cleanScreen(screen);
		if (clean) {
			write(localStorage, SCREEN_KEY, clean);
		}
	}

	/** The screen to reopen on, or null when there is none or it is too old. */
	static loadScreen() {
		if (typeof localStorage === "undefined") {
			return null;
		}
		return cleanScreen(read(localStorage, SCREEN_KEY));
	}

	/**
	 * Restarts the clock on the remembered screen — the visitor just had it in front of them
	 * (closing the widget, or leaving the page with it open).
	 */
	static touchScreen() {
		const screen = WidgetResume.loadScreen();
		if (screen) {
			write(localStorage, SCREEN_KEY, screen);
		}
	}

	static setOpen(open) {
		if (typeof sessionStorage === "undefined") {
			return;
		}
		write(sessionStorage, OPEN_KEY, open ? { open: true } : null);
	}

	/** True when this tab had the widget open on the page it came from, recently. */
	static wasOpen() {
		if (typeof sessionStorage === "undefined") {
			return false;
		}
		const value = read(sessionStorage, OPEN_KEY);
		return !!(value && value.open);
	}
}
