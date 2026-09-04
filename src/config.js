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
		// Per-FTR/per-day caps on OCR worker calls (rateLimiter.js) — Paddle
		// itself has no per-call $ cost (self-hosted), but a cap still bounds
		// how hard one FTR (or one bad day) can hit the worker's compute
		// capacity, and doubles as the cap Chunk 2b's Document AI fallback
		// will reuse once that *is* a paid call.
		MAX_PAID_CALLS_PER_FTR: Number(process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_FTR) || 20,
		MAX_PAID_CALLS_PER_DAY: Number(process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_DAY) || 500,
	},
};

module.exports = CONFIG;
