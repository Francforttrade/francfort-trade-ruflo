// Cost tiers, cheapest first. `expensive` (Google Document AI) is reached
// only as an escalation from `cheap` (chunk 2b), never picked up front.
const TIER_ORDER = ['free', 'cheap', 'expensive'];

// PaddleOCR (services/paddleocr/) only ever receives raster images or a PDF
// to rasterize itself — a legacy .doc binary isn't something OCR can read,
// so it's excluded here even though it also has no free-tier parser
// (structuredFileExtractor.js's documented limitation).
const OCR_ELIGIBLE_MIME_TYPES = new Set([
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/webp',
	'image/tiff',
]);

function isOcrEligibleMimeType(mimeType) {
	return OCR_ELIGIBLE_MIME_TYPES.has(mimeType);
}

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

module.exports = { decideInitialTier, nextTier, isOcrEligibleMimeType, TIER_ORDER, OCR_ELIGIBLE_MIME_TYPES };
