const Yaplet = window.Yaplet;

Yaplet.setLanguage("en");
Yaplet.setFrameUrl("http://localhost:5173");
Yaplet.setApiUrl("http://localhost:3000/api");
Yaplet.setWSApiUrl("ws://localhost:4000/socket/websocket");

/*  
Yaplet.setAiTools([{
    name: 'send-money',
    description: 'Send money to a given contact.',
    response: 'The transfer got initiated but not completed yet. The user must confirm the transfer in the banking app.',
    parameters: [{
        name: 'amount',
        description: 'The amount of money to send. Must be positive and provided by the user.',
        type: 'number',
        required: true
    }, {
        name: 'contact',
        description: 'The contact to send money to.',
        type: 'string',
        enum: ["Alice", "Bob"],
        required: true
    }]
}]);

Yaplet.on("tool-execution", (tool) => {
    if (tool.name === "send-money") {
        const amount = tool.params.amount;
        const contact = tool.params.contact;

        // Initiate the transfer here.
    }
});

Yaplet.setTicketAttribute("notes", "This is a test value.");*/

Yaplet.initialize("a22e7df8-7329-458a-ac18-16970543ff73");
