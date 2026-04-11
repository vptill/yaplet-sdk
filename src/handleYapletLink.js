import { getYaplet } from "./YapletRuntime";

export function handleYapletLink(href) {
	try {
		const urlParts = href.split("/");
		const type = urlParts[2];
		const identifier = urlParts[3];
		const yaplet = getYaplet();
		if (!yaplet) {
			return;
		}

		if (type === "article") {
			yaplet.openHelpCenterArticle(identifier, true);
		}

		if (type === "collection") {
			yaplet.openHelpCenterCollection(identifier, true);
		}

		if (type === "flow") {
			yaplet.startFeedbackFlow(identifier, true);
		}

		if (type === "form") {
			yaplet.startClassicForm(identifier, true);
		}

		if (type === "survey") {
			yaplet.showSurvey(identifier);
		}

		if (type === "bot") {
			yaplet.startBot(identifier, true);
		}

		if (type === "news") {
			yaplet.openNewsArticle(identifier, true);
		}

		if (type === "checklist") {
			yaplet.startChecklist(identifier, true);
		}

		if (type === "tour") {
			yaplet.startProductTour(identifier);
		}
	} catch (e) {
		console.error("Failed to handle Yaplet link: ", href);
	}
}
