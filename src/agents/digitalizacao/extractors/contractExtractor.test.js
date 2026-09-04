const { extractContractFields } = require('./contractExtractor');

describe('digitalizacao contractExtractor', () => {
	test('extracts contract number, parties and signature info', () => {
		const text = [
			'SALES CONTRACT',
			'Contract Number: CT-2026-0007',
			'Seller: Francfort Trade',
			'Buyer: Tassali Trading SPA',
			'Signed: Rodrigo Francfort',
			'Signature Date: 2026-08-01',
		].join('\n');

		const result = extractContractFields({ text });

		expect(result).toEqual({
			contract_number: 'CT-2026-0007',
			parties: ['Francfort Trade', 'Tassali Trading SPA'],
			signature_present: true,
			signature_date: '2026-08-01',
		});
	});

	test('signature_present is false when there is no signature keyword', () => {
		const result = extractContractFields({ text: 'Seller: Francfort Trade\nBuyer: Agrotrade Rus' });

		expect(result.signature_present).toBe(false);
		expect(result.signature_date).toBeNull();
	});

	test('defaults are returned when there is no text', () => {
		expect(extractContractFields({ text: null })).toEqual({
			contract_number: null,
			parties: [],
			signature_present: false,
			signature_date: null,
		});
	});
});
