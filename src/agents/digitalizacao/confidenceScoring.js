// docs/RDIA_PRD.md §13 — Confidence Policy: 4 named bands instead of a
// single accept/reject threshold. A band below AUTO_ACCEPT is not a failure,
// just a different level of trust a downstream agent/human should apply.
const CONFIDENCE_BANDS = {
	AUTO_ACCEPT: 'auto_accept',
	ACCEPT_FLAGGED: 'accept_flagged',
	REVIEW_REQUIRED: 'review_required',
	CANDIDATE_ONLY: 'candidate_only',
};

// Regex extraction is binary — a field either matched or it didn't — so
// there's no graded per-field confidence to report yet (that only becomes
// meaningful once OCR providers with native per-field confidence, chunk 2a/
// 2b, are wired in). A match gets 0.9 rather than 1.0 so it lands in
// ACCEPT_FLAGGED, not AUTO_ACCEPT — "found by regex" is good but not the
// same as "confirmed by a second source".
const REGEX_MATCH_CONFIDENCE = 0.9;
const REGEX_NO_MATCH_CONFIDENCE = 0;

// Fields that the current regex-only extractors never populate by design
// (see billOfLadingExtractor.js's comment on consignee_address — a full
// postal address doesn't resolve reliably from one regex capture, and needs
// the structured OCR/Document AI path instead). Scoring them like any other
// field would drag *every* document of that type down to candidate_only
// regardless of how well everything else extracted — that's a known,
// expected gap, not evidence this particular document is unreliable.
const UNSCOREABLE_FIELDS = new Set(['table_rows', 'consignee_address']);

function classifyBand(confidence, thresholds) {
	if (confidence >= thresholds.autoAccept) {
		return CONFIDENCE_BANDS.AUTO_ACCEPT;
	}
	if (confidence >= thresholds.acceptFlagged) {
		return CONFIDENCE_BANDS.ACCEPT_FLAGGED;
	}
	if (confidence >= thresholds.reviewRequired) {
		return CONFIDENCE_BANDS.REVIEW_REQUIRED;
	}
	return CONFIDENCE_BANDS.CANDIDATE_ONLY;
}

function isReviewBand(band) {
	return band === CONFIDENCE_BANDS.REVIEW_REQUIRED || band === CONFIDENCE_BANDS.CANDIDATE_ONLY;
}

// needs_review is true whenever the overall confidence band demands it, OR
// when cross-validation found a mismatch, OR entity resolution found an
// ambiguous match — a confident extraction of a value that contradicts
// another source is not something to auto-accept just because the OCR/regex
// itself was sure of what it read. has_field_conflict/has_entity_ambiguous
// are returned alongside needs_review (not just folded into the boolean) so
// callers like errorCodes.js's pickErrorCode can pick a specific error code
// without re-deriving the same checks from crossValidation/entityStatus
// themselves — one source of truth for what triggered the review.
function scoreConfidence({ classification, extractedFields, crossValidation = [], entityStatus = null, thresholds }) {
	const fieldConfidence = {};
	const fieldConfidenceValues = [];

	for (const [field, value] of Object.entries(extractedFields || {})) {
		if (UNSCOREABLE_FIELDS.has(field)) {
			continue;
		}
		const isPresent = value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0);
		const confidence = isPresent ? REGEX_MATCH_CONFIDENCE : REGEX_NO_MATCH_CONFIDENCE;
		fieldConfidence[field] = confidence;
		fieldConfidenceValues.push(confidence);
	}

	const classificationConfidence = classification ? classification.confidence : 0;
	const allValues = [classificationConfidence, ...fieldConfidenceValues];
	const overallConfidence = allValues.length ? Math.min(...allValues) : 0;
	const overallBand = classifyBand(overallConfidence, thresholds);

	const hasFieldConflict = crossValidation.some((check) => check.result === 'mismatch');
	const hasEntityAmbiguous = entityStatus === 'ambiguous';

	return {
		field_confidence: fieldConfidence,
		overall_confidence: overallConfidence,
		confidence_band: overallBand,
		needs_review: isReviewBand(overallBand) || hasFieldConflict || hasEntityAmbiguous,
		has_field_conflict: hasFieldConflict,
		has_entity_ambiguous: hasEntityAmbiguous,
	};
}

module.exports = {
	scoreConfidence,
	classifyBand,
	isReviewBand,
	CONFIDENCE_BANDS,
	REGEX_MATCH_CONFIDENCE,
	REGEX_NO_MATCH_CONFIDENCE,
};
