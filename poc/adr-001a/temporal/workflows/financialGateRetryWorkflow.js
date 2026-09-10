// ADR-001A PoC — TEST-08 EXPECTED_BEHAVIOR point 6 Workflow: pass-through
// to evaluateFinancialGateWithInjectedRetries, retry policy configured on
// the proxy exactly as TEST-05's retryWorkflow configures it for
// injectableFailureActivity. No gate logic of its own.

const { proxyActivities } = require('@temporalio/workflow');

const { evaluateFinancialGateWithInjectedRetries } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 5 },
});

/**
 * @param {{failUntilAttempt?: number, syntheticEvidence: object}} input
 */
async function financialGateRetryWorkflow(input) {
	return evaluateFinancialGateWithInjectedRetries(input);
}

module.exports = { financialGateRetryWorkflow };
