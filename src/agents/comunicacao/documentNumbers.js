// Extracts invoice/booking/BL references from free-form text. Unlike the FTR
// code (a bare number that needs a shape-based regex), these references are
// almost always introduced by a label ("Invoice No:", "Booking:", "BL:"), so
// matching is label-anchored to avoid picking up unrelated numbers.
// The optional label token (No./Number/Ref) lists its longer alternatives
// first — regex alternation takes the first branch that matches at a given
// position, not the longest, so "n[o°]?\.?" ahead of "number" would truncate
// "Number:" down to just "N". The captured reference itself requires at
// least one digit (`\d`), since a bare word like "mencionado" would
// otherwise satisfy "[A-Z0-9]" and read back as a bogus reference.
const INVOICE_LABEL_REGEX = /(?:invoice|fatura)\s*(?:number|n[o°]?\.?|#)?\s*[:#]?\s*([A-Z0-9./-]*\d[A-Z0-9./-]*)/i;
const BOOKING_LABEL_REGEX = /booking\s*(?:number|reference|ref\.?|n[o°]?\.?|#)?\s*[:#]?\s*([A-Z0-9./-]*\d[A-Z0-9./-]*)/i;
const BL_LABEL_REGEX = /(?:bill\s+of\s+lading|b\/?l)\s*(?:number|n[o°]?\.?|#)?\s*[:#]?\s*([A-Z0-9./-]*\d[A-Z0-9./-]*)/i;

function normalizeReference(raw) {
	if (!raw) return null;
	// Trim trailing punctuation a sentence boundary can drag in ("...BL: MEDU1234567.").
	const trimmed = raw.trim().replace(/[.,;:]+$/, '');
	return trimmed.toUpperCase();
}

function extractLabeled(text, regex) {
	if (!text) return null;
	const match = text.match(regex);
	return match ? normalizeReference(match[1]) : null;
}

function extractInvoiceNumber(text) {
	return extractLabeled(text, INVOICE_LABEL_REGEX);
}

function extractBookingNumber(text) {
	return extractLabeled(text, BOOKING_LABEL_REGEX);
}

function extractBlNumber(text) {
	return extractLabeled(text, BL_LABEL_REGEX);
}

module.exports = { extractInvoiceNumber, extractBookingNumber, extractBlNumber, normalizeReference };
