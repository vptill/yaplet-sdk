export function getYaplet() {
	const globalYaplet =
		typeof globalThis !== "undefined"
			? globalThis.Yaplet
			: typeof window !== "undefined"
				? window.Yaplet
				: null;

	if (globalYaplet && typeof globalYaplet.getInstance === "function") {
		return globalYaplet;
	}

	return null;
}

export function getYapletInstance() {
	const yaplet = getYaplet();
	if (yaplet && typeof yaplet.getInstance === "function") {
		return yaplet.getInstance();
	}

	return null;
}
