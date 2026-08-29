const { generatePhytosanitaryPdf, isPhytoValid, daysUntilExpiry } = require('./phytosanitary');

describe('documentacao phytosanitary', () => {
	test('generates a valid PDF', async () => {
		const bytes = await generatePhytosanitaryPdf({
			ftrCode: '03075-26',
			product: { type: 'Peanuts', grade: '38/42' },
			quantity: { mt: 600 },
			issueDate: '2026-08-01',
			labName: 'Eurofins',
		});

		expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
	});

	test('is valid within the 30-day window and expired after it', () => {
		expect(isPhytoValid('2026-08-01', new Date('2026-08-25'))).toBe(true);
		expect(isPhytoValid('2026-08-01', new Date('2026-09-05'))).toBe(false);
	});

	test('counts down days until expiry', () => {
		expect(daysUntilExpiry('2026-08-01', new Date('2026-08-25'))).toBe(6);
	});
});
