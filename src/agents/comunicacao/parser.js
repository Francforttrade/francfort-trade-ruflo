const FTR_CODE_REGEX = /\b(\d{5}-\d{2}(?:-\d)?)\b/;
const QUANTITY_MT_REGEX = /(\d+(?:[.,]\d+)?)\s*mt\b/i;
const GRADE_REGEX = /\b(\d{2}\/\d{2})\b/;

const PRODUCT_PATTERNS = [
	{ type: 'Peanuts', pattern: /peanuts?|amendoim/i },
	{ type: 'Grains', pattern: /grains?|grãos?/i },
	{ type: 'Sugar', pattern: /sugar|açúcar/i },
];

const PARTY_PATTERNS = {
	seller: /(?:seller|vendedor)\s*:\s*([^\n,;]+)/i,
	buyer: /(?:buyer|comprador)\s*:\s*([^\n,;]+)/i,
};

// Order matters: more specific document keywords are checked before the
// generic "mentions an FTR code" fallback.
const INTENT_PATTERNS = [
	{ intent: 'booking', pattern: /\bbooking\b/i },
	{ intent: 'invoice', pattern: /\binvoice\b|\bfatura\b/i },
	{ intent: 'bl_document', pattern: /\bBL\b/ },
	{ intent: 'quote_offer', pattern: /oferta\s+de/i },
	{ intent: 'ftr_reference', pattern: FTR_CODE_REGEX },
];

function extractFtrCode(text) {
	const match = text.match(FTR_CODE_REGEX);
	return match ? match[1] : null;
}

function extractQuantityMt(text) {
	const match = text.match(QUANTITY_MT_REGEX);
	return match ? parseFloat(match[1].replace(',', '.')) : null;
}

function extractGrade(text) {
	const match = text.match(GRADE_REGEX);
	return match ? match[1] : null;
}

function extractProductType(text) {
	const found = PRODUCT_PATTERNS.find(({ pattern }) => pattern.test(text));
	return found ? found.type : null;
}

function extractParty(text, role) {
	const match = text.match(PARTY_PATTERNS[role]);
	return match ? match[1].trim() : null;
}

function classifyIntent(text) {
	const found = INTENT_PATTERNS.find(({ pattern }) => pattern.test(text));
	return found ? found.intent : 'unknown';
}

function parseMessage(text) {
	return {
		intent: classifyIntent(text),
		ftr_code: extractFtrCode(text),
		product: {
			type: extractProductType(text),
			grade: extractGrade(text),
		},
		quantity: { mt: extractQuantityMt(text) },
		seller: extractParty(text, 'seller'),
		buyer: extractParty(text, 'buyer'),
	};
}

module.exports = {
	parseMessage,
	extractFtrCode,
	extractQuantityMt,
	extractGrade,
	extractProductType,
	classifyIntent,
};
