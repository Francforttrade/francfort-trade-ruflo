// ADR-001A PoC — TEST-08 EXPECTED_BEHAVIOR point 7 Workflow: proves a
// duplicated "payment confirmed" signal cannot advance the financial-gate
// state machine a second time. Uses the identical latch pattern already
// established by workflows/buyerDecisionWorkflow.js (first signal sets
// the value, a later signal is received but ignored) — no new
// synchronization primitive, no financial logic of its own. The gate
// evaluation itself (evaluateFinancialGate) is called exactly once, no
// matter how many confirmation signals arrive.

const { proxyActivities, defineSignal, setHandler, condition } = require('@temporalio/workflow');

const { evaluateFinancialGate } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const paymentConfirmedSignal = defineSignal('paymentConfirmedSignal');

/**
 * Waits for a paymentConfirmedSignal carrying syntheticEvidence, then
 * evaluates the gate exactly once against the FIRST signal received.
 * Duplicate signals after the first are received but do not re-trigger
 * evaluation or change the latched evidence — identical latch semantics
 * to buyerDecisionWorkflow's decision latch.
 */
async function financialGateSignalWorkflow() {
	let evidence = null;
	let signalCount = 0;
	setHandler(paymentConfirmedSignal, (syntheticEvidence) => {
		signalCount += 1;
		if (evidence === null) {
			evidence = syntheticEvidence;
		}
	});
	await condition(() => evidence !== null);
	const gateResult = await evaluateFinancialGate(evidence);
	return { gateResult, signalCount };
}

module.exports = { financialGateSignalWorkflow, paymentConfirmedSignal };
