const { extractFields } = require('./index');

describe('digitalizacao extractors index', () => {
	test('dispatches to the right extractor by doc type', () => {
		const result = extractFields('Invoice', { text: 'Invoice Number: INV-01\nBuyer: Acme' });

		expect(result.invoice_number).toBe('INV-01');
		expect(result.buyer_name).toBe('Acme');
	});

	test('ACID and ImportPermit share the same extractor', () => {
		const acid = extractFields('ACID', { text: 'ACID No: EG-1', market: 'Egypt' });
		const permit = extractFields('ImportPermit', { text: 'Permit No: DZ-1', market: 'Algeria' });

		expect(acid.document_number).toBe('EG-1');
		expect(permit.document_number).toBe('DZ-1');
	});

	test('attaches table_rows when present, alongside the type-specific fields', () => {
		const result = extractFields('Invoice', {
			text: 'Invoice Number: INV-02',
			tableRows: [{ item: 'Peanuts', qty_mt: 25 }],
		});

		expect(result.invoice_number).toBe('INV-02');
		expect(result.table_rows).toEqual([{ item: 'Peanuts', qty_mt: 25 }]);
	});

	test('omits table_rows when there is no table', () => {
		const result = extractFields('Invoice', { text: 'Invoice Number: INV-03' });

		expect(result).not.toHaveProperty('table_rows');
	});

	test('returns just the table (or an empty object) for an unknown/null doc type', () => {
		expect(extractFields(null, { text: 'anything' })).toEqual({});
		expect(extractFields('NotARealType', { tableRows: [{ a: 1 }] })).toEqual({ table_rows: [{ a: 1 }] });
	});
});
