// [ \t]* (not \s*) so a label doesn't greedily cross a newline into the next
// line — see invoiceExtractor.js's comment for the failure mode this avoids.
const DOCUMENT_NUMBER_REGEX = /(?:ACID|Permit)[ \t]*(?:No\.?|Number)?[ \t]*[:#]?[ \t]*([A-Z0-9\-/]+)/i;
const ISSUE_DATE_REGEX = /Issue Date[ \t]*[:#]?[ \t]*(\d{4}-\d{2}-\d{2})/i;
const EXPIRY_DATE_REGEX = /Expiry Date[ \t]*[:#]?[ \t]*(\d{4}-\d{2}-\d{2})/i;

// Shared by ACID and ImportPermit — both are just "a numbered document with
// an issue/expiry date for a market" per docs/ROADMAP.md's compliance
// section. `market` is passed through from context rather than parsed from
// the document, since the FTR's market is already known by the caller.
function extractComplianceDocFields({ text, market }) {
	if (!text) {
		return { document_number: null, issue_date: null, expiry_date: null, market: market || null };
	}

	const numberMatch = text.match(DOCUMENT_NUMBER_REGEX);
	const issueMatch = text.match(ISSUE_DATE_REGEX);
	const expiryMatch = text.match(EXPIRY_DATE_REGEX);

	return {
		document_number: numberMatch ? numberMatch[1].trim() : null,
		issue_date: issueMatch ? issueMatch[1] : null,
		expiry_date: expiryMatch ? expiryMatch[1] : null,
		market: market || null,
	};
}

module.exports = { extractComplianceDocFields };
