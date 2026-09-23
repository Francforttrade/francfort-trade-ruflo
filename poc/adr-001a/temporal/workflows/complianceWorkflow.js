// ADR-001A PoC — minimal Temporal Workflow definition.
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application; not imported by src/ or server.js; not built or deployed.
//
// This file defines a Workflow only. It is not executed, not registered
// with a Worker, and not started by a Client in this step.
//
// Determinism note: this file must only import Workflow-safe Temporal APIs
// (`@temporalio/workflow`) plus this proxy declaration. It must NOT import
// the Activity implementation module or any production component directly
// — proxyActivities() below creates a call-by-name proxy; the actual
// function it dispatches to at runtime is wired up later, on the Worker
// side, when a Worker is created and started (not part of this step).

const { proxyActivities } = require('@temporalio/workflow');

// Activity timeout: COMPLIANCE's existing process(context) (src/agents/
// compliance/index.js) performs no I/O — it is a synchronous, in-memory
// computation over static market-rule data. 30 seconds is a deliberately
// short, explicit budget that comfortably covers Activity scheduling and
// Worker round-trip overhead for a non-I/O function, without masking a
// hang the way a long/default timeout would.
const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: {
		// Minimal, explicit retry policy — not Temporal's implicit default.
		maximumAttempts: 3,
	},
});

/**
 * Minimal ADR-001A PoC Workflow.
 *
 * Proves the Workflow -> Activity invocation shape only. Contains no
 * Francfort Trade business rules: input is passed through unchanged to the
 * Activity proxy, and the Activity's result is returned unchanged.
 *
 * @param {object} context - serializable compliance context, forwarded as-is
 * @returns {Promise<object>} the Activity's result, forwarded as-is
 */
async function complianceWorkflow(context) {
	return checkComplianceActivity(context);
}

module.exports = { complianceWorkflow };
