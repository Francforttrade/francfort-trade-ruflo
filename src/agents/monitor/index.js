const logger = require('../../utils/logger');
const { countFtrsInAnalysis, getFinalizedFtrsLast7Days, getAverageCycleDays } = require('./kpiQueries');
const { calculatePercentage, needsPaymentSlaAlert, needsAgentErrorAlert } = require('./slaCalculations');
const { buildKpiDashboard } = require('./dashboard');

// MONITOR: KPI calculation, SLA alerts, health checks, dashboard export. SLA: Hourly.
async function process(context) {
	const [ftrsInAnalysis, finalized, avgCycleDays] = await Promise.all([
		countFtrsInAnalysis(),
		getFinalizedFtrsLast7Days(),
		getAverageCycleDays(),
	]);

	const paymentSlaPct = calculatePercentage(context.paymentsOnTime, context.paymentsTotal);
	const documentationSlaPct = calculatePercentage(context.docsOnTime, context.docsTotal);
	const agentErrorRatePct = calculatePercentage(context.agentErrors, context.agentCalls);

	const dashboard = buildKpiDashboard({
		ftrsInAnalysis,
		finalized,
		avgCycleDays,
		paymentSlaPct,
		documentationSlaPct,
		agentErrorRatePct,
	});

	if (needsPaymentSlaAlert(paymentSlaPct)) {
		logger.warn('SLA de pagamento em risco', { paymentSlaPct });
	}
	if (needsAgentErrorAlert(agentErrorRatePct)) {
		logger.warn('Taxa de erro de agentes acima do limite', { agentErrorRatePct });
	}

	return { agent: 'monitor', dashboard };
}

module.exports = { process };
