const Yaplet = window.Yaplet;

Yaplet.setLanguage("en");
Yaplet.setFrameUrl("http://localhost:5173");
Yaplet.setApiUrl("http://localhost:3000/api");
Yaplet.setBannerUrl("http://localhost:5173");
//Yaplet.setWSApiUrl("ws://localhost:4000/socket/websocket");

Yaplet.initialize("345fa619-c4d0-4893-8b1c-547808fe044f");

Yaplet.identify("6969", {
  name: "asd",
  email: "asd",
  value: "asd",
  plan: "asd",
});
