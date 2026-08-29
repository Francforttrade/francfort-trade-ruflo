const { generateBillOfLadingPdf, isConsigneeAddressMatching } = require('./billOfLading');

describe('documentacao billOfLading', () => {
	test('generates a valid PDF', async () => {
		const bytes = await generateBillOfLadingPdf({
			blNumber: 'MAE12345678',
			blType: 'Master',
			ftrCode: '03075-26',
			shipper: { name: 'Francfort Trade' },
			consignee: { name: 'SARL Tassali' },
			vessel: { name: 'Seatrade Reefer', voyage: '2026-345' },
			portOfLoading: 'Santos',
			portOfDischarge: 'Algiers',
			containerNumbers: ['MAEU1234567', 'MAEU1234568'],
			descriptionGoods: 'Peanuts 38/42 Grade, 25kg bags',
			weightKg: 600000,
		});

		expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
	});

	test('matches consignee address against buyer address case-insensitively', () => {
		expect(isConsigneeAddressMatching('Algiers, Algeria', 'algiers, algeria')).toBe(true);
		expect(isConsigneeAddressMatching('Algiers, Algeria', 'Cairo, Egypt')).toBe(false);
		expect(isConsigneeAddressMatching(null, 'Cairo, Egypt')).toBeNull();
	});
});
