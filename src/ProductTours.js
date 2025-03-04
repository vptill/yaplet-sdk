import { loadIcon } from "./UI";
import Tours from "./Tours";
import AdminManager from "./AdminManager";

export default class ProductTours {
	productTourData = undefined;
	productTourId = undefined;
	onCompletion = undefined;
	unmuted = false;

	// ReplayRecorder singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new ProductTours();
			return this.instance;
		} else {
			return this.instance;
		}
	}

	constructor() {}

	startWithConfig(tourId, config, onCompletion) {
		this.productTourId = tourId;
		this.productTourData = config;
		this.onCompletion = onCompletion;

		return this.start();
	}

	start() {
		const config = this.productTourData;
		if (!config || AdminManager.getInstance().adminHelper) {
			return;
		}

		this.unmuted = false;
		const steps = config.steps;
		const self = this;

		var driverSteps = [];

		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];

			const isClickMode = step.mode === "CLICK";
			const isInputMode = step.mode === "INPUT";

			var message = "";
			var hasSender = false;

			if (step.type === "video-pointer") {
				message = `<div class="yaplet-tour-video">
              <video class="yaplet-tour-video-obj" muted autoplay>
                <source src="${step.videoUrl}" type="video/mp4">
              </video>
              <div class="yaplet-tour-video-playpause">${loadIcon(
								"unmute"
							)}</div>
            </div>`;
			} else {
				var senderHTML = ``;

				if (config.sender && config.sender.firstName) {
					hasSender = true;
					senderHTML = `<div class="yaplet-tour-sender">
                <div class="yaplet-tour-sender-image" style="background-image: url('${config.sender.profileImageUrl}');"></div>
                <div class="yaplet-tour-sender-name">${config.sender.firstName}</div>
              </div>`;
				}

				message = `${senderHTML}<div class="yaplet-tour-message">${step.message}</div>`;
			}

			const disableInteraction = !isClickMode && !isInputMode;

			var driverStep = {
				disableActiveInteraction: disableInteraction,
				popover: {
					description: message,
					popoverClass: `yaplet-tour-popover-${step.type} ${
						!hasSender && "yaplet-tour-popover-no-sender"
					} ${config.allowClose && "yaplet-tour-popover-can-close"}`,
					...(isClickMode
						? {
								showButtons: [
									...(config.backButton ? ["previous"] : []),
									...(config.allowClose ? ["close"] : []),
								],
						  }
						: {}),
				},
				url: step.url,
			};
			if (step.selector && step.selector.length > 0) {
				driverStep.element = step.selector;
			}
			driverSteps.push(driverStep);
		}

		var buttons = ["next", "close"];

		if (config.backButton) {
			buttons.push("previous");
		}

		function onDocumentClick(evnt) {
			var yapletTourPopover = document.querySelector(".yaplet-tour-popover");
			if (!yapletTourPopover.contains(evnt.target)) {
				const stepIndex = yapletTourObj.getActiveIndex();
				const step = steps[stepIndex];
				const element = yapletTourObj.getActiveElement();

				if (
					(element && element.tagName === "INPUT") ||
					step.mode === "INPUT" ||
					evnt?.target?.id.includes("tooltip-svg")
				) {
					// Prevent.
				} else {
					yapletTourObj.moveNext();
				}
			}
		}

		const yapletTourObj = Tours({
			showProgress: true,
			steps: driverSteps,
			showProgress: steps.length > 1,
			allowClose: config.allowClose,
			nextBtnText: config.nextText,
			doneBtnText: config.doneText,
			prevBtnText: config.prevText,
			showButtons: buttons,
			onDestroyStarted: () => {
				if (!yapletTourObj.hasNextStep()) {
					yapletTourObj.destroy();

					if (self.onCompletion) {
						self.onCompletion({
							tourId: self.productTourId,
						});
					}
				} else {
					yapletTourObj.destroy();
				}

				document.removeEventListener("click", onDocumentClick);
			},
			onPopoverRender: (popoverElement) => {
				// Fix for images and videos.
				if (popoverElement) {
					const mediaElements = document.querySelectorAll(
						".yaplet-tour-popover-description img, .yaplet-tour-popover-description video"
					);

					const performRequentialRefresh = () => {
						setTimeout(() => {
							yapletTourObj.refresh();
						}, 500);
						setTimeout(() => {
							yapletTourObj.refresh();
						}, 750);
					};

					for (let i = 0; i < mediaElements.length; i++) {
						const mediaElement = mediaElements[i];
						if (mediaElement.tagName === "IMG") {
							mediaElement.addEventListener("load", () => {
								performRequentialRefresh();
							});
							mediaElement.addEventListener("error", () => {
								performRequentialRefresh();
							});
						} else if (mediaElement.tagName === "VIDEO") {
							mediaElement.addEventListener("canplaythrough", () => {
								performRequentialRefresh();
							});
							mediaElement.addEventListener("error", () => {
								performRequentialRefresh();
							});
						}
					}
				}

				const playingClass = "yaplet-tour-video--playing";
				const playPauseContainer = document.querySelector(
					".yaplet-tour-video-playpause"
				);

				const videoElement = document.querySelector(".yaplet-tour-video-obj");
				if (videoElement) {
					const videoContainer = videoElement.closest(".yaplet-tour-video");

					if (self.unmuted) {
						if (videoElement) {
							videoElement.pause();
							videoElement.muted = false;
							videoElement.play();
							videoContainer.classList.add(playingClass);
						}
					}

					videoElement.addEventListener("ended", function () {
						playButtonElem.innerHTML = loadIcon("replay");
						playPauseContainer.classList.add(
							"yaplet-tour-video-svg--fullscreen"
						);
						videoContainer.classList.remove(playingClass);
					});

					videoElement.addEventListener("play", function () {
						console.log("Video started");
						playPauseContainer.classList.remove(
							"yaplet-tour-video-svg--fullscreen"
						);
					});

					if (playPauseContainer) {
						playPauseContainer.addEventListener("click", () => clickVideo());
					}

					const clickVideo = () => {
						if (videoElement.muted) {
							self.unmuted = true;

							videoElement.pause();
							videoElement.currentTime = 0;
							videoElement.muted = false;
							videoElement.play();

							playPauseContainer.innerHTML = loadIcon("mute");
							videoContainer.classList.add(playingClass);
						} else if (videoElement.paused) {
							videoElement.muted = false;
							videoElement.play();

							playPauseContainer.innerHTML = loadIcon("mute");
							videoContainer.classList.add(playingClass);
						} else {
							videoElement.pause();
							playPauseContainer.innerHTML = loadIcon("unmute");
							videoContainer.classList.remove(playingClass);
						}
					};
				}
			},
		});
		yapletTourObj.drive();

		document.addEventListener("click", onDocumentClick);
	}
}
