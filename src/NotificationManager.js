import FeedbackButtonManager from "./FeedbackButtonManager";
import ConfigManager from "./ConfigManager";
import FrameManager from "./FrameManager";
import Session from "./Session";
import AudioManager from "./AudioManager";
import TranslationManager from "./TranslationManager";
import EventManager from "./EventManager";
import { loadFromYapletCache, saveToYapletCache } from "./Helper";
import { loadIcon, mascotSvg, calculateContrast } from "./UI";
import { getYaplet } from "./YapletRuntime";

// Local copies of the helpers in Tours.js: importing Tours.js here would pull the whole tour
// engine out of its lazily loaded chunk into the main bundle.
// Escapes the five HTML-special characters so a value written into innerHTML shows as text.
function escapeHtml(value) {
	return String(value == null ? "" : value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// The server cleans plain-text fields with sanitize-html, which stores & < > " as entities.
// Decode those four once before escapeHtml, so a name is not shown as "Tom &amp; Jerry".
const SANITIZER_ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"' };
function decodeSanitizerEntities(value) {
	return String(value == null ? "" : value).replace(
		/&(?:amp|lt|gt|quot);/g,
		(entity) => SANITIZER_ENTITIES[entity]
	);
}

// An image is shown only from an http: or https: address. Relative addresses resolve against
// the current page; javascript:, data: and every other scheme are refused.
function isSafeNavigationUrl(value) {
	if (typeof value !== "string" || value.trim() === "") {
		return false;
	}
	try {
		const protocol = new URL(value, window.location.href).protocol;
		return protocol === "http:" || protocol === "https:";
	} catch (e) {
		return false;
	}
}

// A text value written into the pop-up: decoded once, then escaped, so it always shows as text.
function plainTextHtml(value) {
	return escapeHtml(decodeSanitizerEntities(value));
}

// An <img> tag, or "" when the address is missing or not http(s). escapeHtml keeps the address
// inside src="..." whatever it contains.
function imageTagHtml(url, className) {
	if (!isSafeNavigationUrl(url)) {
		return "";
	}
	const classAttribute = className ? ` class="${className}"` : "";
	return `<img${classAttribute} src="${escapeHtml(url)}" />`;
}

// A message pop-up (the quiet toast) tucks itself away this long after the newest one arrived; the count stays on
// the launcher. Hovering the pop-ups holds them.
const TOAST_TUCK_MS = 10000;
const TOAST_TUCK_AFTER_HOVER_MS = 4000;

// "AI assistant" in every language the widget speaks — the same words as the widget's "Vex · AI assistant" row
// (widget-solidjs/src/locales/*.json, `aiAssistantRole`; keep the two in step). EU AI Act Art. 50: the visitor is
// told in words that Vex is an AI before they answer it.
const AI_ASSISTANT_LABEL = {
	bg: "AI асистент", cs: "AI asistent", da: "AI-assistent", de: "AI-Assistent", el: "Βοηθός AI", en: "AI assistant",
	es: "Asistente AI", et: "AI-assistent", fi: "AI-avustaja", fil: "AI assistant", fr: "Assistant AI", ga: "Cúntóir AI",
	hi: "AI सहायक", hr: "AI asistent", hu: "AI asszisztens", id: "Asisten AI", it: "Assistente AI", ja: "AIアシスタント",
	ko: "AI 어시스턴트", lt: "AI asistentas", lv: "AI asistents", ms: "Pembantu AI", mt: "Assistent AI", nl: "AI-assistent",
	no: "AI-assistent", pl: "Asystent AI", pt: "Assistente AI", ro: "Asistent AI", ru: "AI-ассистент", sk: "AI asistent",
	sl: "AI asistent", sr: "AI asistent", sv: "AI-assistent", th: "ผู้ช่วย AI", tr: "AI asistan", uk: "AI-асистент",
	vi: "Trợ lý AI", zh: "AI助手",
};
const LANGUAGE_ALIASES = { nb: "no", nn: "no", tl: "fil" };

function aiAssistantLabel() {
	const language = String(TranslationManager.getInstance().getActiveLanguage() || "en").toLowerCase();
	const base = language.split(/[-_]/)[0];
	return AI_ASSISTANT_LABEL[language] || AI_ASSISTANT_LABEL[LANGUAGE_ALIASES[base] || base] || AI_ASSISTANT_LABEL.en;
}

// A message as one line of plain text: the stored HTML (an AI answer, an outreach message) without its tags, with
// block ends turned into spaces so "Hi!<br>Sure" does not read "Hi!Sure". DOMParser builds an inert document: no
// script runs and nothing loads. Hidden product data lives in an attribute, so it never shows as text.
function plainTextOf(html) {
	const spaced = String(html == null ? "" : html).replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, " $&");
	let text = "";
	try {
		text = new DOMParser().parseFromString(spaced, "text/html").body.textContent || "";
	} catch (e) {
		text = spaced.replace(/<[^>]*>/g, " ");
	}
	return text.replace(/\s+/g, " ").trim();
}

function initialsOf(name) {
	const words = String(name || "").trim().split(/\s+/).filter(Boolean);
	return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("") || "?";
}

// Who wrote a message pop-up: a teammate (photo or initials, and their name), Vex (nobody human — an AI reply, a
// workflow message, an outreach message: the widget's thread shows these as Vex too), or nobody named (a pop-up a
// site raises itself through Yaplet.showNotification()).
function senderOf(notification) {
	const payload = notification.payload || {};
	if (payload.agent) {
		return { kind: "agent", key: "agent:" + (payload.agent.id || payload.agent.username || ""), agent: payload.agent };
	}
	if (!payload.visitor_id && (notification.event === "NEW_MESSAGE" || notification.event === "message")) {
		return { kind: "vex", key: "vex" };
	}
	return { kind: "none", key: "none" };
}

// Vex's face: the blob in the launcher's own paint, the same colors the mascot launcher and the widget's thread give it.
function vexFaceHtml() {
	const flowConfig = ConfigManager.getInstance().getFlowConfig() || {};
	const launcherColor = flowConfig.primaryColor || "#485BFF";
	return mascotSvg(
		launcherColor,
		flowConfig.feedbackButtonGradient || null,
		flowConfig.feedbackButtonIconColor || calculateContrast(launcherColor),
		"avatar"
	);
}

function faceHtml(sender) {
	if (sender.kind === "vex") {
		return vexFaceHtml();
	}
	if (sender.kind === "agent") {
		// The agent's picture is a storage path; the finished address is escaped like any image.
		const photo = sender.agent.picture
			? imageTagHtml(
					`https://api.yaplet.com/storage/v1/object/public/profile-picture/${sender.agent.picture}`,
					"yaplet-notification-toast-face"
			  )
			: "";
		return (
			photo ||
			`<span class="yaplet-notification-toast-face yaplet-notification-toast-initials" aria-hidden="true">${escapeHtml(
				initialsOf(decodeSanitizerEntities(sender.agent.username))
			)}</span>`
		);
	}
	return "";
}

function nameLineHtml(sender) {
	if (sender.kind === "vex") {
		return `<div class="yaplet-notification-toast-name"><b>Vex</b> · ${escapeHtml(aiAssistantLabel())}</div>`;
	}
	if (sender.kind === "agent") {
		return `<div class="yaplet-notification-toast-name"><b>${plainTextHtml(sender.agent.username)}</b></div>`;
	}
	return "";
}

export default class NotificationManager {
	notificationContainer = null;
	notifications = [];
	unreadCount = 0;
	unreadNotificationsKey = "unread-notifications";
	isTabActive = true;
	showNotificationBadge = true;
	// Pop-ups already slid in once in this page view; a re-render draws them without the slide.
	shownToasts = new WeakSet();
	tuckTimer = null;
	pointerOnToasts = false;

	// NotificationManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new NotificationManager();
		}
		return this.instance;
	}

	constructor() {}

	updateTabBarNotificationCount() {
		EventManager.notifyEvent("unread-count-changed", this.unreadCount);
	}

	/**
	 * Injects the feedback button into the current DOM.
	 */
	injectNotificationUI() {
		if (this.notificationContainer) {
			return;
		}

		var elem = document.createElement("div");
		elem.className = "yaplet-notification-container yaplet-font";
		// While the pointer is on the pop-ups they stay; they tuck away a little after it leaves.
		elem.addEventListener("mouseenter", () => {
			this.pointerOnToasts = true;
			clearTimeout(this.tuckTimer);
		});
		elem.addEventListener("mouseleave", () => {
			this.pointerOnToasts = false;
			this.scheduleTuck(TOAST_TUCK_AFTER_HOVER_MS);
		});
		document.body.appendChild(elem);
		this.notificationContainer = elem;

		this.updateContainerStyle();
		this.reloadNotificationsFromCache();
	}

	reloadNotificationsFromCache() {
		// Load persisted notifications.
		const notificationsFromCache = loadFromYapletCache(
			this.unreadNotificationsKey
		);
		if (notificationsFromCache && notificationsFromCache.length > 0) {
			if (notificationsFromCache.length > 2) {
				this.notifications = notificationsFromCache.splice(
					0,
					notificationsFromCache.length - 2
				);
			} else {
				this.notifications = notificationsFromCache;
			}
			this.renderNotifications();
		}
	}

	setNotificationCount(unreadCount) {
		if (FrameManager.getInstance().isOpened()) {
			this.unreadCount = 0;
			this.updateTabBarNotificationCount();
		} else {
			this.unreadCount = unreadCount;
		}

		this.updateTabBarNotificationCount();

		// Update the badge counter.
		FeedbackButtonManager.getInstance().updateNotificationBadge(
			this.unreadCount
		);
	}

	showNotification(notification) {
		if (!(this.notificationContainer && notification && notification.payload)) {
			return;
		}

		if (notification.event === "NEW_MESSAGE") {
			// Only a real message from our side pops up. The realtime server also sends status lines ("Patrick
			// joined", a rating request: type EVENT) and the visitor's own messages; neither is news to the visitor.
			if ((notification.payload.type && notification.payload.type !== "MESSAGE") || notification.payload.visitor_id) {
				return;
			}
			// A message with no words (an image only) counts on the launcher but gets no empty pop-up.
			if (!plainTextOf(notification.payload.message)) {
				this.setNotificationCount(this.unreadCount + 1);
				return;
			}
		}

		const notificationsForOutbound = this.notifications.find(
			(e) => notification.payload.outbound === e.outbound
		);
		if (!notificationsForOutbound) {
			// Add timestamp when notification is first shown
			notification.shownAt = Date.now();
			this.notifications.push(notification);

			// Play sound only when no existing already.
			//if (notification.sound) {
			AudioManager.ping();
			//}
		}
		if (this.notifications.length > 2) {
			this.notifications.shift();
		}

		this.setNotificationCount(this.unreadCount + 1);

		// Persist notifications.
		saveToYapletCache(this.unreadNotificationsKey, this.notifications);

		this.renderNotifications();
	}

	renderNotifications() {
		if (!this.notificationContainer) {
			return;
		}

		// Clear the existing notifications.
		this.clearAllNotifications(true);

		// The round close button above the list is for news pop-ups only; every message pop-up has its own.
		if (this.notifications.some((n) => n.payload && n.payload.news)) {
			const clearElem = document.createElement("div");
			clearElem.onclick = () => {
				this.clearAllNotifications();
			};
			clearElem.className = "yaplet-notification-close";
			clearElem.innerHTML = loadIcon("dismiss");
			this.notificationContainer.appendChild(clearElem);
		}
		let previousSenderKey = null;
		let hasToasts = false;

		// Render the notifications.
		for (var i = 0; i < this.notifications.length; i++) {
			const notification = this.notifications[i];

			// Add timestamp when notification is rendered if not already set
			if (!notification.shownAt) {
				notification.shownAt = Date.now();
			}

			// The session name for "{{name}}". It is text (typed by the visitor or an agent), so it is escaped
			// before it goes into the news pop-up's HTML.
			const nameHtml = plainTextHtml(Session.getInstance().getName());

			const elem = document.createElement("div");
			elem.onclick = () => {
				const timeToClick = Date.now() - notification.shownAt;
				if (notification.event === "message" && notification.payload.id) {
					FrameManager.getInstance().sendMessage(
						{
							name: "notification-clicked",
							data: {
								time_to_click: timeToClick,
								id: notification.payload.id,
							},
						},
						true
					);
				}
			const yaplet = getYaplet();
			if (!yaplet) {
				return;
			}

			if (notification.payload.chat) {
				yaplet.openConversation(notification.payload.chat.id, true);
			} else if (notification.payload.news) {
				yaplet.openNewsArticle(notification.data.news.id, true);
			} else {
				yaplet.open();
			}
			};

			if (notification.payload.news) {
				// The news pop-up is drawn on the customer's own page, not inside Yaplet's frame:
				// every field is text or an http(s) image address, escaped here whatever arrives.
				const news = notification.data || {};
				const titleHtml = plainTextHtml(notification.payload.message).replaceAll(
					"{{name}}",
					nameHtml
				);

				const renderDescription = () => {
					if (news.previewText && news.previewText.length > 0) {
						return `<div class="yaplet-notification-item-news-preview">${plainTextHtml(
							news.previewText
						)}</div>`;
					}

					return `${
						news.sender
							? `
          <div class="yaplet-notification-item-news-sender">
            ${imageTagHtml(news.sender.profileImageUrl)} ${plainTextHtml(
									news.sender.name
							  )}</div>`
							: ""
					}`;
				};

				const coverImageHtml =
					typeof news.coverImageUrl === "string" &&
					!news.coverImageUrl.includes("NewsImagePlaceholder")
						? imageTagHtml(
								news.coverImageUrl,
								"yaplet-notification-item-news-image"
						  )
						: "";

				// News preview
				elem.className = "yaplet-notification-item-news";
				elem.innerHTML = `
        <div class="yaplet-notification-item-news-container">
          ${coverImageHtml}
          <div class="yaplet-notification-item-news-content">
          <div class="yaplet-notification-item-news-content-title">${titleHtml}</div>
          ${renderDescription()}
          </div>
        </div>`;
			} else {
				// A message pop-up: the quiet toast (UI.js). Plain text only; the face, the name and the close button
				// carry the rest.
				const sender = senderOf(notification);
				const repeat = sender.kind !== "none" && sender.key === previousSenderKey;
				previousSenderKey = sender.key;
				hasToasts = true;
				const text = plainTextOf(notification.payload.message).replaceAll(
					"{{name}}",
					Session.getInstance().getName() || ""
				);
				const slideIn = !this.shownToasts.has(notification);
				this.shownToasts.add(notification);

				elem.className =
					"yaplet-notification-item yaplet-notification-toast" + (slideIn ? " yaplet-notification-toast--enter" : "");
				// A second message from the same sender keeps the face's column but not the face and the name.
				const face = repeat
					? '<span class="yaplet-notification-toast-face" aria-hidden="true"></span>'
					: faceHtml(sender);
				elem.innerHTML = `${face}<div class="yaplet-notification-toast-body">${
					repeat ? "" : nameLineHtml(sender)
				}<div class="yaplet-notification-toast-text">${escapeHtml(
					text
				)}</div></div><button type="button" class="yaplet-notification-toast-close" aria-label="Close">${loadIcon(
					"dismiss"
				)}</button>`;
				elem.querySelector(".yaplet-notification-toast-close").onclick = (event) => {
					event.stopPropagation();
					this.dismissNotification(notification);
				};
			}

			this.notificationContainer.appendChild(elem);
		}

		if (hasToasts) {
			this.scheduleTuck(TOAST_TUCK_MS);
		}
	}

	/** Closes one message pop-up (its own close button); the others stay. */
	dismissNotification(notification) {
		this.notifications = this.notifications.filter((n) => n !== notification);
		saveToYapletCache(this.unreadNotificationsKey, this.notifications);
		this.renderNotifications();
	}

	scheduleTuck(delay) {
		clearTimeout(this.tuckTimer);
		if (
			this.pointerOnToasts ||
			!this.notificationContainer ||
			!this.notificationContainer.querySelector(".yaplet-notification-toast")
		) {
			return;
		}
		this.tuckTimer = setTimeout(() => this.tuckAway(), delay);
	}

	/** The message pop-ups slide away and are forgotten (news pop-ups stay); the count stays on the launcher. */
	tuckAway() {
		if (!this.notificationContainer) {
			return;
		}
		const toasts = this.notificationContainer.querySelectorAll(".yaplet-notification-toast");
		if (!toasts.length) {
			return;
		}
		for (let i = 0; i < toasts.length; i++) {
			toasts[i].classList.add("yaplet-notification-toast--leave");
		}
		setTimeout(() => {
			this.notifications = this.notifications.filter((n) => n.payload && n.payload.news);
			saveToYapletCache(this.unreadNotificationsKey, this.notifications);
			this.renderNotifications();
		}, 350);
	}

	clearAllNotifications(uiOnly = false) {
		if (!this.notificationContainer) {
			return;
		}

		if (!uiOnly) {
			this.notifications = [];
			saveToYapletCache(this.unreadNotificationsKey, this.notifications);
		}

		while (this.notificationContainer.firstChild) {
			this.notificationContainer.removeChild(
				this.notificationContainer.firstChild
			);
		}
	}

	updateContainerStyle() {
		if (!this.notificationContainer) {
			return;
		}

		const flowConfig = ConfigManager.getInstance().getFlowConfig();
		const classLeft = "yaplet-notification-container--left";
		const classNoButton = "yaplet-notification-container--no-button";
		this.notificationContainer.classList.remove(classLeft);
		this.notificationContainer.classList.remove(classNoButton);
		if (
			flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_CLASSIC_LEFT ||
			flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_BOTTOM_LEFT
		) {
			this.notificationContainer.classList.add(classLeft);
		}

		if (FeedbackButtonManager.getInstance().buttonHidden === null) {
			if (
				flowConfig.feedbackButtonPosition ===
				FeedbackButtonManager.FEEDBACK_BUTTON_NONE
			) {
				this.notificationContainer.classList.add(classNoButton);
			}
		} else {
			if (FeedbackButtonManager.getInstance().buttonHidden) {
				this.notificationContainer.classList.add(classNoButton);
			}
		}

		this.notificationContainer.setAttribute(
			"dir",
			TranslationManager.getInstance().isRTLLayout ? "rtl" : "ltr"
		);
	}
}
