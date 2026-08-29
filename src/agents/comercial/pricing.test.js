const {
	calculateIncotermPrice,
	isPriceDump,
	isWithinHistoricalTolerance,
	isWithinCreditLimit,
} = require('./pricing');

describe('comercial pricing', () => {
	test('FOB Santos returns the base price unchanged', () => {
		expect(calculateIncotermPrice({ fobUsdPerMt: 1000, incoterm: 'FOB Santos' })).toBe(1000);
	});

	test('CFR adds freight to the FOB price', () => {
		expect(calculateIncotermPrice({ fobUsdPerMt: 1000, incoterm: 'CFR', freightUsdPerMt: 250 })).toBe(1250);
	});

	test('CIF adds insurance on top of CFR', () => {
		const price = calculateIncotermPrice({
			fobUsdPerMt: 1000,
			incoterm: 'CIF',
			freightUsdPerMt: 250,
			insuranceRate: 0.02,
		});
		expect(price).toBeCloseTo(1275, 5); // (1000 + 250) * 1.02
	});

	test('rejects an unknown incoterm', () => {
		expect(() => calculateIncotermPrice({ fobUsdPerMt: 1000, incoterm: 'EXW' })).toThrow(/Incoterm/);
	});

	test('flags price dump at -25% or more below historical average (ROADMAP compliance test)', () => {
		expect(isPriceDump(750, 1000)).toBe(true); // exactly -25%
		expect(isPriceDump(760, 1000)).toBe(false); // -24%
		expect(isPriceDump(1200, 1000)).toBe(false); // above average isn't a dump
	});

	test('flags price outside the +-20% historical tolerance', () => {
		expect(isWithinHistoricalTolerance(1000, 1000)).toBe(true);
		expect(isWithinHistoricalTolerance(1200, 1000)).toBe(true); // +20%, boundary
		expect(isWithinHistoricalTolerance(1201, 1000)).toBe(false);
		expect(isWithinHistoricalTolerance(799, 1000)).toBe(false); // -20.1%
	});

	test('checks buyer credit limit, or returns null when the limit is unknown', () => {
		expect(isWithinCreditLimit(500000, 750000)).toBe(true);
		expect(isWithinCreditLimit(800000, 750000)).toBe(false);
		expect(isWithinCreditLimit(500000, null)).toBeNull();
		expect(isWithinCreditLimit(500000, undefined)).toBeNull();
	});
});
