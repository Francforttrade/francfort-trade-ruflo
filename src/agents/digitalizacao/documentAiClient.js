const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1;
const logger = require('../../utils/logger');
const CONFIG = require('../../config');

// Google's own managed API — unlike ocrClient.js's PaddleOCR worker, there's
// no separate service to deploy or authenticate to; the client library uses
// the same Application Default Credentials the rest of the app already has
// (Firestore/Supabase), scoped by the IAM role granted in docs/DEPLOY.md.
let cachedClient = null;

function getClient() {
	if (!cachedClient) {
		cachedClient = new DocumentProcessorServiceClient();
	}
	return cachedClient;
}

// Average of every text block's own confidence — Document AI reports
// confidence per layout block (page.blocks[].layout.confidence), not one
// number for the whole document, so this collapses it to the same shape
// ocrClient.runOcr() returns (overall text + one confidence number),
// keeping tryDocumentAi() in index.js agnostic to which OCR provider ran.
function averageBlockConfidence(document) {
	const confidences = [];
	for (const page of document.pages || []) {
		for (const block of page.blocks || []) {
			if (block.layout && block.layout.confidence != null) {
				confidences.push(block.layout.confidence);
			}
		}
	}
	if (confidences.length === 0) {
		return null;
	}
	return confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
}

// { text, confidence } | null (failed) | undefined (not configured)
async function runDocumentAi({ fileBase64, mimeType }) {
	// undefined ("never attempted") is distinct from null ("attempted and
	// genuinely failed") below — see ocrClient.js's callEndpoint for why
	// index.js's tryDocumentAi() needs that distinction.
	if (!CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID || !process.env.GCP_PROJECT_ID) {
		return undefined;
	}

	try {
		const client = getClient();
		const name = client.processorPath(
			process.env.GCP_PROJECT_ID,
			CONFIG.DIGITALIZACAO.DOCUMENT_AI_LOCATION,
			CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID
		);

		const [result] = await client.processDocument({
			name,
			rawDocument: { content: fileBase64, mimeType },
		});

		const { document } = result;
		if (!document || !document.text) {
			return null;
		}

		return { text: document.text, confidence: averageBlockConfidence(document) };
	} catch (err) {
		logger.warn('DIGITALIZACAO: chamada ao Document AI falhou', { error: err.message });
		return null;
	}
}

module.exports = { runDocumentAi, averageBlockConfidence };
