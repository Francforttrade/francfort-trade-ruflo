const { buildKpiDashboard } = require('./dashboard');

describe('monitor dashboard', () => {
	test('flags the payment SLA alert inside the dashboard payload', () => {
		const dashboard = buildKpiDashboard({
			ftrsInAnalysis: 4,
			finalized: { count: 2, revenue_usd: 1500000 },
			avgCycleDays: 12.5,
			paymentSlaPct: 80,
			documentationSlaPct: 99,
			agentErrorRatePct: 1,
		});

		expect(dashboard.ftrs_in_analysis).toBe(4);
		expect(dashboard.finalized_last_7_days).toEqual({ count: 2, revenue_usd: 1500000 });
		expect(dashboard.alerts).toEqual({ payment_sla_at_risk: true, agent_error_rate_high: false });
		expect(typeof dashboard.generated_at).toBe('string');
	});
});
