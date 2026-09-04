const { decideInitialTier, nextTier, TIER_ORDER } = require('./costTiering');

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
});
