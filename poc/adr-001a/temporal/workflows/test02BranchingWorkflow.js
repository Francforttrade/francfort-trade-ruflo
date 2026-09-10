// ADR-001A PoC — TEST-02 (valid state transitions) dedicated branching
// Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// Purpose: prove the durable engine's deterministic Workflow-level
// branching, driven by the REAL, unmodified COMPLIANCE Activity's own
// return-shape field (`checklist.complete`) — matching TEST-02's frozen
// TEST_SETUP in TEST_CONTRACT.md, which requires the branch to reflect
// "real, existing return-shape branches of the unmodified
// compliance.process function — not invented."
//
// This file does NOT duplicate any production business rule (market
// regulatory rules, aflatoxin thresholds, document requirements,
// checklist construction logic, buyer rules, financial rules) — it only
// reads one already-computed boolean field from the Activity's result
// and branches the WORKFLOW's own control flow on it. The branch outcome
// labels (PATH_A / PATH_B) are synthetic PoC-level labels, not Francfort
// Trade lifecycle states — they must not be read as production status
// values.

const { proxyActivities } = require('@temporalio/workflow');

const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

/**
 * @param {object} context - forwarded unchanged to checkComplianceActivity
 * @returns {Promise<{branch: 'PATH_A'|'PATH_B', result: object}>}
 */
async function test02BranchingWorkflow(context) {
	const result = await checkComplianceActivity(context);

	if (result.checklist.complete) {
		return { branch: 'PATH_A', result };
	}
	return { branch: 'PATH_B', result };
}

module.exports = { test02BranchingWorkflow };
