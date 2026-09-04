function mockGoogleAuthWith(requestImpl) {
	const request = jest.fn(requestImpl);
	const getIdTokenClient = jest.fn().mockResolvedValue({ request });
	jest.doMock('google-auth-library', () => ({
		GoogleAuth: jest.fn().mockImplementation(() => ({ getIdTokenClient })),
	}));
	return { request, getIdTokenClient };
}

describe('digitalizacao ocrClient', () => {
	beforeEach(() => {
		jest.resetModules();
		process.env.PADDLE_OCR_SERVICE_URL = 'https://paddleocr-worker.internal';
	});

	afterEach(() => {
		jest.dontMock('google-auth-library');
		delete process.env.PADDLE_OCR_SERVICE_URL;
	});

	describe('runOcr', () => {
		test('posts to /ocr with an ID-token-authorized client and returns the response body', async () => {
			const { request } = mockGoogleAuthWith(async () => ({ data: { text: 'Invoice Number: INV-01', confidence: 0.92, pages: 1 } }));
			const { runOcr } = require('./ocrClient');

			const result = await runOcr({ fileBase64: 'base64data', mimeType: 'image/jpeg' });

			expect(result).toEqual({ text: 'Invoice Number: INV-01', confidence: 0.92, pages: 1 });
			expect(request).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://paddleocr-worker.internal/ocr',
					method: 'POST',
					data: { file_base64: 'base64data', mime_type: 'image/jpeg' },
				})
			);
		});

		test('reuses the same authorized client across calls instead of re-authenticating every time', async () => {
			const { getIdTokenClient } = mockGoogleAuthWith(async () => ({ data: { text: '', confidence: 0, pages: 1 } }));
			const { runOcr } = require('./ocrClient');

			await runOcr({ fileBase64: 'a', mimeType: 'image/jpeg' });
			await runOcr({ fileBase64: 'b', mimeType: 'image/jpeg' });

			expect(getIdTokenClient).toHaveBeenCalledTimes(1);
		});

		test('returns null instead of throwing when the worker call fails', async () => {
			mockGoogleAuthWith(async () => {
				throw new Error('ECONNREFUSED');
			});
			const { runOcr } = require('./ocrClient');

			expect(await runOcr({ fileBase64: 'a', mimeType: 'image/jpeg' })).toBeNull();
		});

		test('returns null without attempting a call when PADDLE_OCR_SERVICE_URL is not configured', async () => {
			delete process.env.PADDLE_OCR_SERVICE_URL;
			const { getIdTokenClient } = mockGoogleAuthWith(async () => ({ data: {} }));
			const { runOcr } = require('./ocrClient');

			expect(await runOcr({ fileBase64: 'a', mimeType: 'image/jpeg' })).toBeNull();
			expect(getIdTokenClient).not.toHaveBeenCalled();
		});
	});

	describe('runTableOcr', () => {
		test('posts to /table and returns the response body', async () => {
			const { request } = mockGoogleAuthWith(async () => ({ data: { table_rows: [{ a: 1 }], confidence: 0.8 } }));
			const { runTableOcr } = require('./ocrClient');

			const result = await runTableOcr({ fileBase64: 'base64data', mimeType: 'image/jpeg' });

			expect(result).toEqual({ table_rows: [{ a: 1 }], confidence: 0.8 });
			expect(request).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://paddleocr-worker.internal/table' }));
		});
	});
});
