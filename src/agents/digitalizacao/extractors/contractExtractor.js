const { extractParty } = require('../../contratos/parser');

// [ \t]* (not \s*) so the label doesn't greedily cross a newline — see the
// comment in invoiceExtractor.js for why that matters (e.g. "SALES
// CONTRACT\nContract Number: ..." must not match "Contract" from the title).
const CONTRACT_NUMBER_REGEX = /Contract[ \t]*(?:No\.?|Number)?[ \t]*[:#]?[ \t]*([A-Z0-9\-/]+)/i;
const SIGNATURE_DATE_REGEX = /Signature Date[ \t]*[:#]?[ \t]*(\d{4}-\d{2}-\d{2})/i;
const SIGNATURE_KEYWORDS_REGEX = /\b(signed|assinado|signature)\b/i;

function extractContractFields({ text }) {
	if (!text) {
		return { contract_number: null, parties: [], signature_present: false, signature_date: null };
	}

	const numberMatch = text.match(CONTRACT_NUMBER_REGEX);
	const dateMatch = text.match(SIGNATURE_DATE_REGEX);
	const parties = [extractParty(text, 'seller'), extractParty(text, 'buyer')].filter(Boolean);

	return {
		contract_number: numberMatch ? numberMatch[1].trim() : null,
		parties,
		signature_present: SIGNATURE_KEYWORDS_REGEX.test(text),
		signature_date: dateMatch ? dateMatch[1] : null,
	};
}

module.exports = { extractContractFields };
