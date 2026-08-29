const mockCountFtrsInAnalysis = jest.fn();
const mockGetFinalizedFtrsLast7Days = jest.fn();
const mockGetAverageCycleDays = jest.fn();

jest.mock('./kpiQueries', () => ({
	countFtrsInAnalysis: (...args) => mockCountFtrsInAnalysis(...args),
	getFinalizedFtrsLast7Days: (...args) => mockGetFinalizedFtrsLast7Days(...args),
	getAverageCycleDays: (...args) => mockGetAverageCycleDays(...args),
}));

const { process } = require('./index');

describe('monitor agent', () => {
	beforeEach(() => {
		mockCountFtrsInAnalysis.mockReset().mockResolvedValue(4);
		mockGetFinalizedFtrsLast7Days.mockReset().mockResolvedValue({ count: 2, revenue_usd: 1500000 });
		mockGetAverageCycleDays.mockReset().mockResolvedValue(12.5);
	});

	test('builds the dashboard from Supabase KPI queries and provided SLA counters', async () => {
		const result = await process({ paymentsOnTime: 80, paymentsTotal: 100, docsOnTime: 98, docsTotal: 100 });

		expect(result.agent).toBe('monitor');
		expect(result.dashboard.ftrs_in_analysis).toBe(4);
		expect(result.dashboard.finalized_last_7_days).toEqual({ count: 2, revenue_usd: 1500000 });
		expect(result.dashboard.payment_sla_pct).toBe(80);
		expect(result.dashboard.documentation_sla_pct).toBe(98);
	});

	test('flags payment SLA at risk below 85%', async () => {
		const result = await process({ paymentsOnTime: 80, paymentsTotal: 100 });
		expect(result.dashboard.alerts.payment_sla_at_risk).toBe(true);
	});

	test('does not flag alerts when no SLA counters are given', async () => {
		const result = await process({});
		expect(result.dashboard.payment_sla_pct).toBeNull();
		expect(result.dashboard.alerts).toEqual({ payment_sla_at_risk: false, agent_error_rate_high: false });
	});
});
