const { generateCertificateOfOriginPdf, SIGNATORY } = require('./certificateOfOrigin');

describe('documentacao certificateOfOrigin', () => {
	test('generates a valid PDF signed by Rodrigo Francfort', async () => {
		const bytes = await generateCertificateOfOriginPdf({
			ftrCode: '03075-26',
			seller: { name: 'Teknofert' },
			buyer: { name: 'SARL Tassali' },
			product: { type: 'Peanuts', grade: '38/42' },
			quantity: { mt: 600 },
		});

		expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
		expect(SIGNATORY).toBe('Rodrigo Francfort');
	});
});
