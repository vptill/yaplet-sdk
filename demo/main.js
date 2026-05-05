const Yaplet = window.Yaplet;

// =============================================================================
// Display-account impersonation (dev-only)
// =============================================================================
//
// The dashboard's admin tools page can build a URL like:
//
//   http://localhost:4444/?yaplet_w=<widget_id>&yaplet_id=<visitor_id>&yaplet_token=<jwt>
//
// When those params are present, we override the SDK's api-token (sdkKey) and
// pre-populate the cached session so /sdk/sessions returns the existing
// display-account chat instead of creating a new visitor. Lets you screenshot
// the test conversations through the full SDK demo (banner, host page, etc.)
// without changing the hardcoded sdkKey by hand.
//
// To switch visitors, just open a new URL — we wipe any previous cache for the
// chosen sdkKey so the new identity wins.
const params = new URLSearchParams(window.location.search);
const overrideWidget = params.get("yaplet_w");
const overrideVisitorId = params.get("yaplet_id");
const overrideToken = params.get("yaplet_token");

const DEFAULT_SDK_KEY = "3528f1f0-33a7-43d3-b334-c61ee682447c"; // TEST widget
const sdkKey = overrideWidget || DEFAULT_SDK_KEY;

if (overrideWidget && overrideVisitorId && overrideToken) {
    try {
        // Cache key matches Helper.js's `yaplet-widget-${key}` pattern.
        localStorage.removeItem(`yaplet-widget-session-${DEFAULT_SDK_KEY}`);
        localStorage.setItem(
            `yaplet-widget-session-${sdkKey}`,
            JSON.stringify({ yapletId: overrideVisitorId, yapletHash: overrideToken }),
        );
        // Legacy fallback the SDK still reads on first boot.
        localStorage.setItem("yaplet-access-token", overrideToken);
        console.info("[yaplet-demo] impersonating visitor", overrideVisitorId, "on widget", overrideWidget);
    } catch (exp) {
        console.error("[yaplet-demo] failed to seed impersonation cache:", exp);
    }
}

Yaplet.setLanguage("en");
Yaplet.setFrameUrl("http://localhost:5173");
Yaplet.setApiUrl("http://localhost:3000/api");
//Yaplet.setBannerUrl("http://localhost:5173");
Yaplet.setAdminUrl("http://localhost:3000");

// Optional WS URL override from the gitignored demo/local-overrides.js loaded
// before this script. Absent in fresh checkouts → SDK defaults to prod.
if (window.__YAPLET_DEV_WS_URL) {
    Yaplet.setWSApiUrl(window.__YAPLET_DEV_WS_URL);
}

Yaplet.initialize(sdkKey);

//Yaplet.showSurvey("241d5cd9-9e35-47e9-88fb-34943656832c", "survey_full");
