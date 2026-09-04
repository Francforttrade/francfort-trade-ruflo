const { SWIFT_REFERENCE_REGEX } = require('../../financeiro/swiftValidation');

// SWIFT_REFERENCE_REGEX is anchored (^...$) for exact validation of an
// already-isolated reference; here we need to *find* one inside free text,
// so reuse the same pattern without the anchors.
const SWIFT_SEARCH_REGEX = new RegExp(SWIFT_REFERENCE_REGEX.source.replace(/^\^|\$$/g, ''), 'i');
// [ \t]* (not \s*) so a label doesn't greedily cross a newline into the next
// line — see invoiceExtractor.js's comment for the failure mode this avoids.
const AMOUNT_REGEX = /(USD|EUR|BRL)[ \t]*\$?[ \t]*([\d.,]+)/i;
const VALUE_DATE_REGEX = /Value Date[ \t]*[:#]?[ \t]*(\d{4}-\d{2}-\d{2})/i;
const ORDERING_BANK_REGEX = /Ordering Bank[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const ACCOUNT_REGEX = /Account[ \t]*(?:No\.?|Number)?[ \t]*[:#]?[ \t]*([A-Z0-9]+)/i;

// Never keep a full account number past extraction — mask to the last 4
// digits at the source, matching the "****7890" rule in the security spec.
function maskAccount(account) {
	if (!account) {
		return null;
	}
	const digits = account.replace(/\s+/g, '');
	return digits.length <= 4 ? digits : `****${digits.slice(-4)}`;
}

function extractSwiftFields({ text }) {
	if (!text) {
		return {
			swift_ref: null,
			amount: null,
			currency: null,
			value_date: null,
			ordering_bank: null,
			beneficiary_account_masked: null,
		};
	}

	const swiftMatch = text.match(SWIFT_SEARCH_REGEX);
	const amountMatch = text.match(AMOUNT_REGEX);
	const dateMatch = text.match(VALUE_DATE_REGEX);
	const bankMatch = text.match(ORDERING_BANK_REGEX);
	const accountMatch = text.match(ACCOUNT_REGEX);

	return {
		swift_ref: swiftMatch ? swiftMatch[0].toUpperCase() : null,
		amount: amountMatch ? parseFloat(amountMatch[2].replace(/,/g, '')) : null,
		currency: amountMatch ? amountMatch[1].toUpperCase() : null,
		value_date: dateMatch ? dateMatch[1] : null,
		ordering_bank: bankMatch ? bankMatch[1].trim() : null,
		beneficiary_account_masked: accountMatch ? maskAccount(accountMatch[1]) : null,
	};
}

module.exports = { extractSwiftFields };
