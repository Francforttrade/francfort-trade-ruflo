const { process } = require('./index');

describe('documentacao agent', () => {
	test('generates a BL PDF and checks consignee vs buyer address', async () => {
		const result = await process({
			ftrCode: '03075-26',
			docType: 'BL',
			blNumber: 'MAE12345678',
			blType: 'Master',
			shipper: { name: 'Francfort Trade' },
			consignee: { name: 'SARL Tassali', address: 'Algiers, Algeria' },
			buyer: { address: 'Algiers, Algeria' },
			vessel: { name: 'Seatrade Reefer', voyage: '2026-345' },
			portOfLoading: 'Santos',
			portOfDischarge: 'Algiers',
			containerNumbers: ['MAEU1234567'],
			descriptionGoods: 'Peanuts 38/42',
			weightKg: 600000,
		});

		expect(result.agent).toBe('documentacao');
		expect(result.doc_type).toBe('BL');
		expect(result.consignee_address_matches_buyer).toBe(true);
		expect(typeof result.pdf_base64).toBe('string');
		expect(Buffer.from(result.pdf_base64, 'base64').slice(0, 5).toString()).toBe('%PDF-');
	});

	test('generates an Invoice PDF applying the Russia bank rule', async () => {
		const result = await process({
			ftrCode: '03075-26',
			docType: 'Invoice',
			invoiceNumber: 'INV-03075-001',
			seller: { name: 'Teknofert' },
			buyer: { name: 'Agrotrade Rus' },
			market: 'Russia',
			totalAmountUsd: 750000,
			bankDetails: { bank_account_number: '1234567890-9', swift_code: 'SBERRUMM', beneficiary: 'Agrotrade Rus' },
		});

		expect(result.doc_type).toBe('Invoice');
		expect(Buffer.from(result.pdf_base64, 'base64').slice(0, 5).toString()).toBe('%PDF-');
	});

	test('generates a Phyto PDF and flags validity', async () => {
		const result = await process({
			ftrCode: '03075-26',
			docType: 'Phyto',
			product: { type: 'Peanuts', grade: '38/42' },
			quantity: { mt: 600 },
			issueDate: '2020-01-01',
		});

		expect(result.doc_type).toBe('Phyto');
		expect(result.is_valid).toBe(false); // issued years ago, well past the 30-day window
	});

	test('rejects an unknown docType', async () => {
		await expect(process({ ftrCode: '03075-26', docType: 'Unknown' })).rejects.toThrow(/desconhecido/);
	});

	test('without a docType, returns the document checklist and SLA status', async () => {
		const result = await process({
			ftrCode: '03075-26',
			presentDocuments: { BL: true, CO: true, Phyto: true, Fumigation: true, Invoice: true, Quality: true },
			etd: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
		});

		expect(result.checklist.complete).toBe(true);
		expect(result.within_sla).toBe(true);
	});
});
