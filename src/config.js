// Centralized configuration for the payment-tracking feature (task spec
// section 12). Kept as one object so "how many days before ETA does the
// alert fire" or "who else gets the alert" is a single, obvious place to
// change rather than a constant buried in whichever module happened to need
// it first.
const ALERT_RECIPIENTS = ['export@francfort.co', ...(process.env.ALERT_EXTRA_RECIPIENTS || '').split(',')]
	.map((email) => email.trim())
	.filter(Boolean);

const CONFIG = {
	TIMEZONE: process.env.TIMEZONE || 'America/Sao_Paulo',
	// How many days before ETA the arrival/collection alert fires — task spec
	// section 6. Change via the ALERT_DAYS_BEFORE env var; no code change
	// needed.
	ALERT_DAYS_BEFORE: Number(process.env.ALERT_DAYS_BEFORE) || 7,
	// Always includes export@francfort.co; add more recipients (financeiro,
	// comercial, o responsável pelo contrato) via the comma-separated
	// ALERT_EXTRA_RECIPIENTS env var, e.g. "financeiro@francfort.co,rodrigo@francfort.co".
	ALERT_RECIPIENTS,
	// When true, alert-sending/Calendar-writing code paths should log what
	// they *would* do instead of doing it — task spec section 15's "modo de
	// teste que não envie e-mails nem altere eventos reais".
	TEST_MODE: process.env.PAYMENT_TRACKING_TEST_MODE === 'true',

	DIGITALIZACAO: {
		// 4-band confidence policy (docs/RDIA_PRD.md §13) applied to the
		// overall confidence (min of classification + all extracted fields):
		// >= AUTO_ACCEPT no review needed; >= ACCEPT_FLAGGED accepted but
		// flagged; >= REVIEW_REQUIRED and below need human review; below that,
		// candidate-only (never persisted as fact). See confidenceScoring.js.
		CONFIDENCE_AUTO_ACCEPT: Number(process.env.DIGITALIZACAO_CONFIDENCE_AUTO_ACCEPT) || 0.95,
		CONFIDENCE_ACCEPT_FLAGGED: Number(process.env.DIGITALIZACAO_CONFIDENCE_ACCEPT_FLAGGED) || 0.8,
		CONFIDENCE_REVIEW_REQUIRED: Number(process.env.DIGITALIZACAO_CONFIDENCE_REVIEW_REQUIRED) || 0.6,

		// Chunk 2a — PaddleOCR worker (services/paddleocr/), a private
		// Cloud Run service reached via ocrClient.js with an IAM identity
		// token, never a public endpoint.
		PADDLE_OCR_SERVICE_URL: process.env.PADDLE_OCR_SERVICE_URL || null,
		OCR_TIMEOUT_MS: Number(process.env.DIGITALIZACAO_OCR_TIMEOUT_MS) || 30000,
		// Below this, PaddleOCR's own reported confidence means the text isn't
		// worth classifying/extracting from at all — see errorCodes.js's
		// OCR_LOW_CONFIDENCE and index.js's use of it.
		OCR_MIN_CONFIDENCE: Number(process.env.DIGITALIZACAO_OCR_MIN_CONFIDENCE) || 0.5,
		// content_hash -> {extractedText, tableRows} dedup cache
		// (dedupCache.js) — skips paying for OCR again on a re-sent/
		// reprocessed attachment. 90 days covers a full FTR lifecycle
		// (docs/ROADMAP.md's cycle-time KPI is measured in weeks).
		CACHE_TTL_DAYS: Number(process.env.DIGITALIZACAO_CACHE_TTL_DAYS) || 90,
		// Per-FTR/per-day caps (rateLimiter.js) — same numeric limits, but
		// tracked as separate budgets per kind ('paddle' vs 'document_ai'),
		// so Paddle's compute-capacity cap and Document AI's $-cost cap never
		// throttle each other.
		MAX_PAID_CALLS_PER_FTR: Number(process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_FTR) || 20,
		MAX_PAID_CALLS_PER_DAY: Number(process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_DAY) || 500,

		// Chunk 2b — Google Document AI, the "expensive" tier: only tried
		// after Paddle (chunk 2a) genuinely failed or came back below
		// OCR_MIN_CONFIDENCE, never up front. Uses the same GCP credentials
		// as Firestore (documentAiClient.js) — no separate API key, just the
		// `roles/documentai.apiUser` grant documented in docs/DEPLOY.md.
		DOCUMENT_AI_PROCESSOR_ID: process.env.DOCUMENT_AI_PROCESSOR_ID || null,
		DOCUMENT_AI_LOCATION: process.env.DOCUMENT_AI_LOCATION || 'us',
		// Below this, Document AI's own reported confidence means even the
		// "last resort" tier isn't trustworthy enough to classify/extract
		// from — same semantics as OCR_MIN_CONFIDENCE, kept as its own
		// setting since Document AI's baseline accuracy differs from Paddle's.
		DOCUMENT_AI_MIN_CONFIDENCE: Number(process.env.DIGITALIZACAO_DOCUMENT_AI_MIN_CONFIDENCE) || 0.5,
	},
};

module.exports = CONFIG;
