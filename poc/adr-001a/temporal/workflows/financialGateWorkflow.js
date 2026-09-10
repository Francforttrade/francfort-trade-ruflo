// ADR-001A PoC — TEST-08 (financial gate) Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// No production FINANCEIRO invocation anywhere in this file. The gate
// decision is entirely delegated to the deterministic test double at
// poc/adr-001a/temporal/activities/financialGateActivity.js — this
// Workflow contains no gate logic of its own, only a pass-through call
// plus a branch on the double's own `releaseEligible` result.

const { proxyActivities } = require('@temporalio/workflow');

const { evaluateFinancialGate } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

/**
 * @param {object} syntheticEvidence - forwarded unchanged to evaluateFinancialGate
 * @returns {Promise<{finalState: string, path: string[], releaseEligible: boolean}>}
 */
async function financialGateWorkflow(syntheticEvidence) {
	return evaluateFinancialGate(syntheticEvidence);
}

module.exports = { financialGateWorkflow };
