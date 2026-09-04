// [ \t]* (not \s*) between a label and its value everywhere below — \s*
// would happily cross a newline into the *next* line's own label word (e.g.
// "COMMERCIAL INVOICE\nInvoice Number: INV-01" matching "Invoice" from the
// title line and then capturing the literal word "Invoice" from line two)
// and silently return the wrong text instead of the real value.
const INVOICE_NUMBER_REGEX = /Invoice[ \t]*(?:No\.?|Number)?[ \t]*[:#]?[ \t]*([A-Z0-9\-/]+)/i;
const AMOUNT_REGEX = /(USD|EUR|BRL)[ \t]*\$?[ \t]*([\d.,]+)|(?:Total|Amount)[ \t]*[:#]?[ \t]*(USD|EUR|BRL)?[ \t]*\$?[ \t]*([\d.,]+)/i;
const BUYER_REGEX = /Buyer[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const INCOTERM_REGEX = /\b(FOB|CFR|CIF|EXW|FCA|CPT|CIP|DAP|DPU|DDP)\b/i;

function parseAmount(text) {
	const match = text.match(AMOUNT_REGEX);
	if (!match) {
		return { amount: null, currency: null };
	}
	const currency = match[1] || match[3] || null;
	const rawAmount = match[2] || match[4];
	return {
		amount: rawAmount ? parseFloat(rawAmount.replace(/,/g, '')) : null,
		currency: currency ? currency.toUpperCase() : null,
	};
}

function extractInvoiceFields({ text }) {
	if (!text) {
		return { invoice_number: null, amount: null, currency: null, buyer_name: null, incoterm: null };
	}

	const invoiceMatch = text.match(INVOICE_NUMBER_REGEX);
	const buyerMatch = text.match(BUYER_REGEX);
	const incotermMatch = text.match(INCOTERM_REGEX);
	const { amount, currency } = parseAmount(text);

	return {
		invoice_number: invoiceMatch ? invoiceMatch[1].trim() : null,
		amount,
		currency,
		buyer_name: buyerMatch ? buyerMatch[1].trim() : null,
		incoterm: incotermMatch ? incotermMatch[1].toUpperCase() : null,
	};
}

module.exports = { extractInvoiceFields };
