// ADR-001A PoC — TEST-06 (HITL) Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// Architectural rule this file enforces: the WORKFLOW owns waiting/resume
// (via condition()); the Activity (recordBuyerDecision) owns only
// recording an already-supplied decision. The Activity itself contains
// no wait/durability logic — see
// poc/adr-001a/temporal/activities/buyerDecisionActivity.js.
//
// No production QUALIDADE invocation anywhere in this file.

const { proxyActivities, defineSignal, setHandler, condition } = require('@temporalio/workflow');

const { recordBuyerDecision } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const buyerDecisionSignal = defineSignal('buyerDecisionSignal');

/**
 * Pauses at WAIT_BUYER_APPROVAL until an external decision signal
 * arrives, then records exactly what the signal carried.
 */
async function buyerDecisionWorkflow() {
	let decision = null;
	setHandler(buyerDecisionSignal, (signalDecision) => {
		// Latch semantics: only the first signal sets the decision. A
		// duplicate/second signal is received but does not change an
		// already-set decision — satisfies "duplicate signal must not
		// promote the decision more than once."
		if (decision === null) {
			decision = signalDecision;
		}
	});
	await condition(() => decision !== null);
	return recordBuyerDecision({ decision });
}

module.exports = { buyerDecisionWorkflow, buyerDecisionSignal };
