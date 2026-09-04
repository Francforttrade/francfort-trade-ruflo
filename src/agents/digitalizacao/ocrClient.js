const { GoogleAuth } = require('google-auth-library');
const logger = require('../../utils/logger');
const CONFIG = require('../../config');

// The PaddleOCR worker (services/paddleocr/) is a private Cloud Run
// service — no API key, no public URL. Auth is a Google-signed OIDC ID
// token scoped to that service's own URL (standard Cloud Run
// service-to-service pattern), fetched once and cached/refreshed
// internally by the client itself.
let cachedClient = null;

async function getAuthorizedClient() {
	if (!cachedClient) {
		const auth = new GoogleAuth();
		cachedClient = await auth.getIdTokenClient(CONFIG.DIGITALIZACAO.PADDLE_OCR_SERVICE_URL);
	}
	return cachedClient;
}

async function callEndpoint(path, { fileBase64, mimeType }) {
	if (!CONFIG.DIGITALIZACAO.PADDLE_OCR_SERVICE_URL) {
		return null;
	}

	try {
		const client = await getAuthorizedClient();
		const response = await client.request({
			url: `${CONFIG.DIGITALIZACAO.PADDLE_OCR_SERVICE_URL}${path}`,
			method: 'POST',
			data: { file_base64: fileBase64, mime_type: mimeType },
			timeout: CONFIG.DIGITALIZACAO.OCR_TIMEOUT_MS,
		});
		return response.data;
	} catch (err) {
		logger.warn('DIGITALIZACAO: chamada ao worker PaddleOCR falhou', { path, error: err.message });
		return null;
	}
}

// { text, confidence, pages } | null
async function runOcr({ fileBase64, mimeType }) {
	return callEndpoint('/ocr', { fileBase64, mimeType });
}

// { table_rows, confidence } | null
async function runTableOcr({ fileBase64, mimeType }) {
	return callEndpoint('/table', { fileBase64, mimeType });
}

module.exports = { runOcr, runTableOcr };
