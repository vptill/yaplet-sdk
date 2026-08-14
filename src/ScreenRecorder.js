import Session from "./Session";

export class ScreenRecorder {
	rerender;
	stream;
	mediaRecorder;
	available = true;
	isRecording = false;
	file = null;
	maxRecordTime = 120;
	recordTime = 0;
	recordingTimer = null;
	permissionErrorText = "";

	constructor(rerender, permissionErrorText) {
		this.rerender = rerender;
		this.permissionErrorText = permissionErrorText;
		if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
			this.available = false;
		}

		setTimeout(() => {
			this.rerender();
		}, 100);
	}

	getSupportedMimeType() {
		// List of MIME types in order of preference
		const types = [
			"video/webm",
			"video/webm;codecs=vp8",
			"video/webm;codecs=daala",
			"video/webm;codecs=h264",
			"video/mp4",
		];

		// Iterate through the list and return the first supported type
		for (const type of types) {
			if (MediaRecorder.isTypeSupported(type)) {
				return type;
			}
		}

		// If no types are supported, return a default or handle as needed
		return "video/webm";
	}

	formatTime(s) {
		return (s - (s %= 60)) / 60 + (9 < s ? ":" : ":0") + s;
	}

	startScreenRecording = function () {
		const self = this;
		if (
			!navigator.mediaDevices ||
			!navigator.mediaDevices.getDisplayMedia ||
			this.isRecording
		) {
			this.available = false;
			this.rerender();
			return;
		}

		const max_width = 3072;
		const max_height = 1728;

		// Recordings are deliberately SILENT: no display audio and no getUserMedia
		// microphone call anywhere in this class — audio capture was removed on
		// purpose (owner privacy decision, 2026-08-13). Do not add it back.
		navigator.mediaDevices
			.getDisplayMedia({
				video: {
					width: { ideal: Math.min(window.screen.width, max_width) },
					height: { ideal: Math.min(window.screen.height, max_height) },
					frameRate: { ideal: 10, max: 24 },
					displaySurface: "monitor",
				},
				selfBrowserSurface: "include",
				audio: false,
			})
			.then(function (displayStream) {
				self.stream = displayStream;
				self.handleRecord({ stream: displayStream });
				self.rerender();
			})
			.catch(function (err) {
				window.alert(self.permissionErrorText);
				self.rerender();
			});
	};

	stopScreenRecording = function () {
		if (!this.mediaRecorder || !this.stream || !this.isRecording) {
			return;
		}

		if (this.recordingTimer) {
			clearInterval(this.recordingTimer);
			this.recordingTimer = null;
		}
		this.mediaRecorder.stop();
		this.stream.getTracks().forEach((track) => {
			track.stop();
		});

		this.rerender();
	};

	static uploadScreenRecording = function (screenRecordingData) {
		return new Promise(function (resolve, reject) {
			if (screenRecordingData == null) {
				resolve(null);
			}

			var xhr = new XMLHttpRequest();
			xhr.open("POST", Session.getInstance().apiUrl + "/sdk/uploads");
			Session.getInstance().injectSession(xhr);

			var formdata = new FormData();
			formdata.append("file", screenRecordingData);

			xhr.send(formdata);
			xhr.onerror = function () {
				reject();
			};
			xhr.onreadystatechange = function () {
				if (xhr.readyState == 4) {
					if (xhr.status == 200) {
						resolve(JSON.parse(xhr.response).fileUrl);
					} else {
						reject();
					}
				}
			};
		});
	};

	clearPreview = function () {
		document.querySelector(".yy-capture-preview video").src = null;
		this.file = null;
		this.rerender();
	};

	handleRecord = function ({ stream }) {
		const self = this;

		var recordedChunks = [];
		this.mediaRecorder = new MediaRecorder(stream, {
			mimeType: this.getSupportedMimeType(),
		});
		this.isRecording = true;
		this.recordTime = 0;

		// Set timer.
		const timerLabel = document.querySelector(".yy-capture-toolbar-item-timer");
		this.recordingTimer = setInterval(() => {
			self.recordTime++;
			var remainingTime = self.maxRecordTime - self.recordTime;
			if (remainingTime > 0) {
				timerLabel.innerHTML = self.formatTime(remainingTime);
			} else {
				timerLabel.innerHTML = "2:00";
				self.stopScreenRecording();
			}
		}, 1000);

		this.mediaRecorder.ondataavailable = function (e) {
			if (e.data.size > 0) {
				recordedChunks.push(e.data);
			}
		};

		stream.getVideoTracks()[0].onended = function () {
			self.prepareRecording(recordedChunks);
		};

		this.mediaRecorder.onstop = function () {
			self.prepareRecording(recordedChunks);
		};

		this.mediaRecorder.start(200); // here 200ms is interval of chunk collection

		self.rerender();
	};

	prepareRecording = function (recordedChunks) {
		const completeBlob = new Blob(recordedChunks, {
			type: this.getSupportedMimeType(),
		});

		const mimeType = this.getSupportedMimeType();
		const extension = mimeType.includes("mp4") ? "mp4" : "webm";
		this.file = new File([completeBlob], `screen-recording.${extension}`, {
			type: mimeType,
		});

		const previewVideoElement = document.querySelector(
			".yy-capture-preview video"
		);
		if (previewVideoElement) {
			previewVideoElement.src = URL.createObjectURL(completeBlob);
			this.isRecording = false;
			this.rerender();
		}
	};
}
