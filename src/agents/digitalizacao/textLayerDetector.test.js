const { PDFDocument, StandardFonts } = require('pdf-lib');
const { detectTextLayer, classifyPdfParseError, MIN_TEXT_LENGTH } = require('./textLayerDetector');

async function buildPdfBase64(text) {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage();
	if (text) {
		const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
		page.drawText(text, { x: 50, y: 700, size: 12, font });
	}
	const bytes = await pdfDoc.save();
	return Buffer.from(bytes).toString('base64');
}

describe('digitalizacao textLayerDetector', () => {
	test('detects a real text layer in a generated PDF', async () => {
		const fileBase64 = await buildPdfBase64('Invoice Number: INV-2026-001 Amount: USD 12345.00');

		const result = await detectTextLayer(fileBase64);

		expect(result.hasTextLayer).toBe(true);
		expect(result.extractedText).toEqual(expect.stringContaining('Invoice Number'));
		expect(result.failureReason).toBeNull();
	});

	test('reports no text layer (not a failure) for a blank/scanned-looking PDF', async () => {
		const fileBase64 = await buildPdfBase64(null);

		const result = await detectTextLayer(fileBase64);

		expect(result.hasTextLayer).toBe(false);
		expect(result.extractedText).toBeNull();
		expect(result.failureReason).toBeNull();
	});

	test('classifies a genuinely unparseable PDF as corrupted, not a plain "no text layer"', async () => {
		const result = await detectTextLayer(Buffer.from('not a real pdf').toString('base64'));

		expect(result.hasTextLayer).toBe(false);
		expect(result.extractedText).toBeNull();
		expect(result.failureReason).toBe('corrupted');
	});

	test('returns a clean "no file" result for invalid/undefined input instead of throwing', async () => {
		await expect(detectTextLayer(null)).resolves.toEqual({ hasTextLayer: false, extractedText: null, failureReason: null });
	});

	describe('classifyPdfParseError', () => {
		test('a PasswordException is classified as password_protected', () => {
			expect(classifyPdfParseError({ name: 'PasswordException' })).toBe('password_protected');
		});

		test('any other exception (invalid structure, unexpected failure) is classified as corrupted', () => {
			expect(classifyPdfParseError({ name: 'InvalidPDFException' })).toBe('corrupted');
			expect(classifyPdfParseError(new Error('boom'))).toBe('corrupted');
			expect(classifyPdfParseError(null)).toBe('corrupted');
		});
	});

	test('MIN_TEXT_LENGTH filters out noise-level text', () => {
		expect(MIN_TEXT_LENGTH).toBeGreaterThan(0);
	});
});
