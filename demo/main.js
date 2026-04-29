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

//Yaplet.initialize("a22e7df8-7329-458a-ac18-16970543ff73"); // IG
Yaplet.initialize("3528f1f0-33a7-43d3-b334-c61ee682447c"); // TEST
// Yaplet.initialize("26930a7f-fa2b-4094-85c8-d583aa20c76e"); // Yaplet display
// Yaplet.initialize("998782b5-8863-4c6e-b186-5f6f576bd9ec"); // Yaplet separate display acc
// Yaplet.initialize("d2cb4c3b-27ad-47f4-8943-60cae476731e"); // Yaplet separate display acc Hun
//Yaplet.initialize("38e4449b-6c2d-4822-aedb-095ff83bdace"); // Tippmix
// Yaplet.initialize("d283d726-d428-4159-9f7a-32558f3f1158"); // Yaplet live
// Yaplet.initialize("704a08ce-9015-4ec5-b6bc-22b7450ea74c"); // Puregold repa

//Yaplet.showSurvey("241d5cd9-9e35-47e9-88fb-34943656832c", "survey_full");
