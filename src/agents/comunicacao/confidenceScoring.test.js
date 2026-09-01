const { CONFIDENCE_LEVELS, calculateMatchConfidence, shouldAutoUpdate } = require('./confidenceScoring');

describe('calculateMatchConfidence', () => {
	test('FTR exact match is MUITO_ALTA regardless of anything else', () => {
		expect(calculateMatchConfidence({ ftrExact: true })).toBe(CONFIDENCE_LEVELS.MUITO_ALTA);
	});

	test('booking + buyer is ALTA', () => {
		expect(calculateMatchConfidence({ booking: true, buyer: true })).toBe(CONFIDENCE_LEVELS.ALTA);
	});

	test('BL + invoice is ALTA', () => {
		expect(calculateMatchConfidence({ bl: true, invoice: true })).toBe(CONFIDENCE_LEVELS.ALTA);
	});

	test('invoice + buyer + value is MEDIA_ALTA', () => {
		expect(calculateMatchConfidence({ invoice: true, buyer: true, value: true })).toBe(CONFIDENCE_LEVELS.MEDIA_ALTA);
	});

	test('only buyer or only vessel is INSUFICIENTE', () => {
		expect(calculateMatchConfidence({ buyer: true })).toBe(CONFIDENCE_LEVELS.INSUFICIENTE);
		expect(calculateMatchConfidence({ vessel: true })).toBe(CONFIDENCE_LEVELS.INSUFICIENTE);
	});

	test('no matched fields is INSUFICIENTE', () => {
		expect(calculateMatchConfidence({})).toBe(CONFIDENCE_LEVELS.INSUFICIENTE);
		expect(calculateMatchConfidence()).toBe(CONFIDENCE_LEVELS.INSUFICIENTE);
	});
});

describe('shouldAutoUpdate', () => {
	test('true only for ALTA and MUITO_ALTA', () => {
		expect(shouldAutoUpdate(CONFIDENCE_LEVELS.MUITO_ALTA)).toBe(true);
		expect(shouldAutoUpdate(CONFIDENCE_LEVELS.ALTA)).toBe(true);
		expect(shouldAutoUpdate(CONFIDENCE_LEVELS.MEDIA_ALTA)).toBe(false);
		expect(shouldAutoUpdate(CONFIDENCE_LEVELS.INSUFICIENTE)).toBe(false);
	});
});
