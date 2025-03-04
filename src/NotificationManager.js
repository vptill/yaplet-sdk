import Yaplet, {
	FeedbackButtonManager,
	ConfigManager,
	FrameManager,
	Session,
	AudioManager,
	TranslationManager,
	EventManager,
} from "./Yaplet";
import { loadFromYapletCache, saveToYapletCache } from "./Helper";
import { loadIcon } from "./UI";

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

			var content = notification.payload.message;

			// Try replacing the session name.
			content = content.replaceAll("{{name}}", Session.getInstance().getName());

			const elem = document.createElement("div");
			elem.onclick = () => {
				if (notification.payload.chat) {
					Yaplet.openConversation(notification.payload.chat.id);
				} else if (notification.payload.news) {
					Yaplet.openNewsArticle(notification.data.news.id);
				} else if (notification.payload.checklist) {
					Yaplet.openChecklist(notification.data.checklist.id);
				} else {
					Yaplet.open();
				}
			};

			if (notification.payload.news) {
				const renderDescription = () => {
					if (
						notification.data.previewText &&
						notification.data.previewText.length > 0
					) {
						return `<div class="yaplet-notification-item-news-preview">${notification.data.previewText}</div>`;
					}

					return `${
						notification.data.sender
							? `
          <div class="yaplet-notification-item-news-sender">
            ${
							notification.data.sender.profileImageUrl &&
							`<img src="${notification.data.sender.profileImageUrl}" />`
						} ${notification.data.sender.name}</div>`
							: ""
					}`;
				};

				// News preview
				elem.className = "yaplet-notification-item-news";
				elem.innerHTML = `
        <div class="yaplet-notification-item-news-container">
          ${
						notification.data.coverImageUrl &&
						notification.data.coverImageUrl !== "" &&
						!notification.data.coverImageUrl.includes("NewsImagePlaceholder")
							? `<img class="yaplet-notification-item-news-image" src="${notification.data.coverImageUrl}" />`
							: ""
					}
          <div class="yaplet-notification-item-news-content">
          <div class="yaplet-notification-item-news-content-title">${content}</div>
          ${renderDescription()}
          </div>
        </div>`;
			} else if (notification.payload.checklist) {
				var progress = Math.round(
					(notification.data.currentStep / notification.data.totalSteps) * 100
				);
				if (progress < 100) {
					progress += 4;
				}

				// News preview
				elem.className = "yaplet-notification-item-checklist";
				elem.innerHTML = `
        <div class="yaplet-notification-item-checklist-container">
          <div class="yaplet-notification-item-checklist-content">
            <div class="yaplet-notification-item-checklist-content-title">${notification.data.text}</div>
            <div class="yaplet-notification-item-checklist-content-progress">
              <div class="yaplet-notification-item-checklist-content-progress-inner" style="width: ${progress}%;"></div>
            </div>
            <div class="yaplet-notification-item-checklist-content-next">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 12H20M20 12L14 6M20 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              ${notification.data.nextStepTitle}
            </div>
          </div>
        </div>`;
			} else {
				// Notification item.
				elem.className = "yaplet-notification-item";
				elem.innerHTML = `
            ${
							notification.payload.agent && notification.payload.agent.picture
								? `<img src="https://api.yaplet.com/storage/v1/object/public/profile-picture/${notification.payload.agent.picture}" />`
								: ""
						}
            <div class="yaplet-notification-item-container">
                ${
									notification.payload.agent
										? `<div  class="yaplet-notification-item-sender">${notification.payload.agent.username}</div>`
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
