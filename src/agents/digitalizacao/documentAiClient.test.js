process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'test-project';

function mockDocumentAiWith(processDocumentImpl) {
	const processDocument = jest.fn(processDocumentImpl);
	jest.doMock('@google-cloud/documentai', () => ({
		v1: {
			DocumentProcessorServiceClient: jest.fn().mockImplementation(() => ({
				processorPath: (project, location, processorId) => `projects/${project}/locations/${location}/processors/${processorId}`,
				processDocument,
			})),
		},
	}));
	return { processDocument };
}

describe('digitalizacao documentAiClient', () => {
	beforeEach(() => {
		jest.resetModules();
		process.env.DOCUMENT_AI_PROCESSOR_ID = 'proc123';
	});

	afterEach(() => {
		jest.dontMock('@google-cloud/documentai');
		delete process.env.DOCUMENT_AI_PROCESSOR_ID;
	});

	describe('averageBlockConfidence', () => {
		test('averages every block layout confidence across all pages', () => {
			const { averageBlockConfidence } = require('./documentAiClient');
			const document = {
				pages: [
					{ blocks: [{ layout: { confidence: 0.9 } }, { layout: { confidence: 0.8 } }] },
					{ blocks: [{ layout: { confidence: 0.7 } }] },
				],
			};

			expect(averageBlockConfidence(document)).toBeCloseTo(0.8, 5);
		});

		test('returns null when there are no blocks to average', () => {
			const { averageBlockConfidence } = require('./documentAiClient');
			expect(averageBlockConfidence({ pages: [] })).toBeNull();
			expect(averageBlockConfidence({})).toBeNull();
		});
	});

	describe('runDocumentAi', () => {
		test('calls processDocument with the raw bytes and returns text + averaged confidence', async () => {
			const { processDocument } = mockDocumentAiWith(async () => [
				{
					document: {
						text: 'Invoice Number: INV-01',
						pages: [{ blocks: [{ layout: { confidence: 0.95 } }] }],
					},
				},
			]);
			const { runDocumentAi } = require('./documentAiClient');

			const result = await runDocumentAi({ fileBase64: 'base64data', mimeType: 'image/jpeg' });

			expect(result).toEqual({ text: 'Invoice Number: INV-01', confidence: 0.95 });
			expect(processDocument).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'projects/test-project/locations/us/processors/proc123',
					rawDocument: { content: 'base64data', mimeType: 'image/jpeg' },
				})
			);
		});

		test('returns null instead of throwing when the API call fails', async () => {
			mockDocumentAiWith(async () => {
				throw new Error('PERMISSION_DENIED');
			});
			const { runDocumentAi } = require('./documentAiClient');

			expect(await runDocumentAi({ fileBase64: 'a', mimeType: 'image/jpeg' })).toBeNull();
		});

		test('returns null when the document has no text', async () => {
			mockDocumentAiWith(async () => [{ document: { text: '' } }]);
			const { runDocumentAi } = require('./documentAiClient');

			expect(await runDocumentAi({ fileBase64: 'a', mimeType: 'image/jpeg' })).toBeNull();
		});

		test('returns undefined without calling the API when DOCUMENT_AI_PROCESSOR_ID is not configured', async () => {
			delete process.env.DOCUMENT_AI_PROCESSOR_ID;
			const { processDocument } = mockDocumentAiWith(async () => [{ document: { text: 'x' } }]);
			const { runDocumentAi } = require('./documentAiClient');

			expect(await runDocumentAi({ fileBase64: 'a', mimeType: 'image/jpeg' })).toBeUndefined();
			expect(processDocument).not.toHaveBeenCalled();
		});
	});
});
