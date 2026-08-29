const { generateInvoicePdf, isRussiaBankRule, formatBankDetailsLines } = require('./invoice');

describe('documentacao invoice', () => {
	test('generates a valid PDF', async () => {
		const bytes = await generateInvoicePdf({
			invoiceNumber: 'INV-03075-001',
			ftrCode: '03075-26',
			seller: { name: 'Teknofert' },
			buyer: { name: 'SARL Tassali' },
			lineItems: [{ description: 'Peanuts 38/42', quantity_mt: 600, unit_price_usd: 1250, total_usd: 750000 }],
			totalAmountUsd: 750000,
			paymentTerms: 'CAD at sight',
			bankDetails: { bank_account_number: '1234567890-9', swift_code: 'ITAUBRSP', beneficiary: 'Teknofert LTDA' },
		});

		expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
	});

	test('detects the Russia bank rule by buyer name or market', () => {
		expect(isRussiaBankRule('Agrotrade Rus', undefined)).toBe(true);
		expect(isRussiaBankRule('SARL Tassali', 'Russia')).toBe(true);
		expect(isRussiaBankRule('SARL Tassali', 'Algeria')).toBe(false);
	});

	test('RULE RUSSIA: hides bank name/SWIFT, keeps only the account number', () => {
		const bankDetails = { bank_account_number: '1234567890-9', swift_code: 'SBERRUMM', beneficiary: 'Agrotrade Rus' };

		const russiaLines = formatBankDetailsLines(bankDetails, { buyerName: 'Agrotrade Rus', market: 'Russia' });
		expect(russiaLines).toEqual(['Bank Account: 1234567890-9']);

		const normalLines = formatBankDetailsLines(bankDetails, { buyerName: 'SARL Tassali', market: 'Algeria' });
		expect(normalLines).toContain('SWIFT: SBERRUMM');
		expect(normalLines).toContain('Beneficiary: Agrotrade Rus');
	});
});
