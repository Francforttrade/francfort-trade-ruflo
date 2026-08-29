const { isAflatoxinWithinLimit } = require('./aflatoxinCheck');

describe('compliance aflatoxinCheck', () => {
	test('passes when the lab result is at or below the limit', () => {
		expect(isAflatoxinWithinLimit(3.5, 5)).toBe(true);
		expect(isAflatoxinWithinLimit(5, 5)).toBe(true);
	});

	test('fails when the lab result exceeds the limit', () => {
		expect(isAflatoxinWithinLimit(6, 5)).toBe(false);
	});

	test('returns null when data is missing', () => {
		expect(isAflatoxinWithinLimit(null, 5)).toBeNull();
		expect(isAflatoxinWithinLimit(3, null)).toBeNull();
	});
});
