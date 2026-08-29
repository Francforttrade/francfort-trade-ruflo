// ROADMAP targets/thresholds:
// - Payment SLA target 95%, alert if < 85%
// - Documentation SLA target 98%
// - Agent error rate alert if > 5%
const PAYMENT_SLA_TARGET_PCT = 95;
const DOCUMENTATION_SLA_TARGET_PCT = 98;
const PAYMENT_SLA_ALERT_THRESHOLD_PCT = 85;
const AGENT_ERROR_RATE_ALERT_THRESHOLD_PCT = 5;

function calculatePercentage(numerator, denominator) {
	if (!denominator) {
		return null;
	}
	return (numerator / denominator) * 100;
}

function needsPaymentSlaAlert(paymentSlaPct) {
	return paymentSlaPct != null && paymentSlaPct < PAYMENT_SLA_ALERT_THRESHOLD_PCT;
}

function needsAgentErrorAlert(errorRatePct) {
	return errorRatePct != null && errorRatePct > AGENT_ERROR_RATE_ALERT_THRESHOLD_PCT;
}

module.exports = {
	PAYMENT_SLA_TARGET_PCT,
	DOCUMENTATION_SLA_TARGET_PCT,
	PAYMENT_SLA_ALERT_THRESHOLD_PCT,
	AGENT_ERROR_RATE_ALERT_THRESHOLD_PCT,
	calculatePercentage,
	needsPaymentSlaAlert,
	needsAgentErrorAlert,
};
