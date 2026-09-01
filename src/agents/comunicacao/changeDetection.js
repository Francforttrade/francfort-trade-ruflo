// Detects mentions of booking/vessel/schedule changes and shipment splits in
// free-form correspondence, per the task spec's keyword list (section 7).
// These are simple presence checks — they flag that *something* changed so
// the caller can route the message for comparison against the existing
// record; they don't by themselves decide what changed or update anything.
function buildKeywordRegex(phrases) {
	const alternation = phrases.map((phrase) => phrase.replace(/\s+/g, '\\s+')).join('|');
	return new RegExp(`\\b(?:${alternation})\\b`, 'i');
}

const BOOKING_AMENDMENT_KEYWORDS = [
	'booking amendment',
	'booking revised',
	'revised booking',
	'booking confirmation',
	'booking cancelled',
	'booking canceled',
	'booking replaced',
	'change of vessel',
	'vessel changed',
	'rolled booking',
	'rolled cargo',
	'alteração de booking',
	'alteracao de booking',
	'booking alterado',
	'nova reserva',
	'alteração de navio',
	'alteracao de navio',
	'alteração de embarque',
	'alteracao de embarque',
	'cancelamento do booking',
	'substituição do booking',
	'substituicao do booking',
];

const ETA_CHANGE_KEYWORDS = [
	'revised etd',
	'revised eta',
	'updated schedule',
	'delay',
	'postponed',
	'rescheduled',
	'transshipment',
	'change of destination',
	'alteração de etd',
	'alteracao de etd',
	'alteração de eta',
	'alteracao de eta',
];

const SPLIT_SHIPMENT_KEYWORDS = [
	'split shipment',
	'partial shipment',
	'embarque dividido',
	'alteração da quantidade de contêineres',
	'alteracao da quantidade de conteineres',
];

const BOOKING_AMENDMENT_REGEX = buildKeywordRegex(BOOKING_AMENDMENT_KEYWORDS);
const ETA_CHANGE_REGEX = buildKeywordRegex(ETA_CHANGE_KEYWORDS);
const SPLIT_SHIPMENT_REGEX = buildKeywordRegex(SPLIT_SHIPMENT_KEYWORDS);

function detectBookingAmendment(text) {
	return Boolean(text && BOOKING_AMENDMENT_REGEX.test(text));
}

function detectEtaChange(text) {
	return Boolean(text && ETA_CHANGE_REGEX.test(text));
}

function detectSplitShipment(text) {
	return Boolean(text && SPLIT_SHIPMENT_REGEX.test(text));
}

// True when the message signals any kind of change requiring the record to
// be re-checked against what's already on file, rather than treated as a
// brand-new, independent update.
function isChangeNotification(text) {
	return detectBookingAmendment(text) || detectEtaChange(text) || detectSplitShipment(text);
}

module.exports = {
	detectBookingAmendment,
	detectEtaChange,
	detectSplitShipment,
	isChangeNotification,
	BOOKING_AMENDMENT_KEYWORDS,
	ETA_CHANGE_KEYWORDS,
	SPLIT_SHIPMENT_KEYWORDS,
};
