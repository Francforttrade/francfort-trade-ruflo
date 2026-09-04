const { ERROR_CODES, pickErrorCode, buildErrorMessage } = require('./errorCodes');

describe('digitalizacao errorCodes', () => {
	describe('pickErrorCode', () => {
		test('a field conflict wins over everything else', () => {
			const code = pickErrorCode({
				hasFieldConflict: true,
				hasEntityAmbiguous: true,
				extractionMethod: null,
				confidenceBand: 'review_required',
			});
			expect(code).toBe(ERROR_CODES.FIELD_CONFLICT);
		});

		test('entity ambiguity wins over a missing extraction method or low band', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: true,
				extractionMethod: null,
				confidenceBand: 'review_required',
			});
			expect(code).toBe(ERROR_CODES.ENTITY_AMBIGUOUS);
		});

		test('no extraction method and no specific file failure is OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
			});
			expect(code).toBe(ERROR_CODES.OCR_NOT_AVAILABLE);
		});

		test('a password-protected PDF is PASSWORD_PROTECTED, not OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
				fileFailureReason: 'password_protected',
			});
			expect(code).toBe(ERROR_CODES.PASSWORD_PROTECTED);
		});

		test('a corrupted PDF is CORRUPTED_FILE, not OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
				fileFailureReason: 'corrupted',
			});
			expect(code).toBe(ERROR_CODES.CORRUPTED_FILE);
		});

		test('a PaddleOCR call failure is OCR_FAILED, not OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
				fileFailureReason: 'ocr_failed',
			});
			expect(code).toBe(ERROR_CODES.OCR_FAILED);
		});

		test('a low-confidence PaddleOCR result is OCR_LOW_CONFIDENCE, not OCR_NOT_AVAILABLE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
				fileFailureReason: 'ocr_low_confidence',
			});
			expect(code).toBe(ERROR_CODES.OCR_LOW_CONFIDENCE);
		});

		test('a Document AI call failure is also OCR_FAILED (same code as Paddle)', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
				fileFailureReason: 'document_ai_failed',
			});
			expect(code).toBe(ERROR_CODES.OCR_FAILED);
		});

		test('a low-confidence Document AI result is also OCR_LOW_CONFIDENCE (same code as Paddle)', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: null,
				confidenceBand: 'review_required',
				fileFailureReason: 'document_ai_low_confidence',
			});
			expect(code).toBe(ERROR_CODES.OCR_LOW_CONFIDENCE);
		});

		test('a low confidence band with nothing else wrong is LOW_EXTRACTION_CONFIDENCE', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: 'text_layer',
				confidenceBand: 'review_required',
			});
			expect(code).toBe(ERROR_CODES.LOW_EXTRACTION_CONFIDENCE);
		});

		test('returns null when nothing warrants escalation', () => {
			const code = pickErrorCode({
				hasFieldConflict: false,
				hasEntityAmbiguous: false,
				extractionMethod: 'text_layer',
				confidenceBand: 'auto_accept',
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
