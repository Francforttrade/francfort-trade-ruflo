// ADR-001A PoC — TEST-05 (retry) Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// Purely a pass-through to the failure-injection test double: contains
// no retry logic of its own — that lives entirely in the `retry` policy
// passed to proxyActivities() below, matching TEST-05's own
// TEMPORAL_MECHANISM_UNDER_TEST field.

const { proxyActivities } = require('@temporalio/workflow');

const { injectableFailureActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	// Higher than the Compliance workflow's cap (3) — POC_PROVISIONAL,
	// chosen only to give TEST-05's TEST_SETUP room to configure
	// failUntilAttempt values and still observe a successful outcome
	// within the retry budget.
	retry: { maximumAttempts: 5 },
});

/**
 * @param {{failUntilAttempt?: number, payload?: unknown}} input
 */
async function retryWorkflow(input) {
	return injectableFailureActivity(input);
}

module.exports = { retryWorkflow };
