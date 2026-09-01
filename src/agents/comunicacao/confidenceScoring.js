// Confidence scoring for cross-referencing an incoming message against an
// existing FTR/booking/invoice/BL record — task spec section 10's
// suggestion, made concrete. Automatic updates should only ever apply at
// ALTA/MUITO_ALTA; anything below that belongs in "REVISÃO MANUAL" instead
// of being guessed.
const CONFIDENCE_LEVELS = {
	MUITO_ALTA: 'MUITO_ALTA',
	ALTA: 'ALTA',
	MEDIA_ALTA: 'MEDIA_ALTA',
	INSUFICIENTE: 'INSUFICIENTE',
};

const AUTO_UPDATE_LEVELS = new Set([CONFIDENCE_LEVELS.MUITO_ALTA, CONFIDENCE_LEVELS.ALTA]);

// `matchedFields` names which identifiers the incoming message shares with
// the candidate record it's being compared to, e.g.
// { ftrExact: true, booking: true, buyer: true, bl: true, invoice: true, value: true, vessel: true }
function calculateMatchConfidence(matchedFields = {}) {
	if (matchedFields.ftrExact) return CONFIDENCE_LEVELS.MUITO_ALTA;
	if (matchedFields.booking && matchedFields.buyer) return CONFIDENCE_LEVELS.ALTA;
	if (matchedFields.bl && matchedFields.invoice) return CONFIDENCE_LEVELS.ALTA;
	if (matchedFields.invoice && matchedFields.buyer && matchedFields.value) return CONFIDENCE_LEVELS.MEDIA_ALTA;
	return CONFIDENCE_LEVELS.INSUFICIENTE;
}

function shouldAutoUpdate(confidenceLevel) {
	return AUTO_UPDATE_LEVELS.has(confidenceLevel);
}

module.exports = { CONFIDENCE_LEVELS, calculateMatchConfidence, shouldAutoUpdate };
