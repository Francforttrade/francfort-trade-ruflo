const { scoreConfidence, classifyBand, isReviewBand, CONFIDENCE_BANDS, REGEX_MATCH_CONFIDENCE } = require('./confidenceScoring');

const THRESHOLDS = { autoAccept: 0.95, acceptFlagged: 0.8, reviewRequired: 0.6 };

describe('digitalizacao confidenceScoring', () => {
	describe('classifyBand', () => {
		test('bands match docs/RDIA_PRD.md §13 exactly', () => {
			expect(classifyBand(0.96, THRESHOLDS)).toBe(CONFIDENCE_BANDS.AUTO_ACCEPT);
			expect(classifyBand(0.95, THRESHOLDS)).toBe(CONFIDENCE_BANDS.AUTO_ACCEPT);
			expect(classifyBand(0.9, THRESHOLDS)).toBe(CONFIDENCE_BANDS.ACCEPT_FLAGGED);
			expect(classifyBand(0.8, THRESHOLDS)).toBe(CONFIDENCE_BANDS.ACCEPT_FLAGGED);
			expect(classifyBand(0.7, THRESHOLDS)).toBe(CONFIDENCE_BANDS.REVIEW_REQUIRED);
			expect(classifyBand(0.6, THRESHOLDS)).toBe(CONFIDENCE_BANDS.REVIEW_REQUIRED);
			expect(classifyBand(0.59, THRESHOLDS)).toBe(CONFIDENCE_BANDS.CANDIDATE_ONLY);
			expect(classifyBand(0, THRESHOLDS)).toBe(CONFIDENCE_BANDS.CANDIDATE_ONLY);
		});
	});

	describe('isReviewBand', () => {
		test('only review_required and candidate_only require review', () => {
			expect(isReviewBand(CONFIDENCE_BANDS.AUTO_ACCEPT)).toBe(false);
			expect(isReviewBand(CONFIDENCE_BANDS.ACCEPT_FLAGGED)).toBe(false);
			expect(isReviewBand(CONFIDENCE_BANDS.REVIEW_REQUIRED)).toBe(true);
			expect(isReviewBand(CONFIDENCE_BANDS.CANDIDATE_ONLY)).toBe(true);
		});
	});

	describe('scoreConfidence', () => {
		test('a confident classification with all fields present lands in accept_flagged (regex match, not auto_accept)', () => {
			const result = scoreConfidence({
				classification: { docType: 'Invoice', confidence: 0.95 },
				extractedFields: { invoice_number: 'INV-01', buyer_name: 'Acme' },
				thresholds: THRESHOLDS,
			});

			expect(result.field_confidence).toEqual({
				invoice_number: REGEX_MATCH_CONFIDENCE,
				buyer_name: REGEX_MATCH_CONFIDENCE,
			});
			expect(result.overall_confidence).toBe(REGEX_MATCH_CONFIDENCE);
			expect(result.confidence_band).toBe(CONFIDENCE_BANDS.ACCEPT_FLAGGED);
			expect(result.needs_review).toBe(false);
		});

		test('a missing field drags the overall confidence down to candidate_only', () => {
			const result = scoreConfidence({
				classification: { docType: 'Invoice', confidence: 0.95 },
				extractedFields: { invoice_number: 'INV-01', buyer_name: null },
				thresholds: THRESHOLDS,
			});

			expect(result.field_confidence.buyer_name).toBe(0);
			expect(result.confidence_band).toBe(CONFIDENCE_BANDS.CANDIDATE_ONLY);
			expect(result.needs_review).toBe(true);
		});

		test('an empty array field is treated as missing', () => {
			const result = scoreConfidence({
				classification: { docType: 'BL', confidence: 0.95 },
				extractedFields: { container_numbers: [] },
				thresholds: THRESHOLDS,
			});

			expect(result.field_confidence.container_numbers).toBe(0);
			expect(result.needs_review).toBe(true);
		});

		test('low classification confidence pulls the overall band down even with good fields', () => {
			const result = scoreConfidence({
				classification: { docType: 'Invoice', confidence: 0.4 },
				extractedFields: { invoice_number: 'INV-01' },
				thresholds: THRESHOLDS,
			});

			expect(result.confidence_band).toBe(CONFIDENCE_BANDS.CANDIDATE_ONLY);
			expect(result.needs_review).toBe(true);
		});

		test('a cross-validation mismatch forces needs_review even in accept_flagged territory', () => {
			const result = scoreConfidence({
				classification: { docType: 'LabReport', confidence: 0.95 },
				extractedFields: { aflatoxin_ppb: 3 },
				crossValidation: [{ check: 'aflatoxin_within_market_limit', result: 'mismatch', detail: {} }],
				thresholds: THRESHOLDS,
			});

			expect(result.confidence_band).toBe(CONFIDENCE_BANDS.ACCEPT_FLAGGED);
			expect(result.needs_review).toBe(true);
		});

		test('an ambiguous entity match forces needs_review', () => {
			const result = scoreConfidence({
				classification: { docType: 'BL', confidence: 0.95 },
				extractedFields: { bl_number: 'MAE1' },
				entityStatus: 'ambiguous',
				thresholds: THRESHOLDS,
			});

			expect(result.needs_review).toBe(true);
		});

		test('missing classification (null docType, 0 confidence) forces needs_review', () => {
			const result = scoreConfidence({
				classification: { docType: null, confidence: 0 },
				extractedFields: {},
				thresholds: THRESHOLDS,
			});

			expect(result.needs_review).toBe(true);
		});

		test('consignee_address (never populated by regex, see billOfLadingExtractor.js) does not drag confidence down', () => {
			const result = scoreConfidence({
				classification: { docType: 'BL', confidence: 0.95 },
				extractedFields: {
					bl_number: 'BL-1',
					container_numbers: ['MAEU1234567'],
					consignee_name: 'Acme',
					consignee_address: null,
					vessel: 'MSC Amsterdam',
					port_of_loading: 'Santos',
					port_of_discharge: 'Algiers',
				},
				thresholds: THRESHOLDS,
			});

			expect(result.field_confidence).not.toHaveProperty('consignee_address');
			expect(result.confidence_band).toBe(CONFIDENCE_BANDS.ACCEPT_FLAGGED);
			expect(result.needs_review).toBe(false);
		});

		test('table_rows is excluded from per-field confidence scoring', () => {
			const result = scoreConfidence({
				classification: { docType: 'Invoice', confidence: 0.95 },
				extractedFields: { invoice_number: 'INV-01', table_rows: [{ a: 1 }] },
				thresholds: THRESHOLDS,
			});

			expect(result.field_confidence).not.toHaveProperty('table_rows');
		});
	});
});
