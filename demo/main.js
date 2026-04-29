const Yaplet = window.Yaplet;

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

Yaplet.initialize("3528f1f0-33a7-43d3-b334-c61ee682447c"); // TEST

//Yaplet.showSurvey("241d5cd9-9e35-47e9-88fb-34943656832c", "survey_full");
