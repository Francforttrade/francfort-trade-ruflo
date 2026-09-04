const { isReviewBand } = require('./confidenceScoring');

// docs/RDIA_PRD.md §23 — Error Contract. These codes are what gets encoded
// into the errorMsg passed to EXCECOES (see index.js), so a human reading
// the DLQ/escalation knows exactly what kind of review is needed.
const ERROR_CODES = {
	UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
	CORRUPTED_FILE: 'CORRUPTED_FILE',
	PASSWORD_PROTECTED: 'PASSWORD_PROTECTED',
	OCR_FAILED: 'OCR_FAILED',
	OCR_LOW_CONFIDENCE: 'OCR_LOW_CONFIDENCE',
	PARSER_FAILED: 'PARSER_FAILED',
	LANGUAGE_UNSUPPORTED: 'LANGUAGE_UNSUPPORTED',
	FIELD_CONFLICT: 'FIELD_CONFLICT',
	ENTITY_AMBIGUOUS: 'ENTITY_AMBIGUOUS',
	SECURITY_BLOCK: 'SECURITY_BLOCK',
	TIMEOUT: 'TIMEOUT',
	// Rúflo extensions — not in the PRD's minimum list. OCR_NOT_AVAILABLE
	// covers three cases that don't warrant their own code: the mimeType
	// isn't something OCR can read (e.g. legacy .doc), PADDLE_OCR_SERVICE_URL
	// isn't configured yet, or the per-FTR/per-day OCR call cap
	// (rateLimiter.js) was hit — "no OCR budget available right now" reads
	// the same to a human reviewer as "no OCR worker at all".
	OCR_NOT_AVAILABLE: 'OCR_NOT_AVAILABLE',
	// confidence below the review threshold with nothing more specific to
	// blame (no cross-validation mismatch, no entity ambiguity).
	LOW_EXTRACTION_CONFIDENCE: 'LOW_EXTRACTION_CONFIDENCE',
};

// Priority order matters: a field conflict or an ambiguous entity match is a
// more specific, more actionable diagnosis than a generic low-confidence
// band, so those are picked first when more than one condition is true.
// hasFieldConflict/hasEntityAmbiguous come straight from
// confidenceScoring.js's scoreConfidence() return (has_field_conflict/
// has_entity_ambiguous) — never re-derived here — and confidenceBand is
// classified via that same module's isReviewBand, so this file and
// confidenceScoring.js can't silently drift apart on what counts as
// review-worthy.
function pickErrorCode({ hasFieldConflict, hasEntityAmbiguous, extractionMethod, confidenceBand, fileFailureReason }) {
	if (hasFieldConflict) {
		return ERROR_CODES.FIELD_CONFLICT;
	}
	if (hasEntityAmbiguous) {
		return ERROR_CODES.ENTITY_AMBIGUOUS;
	}
	if (!extractionMethod) {
		if (fileFailureReason === 'password_protected') {
			return ERROR_CODES.PASSWORD_PROTECTED;
		}
		if (fileFailureReason === 'corrupted') {
			return ERROR_CODES.CORRUPTED_FILE;
		}
		// document_ai_* reuses the same two codes as Paddle's ocr_* — both
		// are "a vision provider was tried and didn't work out", and a human
		// reviewer doesn't need a different code depending on which of the
		// two OCR tiers (chunk 2a vs 2b) happened to run last.
		if (fileFailureReason === 'ocr_failed' || fileFailureReason === 'document_ai_failed') {
			return ERROR_CODES.OCR_FAILED;
		}
		if (fileFailureReason === 'ocr_low_confidence' || fileFailureReason === 'document_ai_low_confidence') {
			return ERROR_CODES.OCR_LOW_CONFIDENCE;
		}
		return ERROR_CODES.OCR_NOT_AVAILABLE;
	}
	if (isReviewBand(confidenceBand)) {
		return ERROR_CODES.LOW_EXTRACTION_CONFIDENCE;
	}
	return null;
}

function buildErrorMessage(code, detail) {
	return detail ? `${code}: ${detail}` : code;
}

module.exports = { ERROR_CODES, pickErrorCode, buildErrorMessage };
