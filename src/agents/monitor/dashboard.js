const { needsPaymentSlaAlert, needsAgentErrorAlert } = require('./slaCalculations');

// ROADMAP: "Endpoint /dashboard/kpi → JSON com últimas 7 days".
function buildKpiDashboard({ ftrsInAnalysis, finalized, avgCycleDays, paymentSlaPct, documentationSlaPct, agentErrorRatePct }) {
	return {
		generated_at: new Date().toISOString(),
		ftrs_in_analysis: ftrsInAnalysis,
		finalized_last_7_days: finalized,
		avg_cycle_days: avgCycleDays,
		payment_sla_pct: paymentSlaPct,
		documentation_sla_pct: documentationSlaPct,
		agent_error_rate_pct: agentErrorRatePct,
		alerts: {
			payment_sla_at_risk: needsPaymentSlaAlert(paymentSlaPct),
			agent_error_rate_high: needsAgentErrorAlert(agentErrorRatePct),
		},
	};
}

module.exports = { buildKpiDashboard };
