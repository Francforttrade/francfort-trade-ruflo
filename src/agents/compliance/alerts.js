// ROADMAP: "ACID expiry in 7 days → email Rodrigo + DOCUMENTACAO" /
// "Alertar 7 dias antes expirar" (Phyto renewal tracking).
const ALERT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntilExpiry(expiryDateIso, now = new Date()) {
	return Math.ceil((new Date(expiryDateIso).getTime() - now.getTime()) / DAY_MS);
}

function needsExpiryAlert(expiryDateIso, now = new Date()) {
	const days = daysUntilExpiry(expiryDateIso, now);
	return days >= 0 && days <= ALERT_WINDOW_DAYS;
}

module.exports = { ALERT_WINDOW_DAYS, daysUntilExpiry, needsExpiryAlert };
