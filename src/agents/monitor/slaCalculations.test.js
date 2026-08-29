const {
	calculatePercentage,
	needsPaymentSlaAlert,
	needsAgentErrorAlert,
	PAYMENT_SLA_ALERT_THRESHOLD_PCT,
	AGENT_ERROR_RATE_ALERT_THRESHOLD_PCT,
} = require('./slaCalculations');

describe('monitor slaCalculations', () => {
	test('calculates a percentage, or null with no denominator', () => {
		expect(calculatePercentage(95, 100)).toBe(95);
		expect(calculatePercentage(0, 0)).toBeNull();
	});

	test('flags payment SLA alert below 85%', () => {
		expect(needsPaymentSlaAlert(PAYMENT_SLA_ALERT_THRESHOLD_PCT - 1)).toBe(true);
		expect(needsPaymentSlaAlert(PAYMENT_SLA_ALERT_THRESHOLD_PCT)).toBe(false);
		expect(needsPaymentSlaAlert(null)).toBe(false);
	});

	test('flags agent error rate alert above 5%', () => {
		expect(needsAgentErrorAlert(AGENT_ERROR_RATE_ALERT_THRESHOLD_PCT + 1)).toBe(true);
		expect(needsAgentErrorAlert(AGENT_ERROR_RATE_ALERT_THRESHOLD_PCT)).toBe(false);
		expect(needsAgentErrorAlert(null)).toBe(false);
	});
});
