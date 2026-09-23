// ADR-001A PoC — TEST-10 corrected scenario, "version A" (V1) half.
//
// Addresses the structural gap found when executing the original
// TEST-10 scenario (waitResumeWorkflow.js / waitResumeWorkflowV2.js):
// that pair pauses BEFORE the branch point, so an in-flight instance
// never records any history at the patch position under V1 — meaning
// patched() legitimately (and correctly, per its own documented
// contract) returns true for both in-flight and fresh instances, and
// the intended old/new asymmetry never manifests. See TEST_CONTRACT.md
// TEST-10 row, "STATUS" field, for the full root-cause writeup.
//
// This pair instead calls the (real, unmodified) Compliance Activity
// UNCONDITIONALLY FIRST — so the ActivityTaskScheduled event is recorded
// in history during the workflow's very first Workflow Task, before any
// version swap can occur — and only pauses (awaiting resumeSignal)
// afterward, purely to hold the execution open long enough to swap
// workers and observe. No production business logic; same
// checkComplianceActivity adapter used everywhere else in this PoC.

const { proxyActivities, defineSignal, setHandler, condition } = require('@temporalio/workflow');

const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const resumeSignal = defineSignal('resumeSignal');

/**
 * Calls checkComplianceActivity unconditionally (recorded in history
 * immediately), then pauses awaiting resumeSignal before returning.
 *
 * @param {object} context - forwarded unchanged to checkComplianceActivity
 */
async function versionEvolutionWorkflow(context) {
	const result = await checkComplianceActivity(context);

	let resumed = false;
	setHandler(resumeSignal, () => {
		resumed = true;
	});
	await condition(() => resumed);

	return result;
}

module.exports = { versionEvolutionWorkflow, resumeSignal };
