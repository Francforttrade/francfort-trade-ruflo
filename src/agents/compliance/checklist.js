const { getMarketRequirements } = require('./marketRequirements');

// ROADMAP: "Algeria import permit missing → COMPLIANCE escalação".
function buildComplianceChecklist(market, presentDocuments = {}) {
	const requirements = getMarketRequirements(market);
	if (!requirements) {
		throw new Error(`Mercado de compliance desconhecido: ${market}`);
	}

	const items = requirements.requiredDocuments.map((document) => ({
		document,
		present: Boolean(presentDocuments[document]),
	}));

	return { market, items, complete: items.every((item) => item.present) };
}

module.exports = { buildComplianceChecklist };
