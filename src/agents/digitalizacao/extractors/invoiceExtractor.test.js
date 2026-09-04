const { extractInvoiceFields } = require('./invoiceExtractor');

describe('digitalizacao invoiceExtractor', () => {
	test('extracts invoice number, amount, currency, buyer and incoterm', () => {
		const text = [
			'COMMERCIAL INVOICE',
			'Invoice Number: INV-2026-0042',
			'Buyer: Agrotrade Rus LLC',
			'Total: USD 125000.50',
			'Incoterm: CFR',
		].join('\n');

		const result = extractInvoiceFields({ text });

		expect(result).toEqual({
			invoice_number: 'INV-2026-0042',
			amount: 125000.5,
			currency: 'USD',
			buyer_name: 'Agrotrade Rus LLC',
			incoterm: 'CFR',
		});
	});

	test('handles the "CURRENCY amount" ordering variant', () => {
		const result = extractInvoiceFields({ text: 'Grand total: EUR 9,500.00' });

		expect(result.amount).toBe(9500);
		expect(result.currency).toBe('EUR');
	});

	test('all fields are null when there is no text', () => {
		expect(extractInvoiceFields({ text: null })).toEqual({
			invoice_number: null,
			amount: null,
			currency: null,
			buyer_name: null,
			incoterm: null,
		});
	});
});
