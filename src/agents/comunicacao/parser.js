const { normalizeFtr, isFtrAmbiguous } = require('./ftrNormalization');
const { extractInvoiceNumber, extractBookingNumber, extractBlNumber } = require('./documentNumbers');
const {
	extractOriginPort,
	extractDestinationPort,
	extractVessel,
	extractVoyage,
	extractEtd,
	extractEta,
	extractContainerQuantity,
} = require('./shipmentExtraction');
const { detectBookingAmendment, detectEtaChange, detectSplitShipment } = require('./changeDetection');

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

// `ftr_code` is kept exactly as it always was (extractFtrCode's bare 5-digit
// match) since it already feeds routing elsewhere. `ftr_code_normalized` is
// the new, more permissive normalizer from ftrNormalization.js (handles a
// missing leading zero, "FTR" prefix, "/" separators, etc. — see task spec
// section 2); `ftr_ambiguous` flags when two different FTR codes are
// mentioned, so callers route the message to REVISÃO MANUAL instead of
// guessing which one applies.
function parseMessage(text) {
	return {
		intent: classifyIntent(text),
		ftr_code: extractFtrCode(text),
		ftr_code_normalized: normalizeFtr(text),
		ftr_ambiguous: isFtrAmbiguous(text),
		invoice_number: extractInvoiceNumber(text),
		booking_number: extractBookingNumber(text),
		bl_number: extractBlNumber(text),
		product: {
			type: extractProductType(text),
			grade: extractGrade(text),
		},
		quantity: { mt: extractQuantityMt(text) },
		seller: extractParty(text, 'seller'),
		buyer: extractParty(text, 'buyer'),
		shipment: {
			origin_port: extractOriginPort(text),
			destination_port: extractDestinationPort(text),
			vessel: extractVessel(text),
			voyage: extractVoyage(text),
			etd: extractEtd(text),
			eta: extractEta(text),
			container_quantity: extractContainerQuantity(text),
		},
		change_signals: {
			booking_amendment: detectBookingAmendment(text),
			eta_change: detectEtaChange(text),
			split_shipment: detectSplitShipment(text),
		},
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
