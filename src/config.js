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
};

module.exports = CONFIG;
