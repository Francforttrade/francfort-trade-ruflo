const { isValidSwiftReference } = require('./swiftValidation');

describe('financeiro swiftValidation', () => {
	test('accepts the exact ROADMAP example format', () => {
		expect(isValidSwiftReference('ITAU123ABC456XYZ')).toBe(true);
	});

	test('rejects malformed references', () => {
		expect(isValidSwiftReference('not-a-swift-ref')).toBe(false);
		expect(isValidSwiftReference('ITAU123')).toBe(false);
		expect(isValidSwiftReference('')).toBe(false);
		expect(isValidSwiftReference(null)).toBe(false);
		expect(isValidSwiftReference(undefined)).toBe(false);
	});
});
