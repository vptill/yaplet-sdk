import FeedbackButtonManager from "./FeedbackButtonManager";
import ConfigManager from "./ConfigManager";
import FrameManager from "./FrameManager";
import Session from "./Session";
import AudioManager from "./AudioManager";
import TranslationManager from "./TranslationManager";
import EventManager from "./EventManager";
import { loadFromYapletCache, saveToYapletCache } from "./Helper";
import { loadIcon } from "./UI";
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

export default class NotificationManager {
	notificationContainer = null;
	notifications = [];
	unreadCount = 0;
	unreadNotificationsKey = "unread-notifications";
	isTabActive = true;
	showNotificationBadge = true;

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

		// Append close button.
		const clearElem = document.createElement("div");
		clearElem.onclick = () => {
			this.clearAllNotifications();
		};
		clearElem.className = "yaplet-notification-close";
		clearElem.innerHTML = loadIcon("dismiss");
		this.notificationContainer.appendChild(clearElem);

		// Render the notifications.
		for (var i = 0; i < this.notifications.length; i++) {
			const notification = this.notifications[i];

			// Add timestamp when notification is rendered if not already set
			if (!notification.shownAt) {
				notification.shownAt = Date.now();
			}

			var content = notification.payload.message;

			// Try replacing the session name. The name is text (typed by the visitor or an agent),
			// so it is escaped before it goes into the HTML below.
			const nameHtml = plainTextHtml(Session.getInstance().getName());
			content = content.replaceAll("{{name}}", nameHtml);

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
				// Notification item.
				elem.className = "yaplet-notification-item";
				// The agent's picture is a storage path; the finished address is escaped like any image.
				elem.innerHTML = `
            ${
							notification.payload.agent && notification.payload.agent.picture
								? imageTagHtml(
										`https://api.yaplet.com/storage/v1/object/public/profile-picture/${notification.payload.agent.picture}`
								  )
								: ""
						}
            <div class="yaplet-notification-item-container">
                ${
									notification.payload.agent
										? `<div  class="yaplet-notification-item-sender">${escapeHtml(
													decodeSanitizerEntities(notification.payload.agent.username)
											  )}</div>`
										: ""
								}
                <div class="yaplet-notification-item-content">${content}</div>
            </div>`;
			}

			this.notificationContainer.appendChild(elem);
		}
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
