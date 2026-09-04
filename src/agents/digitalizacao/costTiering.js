// Cost tiers, cheapest first. `expensive` (Google Document AI) is reached
// only as an escalation from `cheap` (chunk 2b), never picked up front.
const TIER_ORDER = ['free', 'cheap', 'expensive'];

// Structured-file parse and text-layer PDF regex are both zero-cost — a
// scanned image or a PDF with no text layer is the only case that needs any
// OCR at all, and that starts at the cheapest OCR tier (PaddleOCR, chunk 2a).
function decideInitialTier({ hasStructuredData, hasTextLayer }) {
	if (hasStructuredData || hasTextLayer) {
		return 'free';
	}
	return 'cheap';
}

function nextTier(tier) {
	const index = TIER_ORDER.indexOf(tier);
	if (index === -1 || index === TIER_ORDER.length - 1) {
		return null;
	}
	return TIER_ORDER[index + 1];
}

module.exports = { decideInitialTier, nextTier, TIER_ORDER };
