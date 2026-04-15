import ModuleRegistry from "./ModuleRegistry";

/**
 * Recursively evaluate an Operator/Rule query tree (sync).
 * conditionEvaluator is called for each leaf Rule and must return true/false.
 */
export function evaluateQueryTreeSync(query, conditionEvaluator) {
	const isOp = (q) => q && "children" in q && Array.isArray(q.children);

	if (isOp(query)) {
		if (query.identifier === "OR") {
			for (const child of query.children) {
				if (evaluateQueryTreeSync(child, conditionEvaluator)) return true;
			}
			return false;
		} else if (query.identifier === "AND") {
			for (const child of query.children) {
				if (!evaluateQueryTreeSync(child, conditionEvaluator)) return false;
			}
			return true;
		} else if (query.identifier === "NONE") {
			return query.children.length === 0 || (query.children.length === 1 && evaluateQueryTreeSync(query.children[0], conditionEvaluator));
		}
		return false;
	} else if (query && "value" in query && Array.isArray(query.value)) {
		return conditionEvaluator(query);
	}
	return false;
}

/**
 * Compare a field value against an operator and expected value.
 * Ported from conditionInterpreter.ts — covers all page rule operators.
 */
export function compareValues(fieldValue, operator, value) {
	try {
		const isInvalid = (val) => val === null || val === undefined || val === "";

		switch (operator) {
			case "equals":
				return fieldValue === value;
			case "not_equals":
				return fieldValue !== value;
			case "ilike":
				return typeof fieldValue === "string" && !isInvalid(fieldValue) && fieldValue.toLowerCase().includes(value.toLowerCase());
			case "not_ilike":
				return isInvalid(fieldValue) || (typeof fieldValue === "string" && !fieldValue.toLowerCase().includes(value.toLowerCase()));
			case "start_ilike":
				return typeof fieldValue === "string" && !isInvalid(fieldValue) && fieldValue.toLowerCase().startsWith(value.toLowerCase());
			case "not_start_ilike":
				return isInvalid(fieldValue) || (typeof fieldValue === "string" && !fieldValue.toLowerCase().startsWith(value.toLowerCase()));
			case "end_ilike":
				return typeof fieldValue === "string" && !isInvalid(fieldValue) && fieldValue.toLowerCase().endsWith(value.toLowerCase());
			case "not_end_ilike":
				return isInvalid(fieldValue) || (typeof fieldValue === "string" && !fieldValue.toLowerCase().endsWith(value.toLowerCase()));
			case "glob": {
				if (typeof fieldValue !== "string" || isInvalid(fieldValue)) return false;
				const pattern = new RegExp("^" + value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
				return pattern.test(fieldValue);
			}
			case "regex": {
				if (typeof fieldValue !== "string" || isInvalid(fieldValue)) return false;
				try {
					return new RegExp(value, "i").test(fieldValue);
				} catch {
					return false;
				}
			}
			default:
				return false;
		}
	} catch {
		return false;
	}
}

/** Strip trailing slashes from a URL so /page/ and /page compare equal */
function stripTrailingSlash(url) {
	return url.length > 1 ? url.replace(/\/+$/, "") : url;
}

/**
 * Evaluate page rules against the current URL.
 * Returns true if the URL matches the rules (or if no rules are configured).
 */
export function evaluatePageRules(pageQuery, currentUrl) {
	if (!pageQuery || !pageQuery.children || pageQuery.children.length === 0) {
		return true;
	}

	return evaluateQueryTreeSync(pageQuery, (rule) => {
		try {
			const [operator, value] = rule.value || [];
			let actualUrl = typeof currentUrl === "string" ? stripTrailingSlash(currentUrl) : currentUrl;
			let compareValue = typeof value === "string" ? stripTrailingSlash(value) : value;
			return compareValues(actualUrl, operator, compareValue) || false;
		} catch {
			return false;
		}
	});
}

ModuleRegistry.register("RuleEvaluator", { evaluateQueryTreeSync, compareValues, evaluatePageRules });
