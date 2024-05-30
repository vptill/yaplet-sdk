const Yaplet = window.Yaplet;

Yaplet.setLanguage("en");
Yaplet.setFrameUrl("http://localhost:5173");
Yaplet.setApiUrl("http://localhost:3000/api");
//Yaplet.setWSApiUrl("ws://localhost:4000/socket/websocket");

Yaplet.on("initialized", () => {
  console.log("Yaplet initialized");
  Yaplet.setFlowConfig({ feedbackButtonPosition: "BOTTOM_LEFT", buttonY: 20 });
});
Yaplet.initialize("345fa619-c4d0-4893-8b1c-547808fe044f");
