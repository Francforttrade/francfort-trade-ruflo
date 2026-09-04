const { decideInitialTier, nextTier, isOcrEligibleMimeType, TIER_ORDER } = require('./costTiering');

describe('digitalizacao costTiering', () => {
	describe('decideInitialTier', () => {
		test('structured data (xlsx/docx parse) is free', () => {
			expect(decideInitialTier({ hasStructuredData: true, hasTextLayer: false })).toBe('free');
		});

		test('a PDF text layer is free', () => {
			expect(decideInitialTier({ hasStructuredData: false, hasTextLayer: true })).toBe('free');
		});

		test('neither structured data nor a text layer starts at cheap (OCR needed)', () => {
			expect(decideInitialTier({ hasStructuredData: false, hasTextLayer: false })).toBe('cheap');
		});
	});

	describe('nextTier', () => {
		test('escalates free -> cheap -> expensive', () => {
			expect(nextTier('free')).toBe('cheap');
			expect(nextTier('cheap')).toBe('expensive');
		});

		test('has no escalation past expensive', () => {
			expect(nextTier('expensive')).toBeNull();
		});

		test('returns null for an unknown tier', () => {
			expect(nextTier('made_up')).toBeNull();
		});
	});

	test('TIER_ORDER is cheapest-first', () => {
		expect(TIER_ORDER).toEqual(['free', 'cheap', 'expensive']);
	});

	describe('isOcrEligibleMimeType', () => {
		test('accepts PDF and raster image types', () => {
			expect(isOcrEligibleMimeType('application/pdf')).toBe(true);
			expect(isOcrEligibleMimeType('image/jpeg')).toBe(true);
			expect(isOcrEligibleMimeType('image/png')).toBe(true);
			expect(isOcrEligibleMimeType('image/webp')).toBe(true);
			expect(isOcrEligibleMimeType('image/tiff')).toBe(true);
		});

		test('rejects legacy .doc and spreadsheet types — OCR cannot read those formats', () => {
			expect(isOcrEligibleMimeType('application/msword')).toBe(false);
			expect(isOcrEligibleMimeType('application/vnd.ms-excel')).toBe(false);
		});
	});
});
