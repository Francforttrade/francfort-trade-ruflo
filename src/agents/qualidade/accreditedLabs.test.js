const { isAccreditedLab } = require('./accreditedLabs');

describe('qualidade accreditedLabs', () => {
	test('recognizes Eurofins case-insensitively', () => {
		expect(isAccreditedLab('EUROFINS')).toBe(true);
		expect(isAccreditedLab('Eurofins')).toBe(true);
	});

	test('rejects an unlisted lab', () => {
		expect(isAccreditedLab('Random Lab Inc')).toBe(false);
		expect(isAccreditedLab(null)).toBe(false);
	});
});
