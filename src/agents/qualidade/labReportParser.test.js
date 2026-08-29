const { parseLabReportText } = require('./labReportParser');

describe('qualidade labReportParser', () => {
	test('extracts aflatoxin, moisture and purity from a lab report', () => {
		const result = parseLabReportText('Aflatoxin: 3 ppb\nMoisture: 8.5%\nPurity: 99.2%');
		expect(result).toEqual({ aflatoxin_ppb: 3, moisture_pct: 8.5, purity_pct: 99.2 });
	});

	test('returns null for fields not present in the report', () => {
		const result = parseLabReportText('Nothing useful here');
		expect(result).toEqual({ aflatoxin_ppb: null, moisture_pct: null, purity_pct: null });
	});
});
