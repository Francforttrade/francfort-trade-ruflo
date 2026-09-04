const { extractLabReportFields } = require('./labReportExtractor');

describe('digitalizacao labReportExtractor', () => {
	test('combines text-parsed results with filename metadata', () => {
		const result = extractLabReportFields({
			filename: 'FTR_03075-26_EUROFINS_2026-08-15.pdf',
			text: 'Aflatoxin: 3.5 ppb\nMoisture: 8%\nPurity: 99%',
		});

		expect(result).toEqual({
			aflatoxin_ppb: 3.5,
			moisture_pct: 8,
			purity_pct: 99,
			lab_name: 'EUROFINS',
			report_date: '2026-08-15',
		});
	});

	test('fields are null when there is neither text nor a matching filename', () => {
		const result = extractLabReportFields({ filename: 'scan001.pdf', text: null });

		expect(result).toEqual({
			aflatoxin_ppb: null,
			moisture_pct: null,
			purity_pct: null,
			lab_name: null,
			report_date: null,
		});
	});
});
