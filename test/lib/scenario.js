/**
 * The scripted LIVE-API scenario driven by the golden-effects harness.
 *
 * IMPORTANT: call ONLY stable public methods, and only ones whose outbound
 * effects are deterministic. The transcript these produce must be byte-identical
 * across refactors — that identity is the behavioral-equivalence gate. Adding a
 * call here means re-recording the transcript, so add one deliberately, not to
 * "cover more".
 */
module.exports = async function liveScenario(Yaplet) {
  // Conversation / bot surface (SDK → iframe commands the widget handles).
  Yaplet.startBot("bot_1");
  Yaplet.startBot("bot_2", true);
  Yaplet.startConversation();
  Yaplet.startConversation(true);
  Yaplet.openConversation("share_1");
  Yaplet.openConversation();

  // Content surface (article/news are live single-item deep links).
  Yaplet.openHelpCenterArticle("art_1");
  Yaplet.openHelpCenterArticle("art_2", true);
  Yaplet.openNewsArticle("news_1");
  Yaplet.openNewsArticle("news_2", true);

  // Surveys / feedback flows.
  Yaplet.showSurvey("survey_1");
  Yaplet.showSurvey("survey_2", "survey_full");
  Yaplet.startFeedbackFlow("bugreporting");
  Yaplet.startFeedbackFlow("bugreporting", true);
  Yaplet.startFeedbackFlowWithOptions("flow_1", { hideBackButton: true });

  // Open / close lifecycle.
  Yaplet.open();
  Yaplet.close();
};
