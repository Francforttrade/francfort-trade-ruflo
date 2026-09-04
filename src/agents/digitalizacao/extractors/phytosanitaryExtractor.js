const { isPhytoValid, daysUntilExpiry } = require('../../documentacao/phytosanitary');

// [ \t]* (not \s*) so a label doesn't greedily cross a newline into the next
// line — see invoiceExtractor.js's comment for the failure mode this avoids.
const PRODUCT_REGEX = /Product[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const QUANTITY_REGEX = /Quantity[ \t]*[:#]?[ \t]*([\d.,]+)[ \t]*MT/i;
const ISSUE_DATE_REGEX = /Issue Date[ \t]*[:#]?[ \t]*(\d{4}-\d{2}-\d{2})/i;
const LAB_REGEX = /Lab[ \t]*[:#]?[ \t]*([^\n,;]+)/i;

// Field names mirror documentacao/phytosanitary.js's own generation
// template; validity is computed with that same module's 30-day rule so an
// extracted certificate and one Rúflo generated agree on expiry.
function extractPhytosanitaryFields({ text }) {
	if (!text) {
		return {
			product_description: null,
			quantity_mt: null,
			issue_date: null,
			lab_name: null,
			is_valid: null,
			days_until_expiry: null,
		};
	}

	const productMatch = text.match(PRODUCT_REGEX);
	const quantityMatch = text.match(QUANTITY_REGEX);
	const issueMatch = text.match(ISSUE_DATE_REGEX);
	const labMatch = text.match(LAB_REGEX);
	const issueDate = issueMatch ? issueMatch[1] : null;

	return {
		product_description: productMatch ? productMatch[1].trim() : null,
		quantity_mt: quantityMatch ? parseFloat(quantityMatch[1].replace(',', '.')) : null,
		issue_date: issueDate,
		lab_name: labMatch ? labMatch[1].trim() : null,
		is_valid: issueDate ? isPhytoValid(issueDate) : null,
		days_until_expiry: issueDate ? daysUntilExpiry(issueDate) : null,
	};
}

module.exports = { extractPhytosanitaryFields };
