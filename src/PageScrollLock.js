// Freezes the host page while the widget covers the whole screen (phones).
//
// Without this, a finger scroll that reaches the end of the widget's own content is
// handed on to the page behind it (the browser's scroll chaining). The page scrolls, the
// phone browser's address bar slides in or out, the screen height changes under the
// full-screen panel, and the panel ends up pushed partly off screen with the page and the
// launcher showing through the gap.
//
// overflow:hidden alone does not stop touch scrolling in iOS Safari, so the body is also
// pinned in place — position:fixed, shifted up by the current scroll offset so nothing
// visibly moves — and the scroll position is put back on unlock. Every inline value
// touched here is saved first and restored exactly, so a page that styles <html> or
// <body> inline gets its own values back.

const HTML_PROPS = ["overflow", "overscroll-behavior"];
const BODY_PROPS = ["overflow", "position", "top", "left", "width"];

let saved = null;

const snapshot = (el, props) =>
	props.map((prop) => [
		prop,
		el.style.getPropertyValue(prop),
		el.style.getPropertyPriority(prop),
	]);

const restore = (el, entries) => {
	for (let i = 0; i < entries.length; i++) {
		const [prop, value, priority] = entries[i];
		if (value) {
			el.style.setProperty(prop, value, priority);
		} else {
			el.style.removeProperty(prop);
		}
	}
};

export const lockPageScroll = () => {
	if (saved || typeof document === "undefined" || !document.body) {
		return;
	}

	const html = document.documentElement;
	const body = document.body;
	const x = window.scrollX || window.pageXOffset || 0;
	const y = window.scrollY || window.pageYOffset || 0;

	saved = {
		x,
		y,
		html: snapshot(html, HTML_PROPS),
		body: snapshot(body, BODY_PROPS),
	};

	html.style.setProperty("overflow", "hidden", "important");
	html.style.setProperty("overscroll-behavior", "none", "important");
	body.style.setProperty("overflow", "hidden", "important");
	body.style.setProperty("position", "fixed", "important");
	body.style.setProperty("top", -y + "px", "important");
	body.style.setProperty("left", -x + "px", "important");
	body.style.setProperty("width", "100%", "important");
};

export const unlockPageScroll = () => {
	if (!saved || typeof document === "undefined") {
		return;
	}

	const html = document.documentElement;
	const { x, y } = saved;
	restore(html, saved.html);
	if (document.body) {
		restore(document.body, saved.body);
	}
	saved = null;

	// A page with scroll-behavior:smooth would otherwise visibly glide back down from
	// the top instead of simply being where it was.
	const scrollBehavior = snapshot(html, ["scroll-behavior"]);
	html.style.setProperty("scroll-behavior", "auto", "important");
	try {
		window.scrollTo(x, y);
	} catch (e) { }
	restore(html, scrollBehavior);
};
