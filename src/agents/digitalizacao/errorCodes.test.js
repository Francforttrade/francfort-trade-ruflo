const { ERROR_CODES, pickErrorCode, buildErrorMessage } = require('./errorCodes');

describe('digitalizacao errorCodes', () => {
	describe('pickErrorCode', () => {
		test('a field conflict wins over everything else', () => {
			const code = pickErrorCode({
				hasFieldConflict: true,
				hasEntityAmbiguous: true,
				extractionMethod: null,
				isReviewBand: true,
			});
			expect(code).toBe(ERROR_CODES.FIELD_CONFLICT);
		});

		test('entity ambiguity wins over a missing extraction method or low band', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: true,
				extractionMethod: null,
				isReviewBand: true,
			});
			expect(code).toBe(ERROR_CODES.ENTITY_AMBIGUOUS);
		});

		test('no extraction method and no specific file failure is OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				isReviewBand: true,
			});
			expect(code).toBe(ERROR_CODES.OCR_NOT_AVAILABLE);
		});

		test('a password-protected PDF is PASSWORD_PROTECTED, not OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				isReviewBand: true,
				fileFailureReason: 'password_protected',
			});
			expect(code).toBe(ERROR_CODES.PASSWORD_PROTECTED);
		});

		test('a corrupted PDF is CORRUPTED_FILE, not OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				isReviewBand: true,
				fileFailureReason: 'corrupted',
			});
			expect(code).toBe(ERROR_CODES.CORRUPTED_FILE);
		});

		test('a low confidence band with nothing else wrong is LOW_EXTRACTION_CONFIDENCE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: 'text_layer',
				isReviewBand: true,
			});
			expect(code).toBe(ERROR_CODES.LOW_EXTRACTION_CONFIDENCE);
		});

		test('returns null when nothing warrants escalation', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: 'text_layer',
				isReviewBand: false,
			});
			expect(code).toBeNull();
		});
	});

	describe('buildErrorMessage', () => {
		test('includes the detail when given', () => {
			expect(buildErrorMessage(ERROR_CODES.FIELD_CONFLICT, 'quantity_mt: 27 vs 27.5')).toBe(
				'FIELD_CONFLICT: quantity_mt: 27 vs 27.5'
			);
		});

		test('falls back to the bare code when there is no detail', () => {
			expect(buildErrorMessage(ERROR_CODES.OCR_NOT_AVAILABLE)).toBe('OCR_NOT_AVAILABLE');
		});
	});
});
