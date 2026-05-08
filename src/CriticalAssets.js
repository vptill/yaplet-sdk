/**
 * Injects DNS preconnect hints and a minimal placeholder button style as early as possible —
 * before the session POST, before the config GET, before any other SDK work.
 *
 * The placeholder button class (.yy-feedback-button) is the same class
 * FeedbackButtonManager later uses for the real button. Once the real button is injected
 * and config-driven styles take over, the real DOM node replaces the placeholder visuals
 * naturally (UI.js's full stylesheet wins on specificity / appears later in <head>).
 *
 * On returning visits, the brand color is loaded from localStorage so the placeholder
 * matches the real button color immediately. First-time visitors get a neutral grey
 * placeholder and a smooth color transition once config arrives.
 */

const PRECONNECT_HOSTS = [
    "https://embed.yaplet.com",
    "https://api.yaplet.com",
    "https://cdn.yaplet.com",
    "https://yaplet.com",
    "wss://phx.yaplet.com",
];

const FALLBACK_BUTTON_COLOR = "#485BFF";

const cachedColorKey = (sdkKey) => `yaplet-button-color-${sdkKey || "default"}`;
const cachedIconColorKey = (sdkKey) => `yaplet-button-icon-color-${sdkKey || "default"}`;

// Cached value can be a hex string ("#RRGGBB") or a full CSS gradient string ("linear-gradient(...)").
// Both are valid `background:` values for the placeholder CSS.
export const persistButtonColor = (sdkKey, color) => {
    if (!color || typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(cachedColorKey(sdkKey), color);
    } catch (e) { }
};

const loadCachedButtonColor = (sdkKey) => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }
    try {
        return window.localStorage.getItem(cachedColorKey(sdkKey));
    } catch (e) {
        return null;
    }
};

export const persistButtonIconColor = (sdkKey, color) => {
    if (!color || typeof window === "undefined" || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(cachedIconColorKey(sdkKey), color);
    } catch (e) { }
};

export const loadCachedButtonIconColor = (sdkKey) => {
    if (typeof window === "undefined" || !window.localStorage) {
        return null;
    }
    try {
        return window.localStorage.getItem(cachedIconColorKey(sdkKey));
    } catch (e) {
        return null;
    }
};

const injectPreconnects = () => {
    if (typeof document === "undefined") return;
    if (document.querySelector('link[data-yaplet-preconnect="1"]')) return;

    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    PRECONNECT_HOSTS.forEach((href) => {
        const link = document.createElement("link");
        link.rel = href.startsWith("wss:") ? "preconnect" : "preconnect";
        link.href = href;
        link.setAttribute("data-yaplet-preconnect", "1");
        // crossorigin for fetched resources from those origins (Supabase storage, fonts)
        if (href.startsWith("https://")) {
            link.crossOrigin = "anonymous";
        }
        head.appendChild(link);
    });
};

const injectCriticalButtonCSS = (sdkKey) => {
    if (typeof document === "undefined") return;
    if (document.querySelector("style[data-yaplet-critical='1']")) return;

    const head = document.head || document.getElementsByTagName("head")[0];
    if (!head) return;

    const buttonColor = loadCachedButtonColor(sdkKey) || FALLBACK_BUTTON_COLOR;

    const style = document.createElement("style");
    style.setAttribute("data-yaplet-critical", "1");
    // Minimal styles that make the button appear instantly. These get fully overridden
    // by UI.js's stylesheet once config loads. We intentionally avoid touching any
    // .yy-feedback-button-icon / inner content styles to let UI.js own those.
    style.textContent = `
.yy-feedback-button{position:fixed;right:20px;bottom:81px;width:54px;height:54px;border-radius:50%;background:${buttonColor};cursor:pointer;z-index:2147483631;border:none;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 30px rgba(0,0,0,.16);transition:background-color .2s ease}
.yy-feedback-button.yy-feedback-button--bottomleft{right:auto;left:20px}
.yy-feedback-button--hidden,.yy-feedback-button--disabled{display:none !important}
`;
    head.appendChild(style);
};

export const injectCriticalAssets = (sdkKey) => {
    try {
        injectPreconnects();
        injectCriticalButtonCSS(sdkKey);
    } catch (e) { }
};
