export default class CustomActionManager {
	customActionCallbacks = [];

	// CustomActionManager singleton
	static instance;
	static getInstance() {
		if (!this.instance) {
			this.instance = new CustomActionManager();
		}
		return this.instance;
	}

	/**
	 * Register custom action
	 */
	static registerCustomAction(customAction) {
		const instance = this.getInstance();
		if (instance.customActionCallbacks) {
			instance.customActionCallbacks.push(customAction);
		}
	}

	/**
	 * Triggers a custom action
	 */
	static triggerCustomAction(name, data) {
		const instance = this.getInstance();
		if (instance.customActionCallbacks) {
			for (var i = 0; i < instance.customActionCallbacks.length; i++) {
				var callback = instance.customActionCallbacks[i];
				if (callback) {
					callback({
						name,
						...(data ? data : {}),
					});
				}
			}
		}
	}
}
