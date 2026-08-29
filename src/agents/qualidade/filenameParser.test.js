const { parseLabReportFilename } = require('./filenameParser');

describe('qualidade filenameParser', () => {
	test('parses the exact ROADMAP filename example', () => {
		expect(parseLabReportFilename('FTR_03075-26_EUROFINS_2026-08-15.pdf')).toEqual({
			ftrCode: '03075-26',
			labName: 'EUROFINS',
			date: '2026-08-15',
		});
	});

	test('returns null for a filename that does not match the pattern', () => {
		expect(parseLabReportFilename('laudo.pdf')).toBeNull();
		expect(parseLabReportFilename(null)).toBeNull();
	});
});
