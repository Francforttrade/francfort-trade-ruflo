const { getAflatoxinLimitPpb, getMarketRequirements } = require('./marketRequirements');

describe('compliance marketRequirements', () => {
	test('Egypt FTR → aflatoxin limit = 2ppb (ROADMAP unit test)', () => {
		expect(getAflatoxinLimitPpb('Egypt')).toBe(2);
	});

	test('Russia FTR → aflatoxin limit = 5ppb', () => {
		expect(getAflatoxinLimitPpb('Russia')).toBe(5);
	});

	test('returns null for an unmapped market', () => {
		expect(getAflatoxinLimitPpb('Narnia')).toBeNull();
		expect(getMarketRequirements('Narnia')).toBeNull();
	});

	test('Algeria requires an import permit', () => {
		expect(getMarketRequirements('Algeria').requiredDocuments).toContain('Import Permit');
	});
});
