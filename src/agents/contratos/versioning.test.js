const { nextFtrVersion } = require('./versioning');

describe('contratos versioning', () => {
	test('creates the first amendment version', () => {
		expect(nextFtrVersion('03075-26')).toBe('03075-26-1');
	});

	test('increments an existing amendment version', () => {
		expect(nextFtrVersion('03075-26-1')).toBe('03075-26-2');
	});

	test('rejects an invalid FTR code', () => {
		expect(() => nextFtrVersion('not-an-ftr')).toThrow(/inválido/);
	});
});
