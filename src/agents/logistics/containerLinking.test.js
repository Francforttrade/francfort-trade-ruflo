const { containersMatch } = require('./containerLinking');

describe('logistics containerLinking', () => {
	test('matches when booking and BL list the same containers', () => {
		expect(containersMatch(['MAEU1234567', 'MAEU1234568'], ['MAEU1234567', 'MAEU1234568'])).toBe(true);
		expect(containersMatch(['MAEU1234567', 'MAEU1234568'], ['MAEU1234568', 'MAEU1234567'])).toBe(true); // order-independent
	});

	test('flags a mismatch in count or contents', () => {
		expect(containersMatch(['MAEU1234567', 'MAEU1234568'], ['MAEU1234567'])).toBe(false);
		expect(containersMatch(['MAEU1234567'], ['MAEU9999999'])).toBe(false);
	});
});
