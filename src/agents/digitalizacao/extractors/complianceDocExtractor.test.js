const { extractComplianceDocFields } = require('./complianceDocExtractor');

describe('digitalizacao complianceDocExtractor', () => {
	test('extracts ACID document number and dates, passes market through', () => {
		const text = ['ACID No: EG-ACID-2026-4471', 'Issue Date: 2026-07-01', 'Expiry Date: 2026-10-01'].join('\n');

		const result = extractComplianceDocFields({ text, market: 'Egypt' });

		expect(result).toEqual({
			document_number: 'EG-ACID-2026-4471',
			issue_date: '2026-07-01',
			expiry_date: '2026-10-01',
			market: 'Egypt',
		});
	});

	test('extracts an import permit the same way', () => {
		const result = extractComplianceDocFields({ text: 'Permit Number: DZ-PERMIT-991', market: 'Algeria' });

		expect(result.document_number).toBe('DZ-PERMIT-991');
		expect(result.market).toBe('Algeria');
	});

	test('market is null when not provided, even with no text', () => {
		expect(extractComplianceDocFields({ text: null, market: null })).toEqual({
			document_number: null,
			issue_date: null,
			expiry_date: null,
			market: null,
		});
	});
});
