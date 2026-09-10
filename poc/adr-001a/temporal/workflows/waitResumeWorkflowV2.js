// ADR-001A PoC — TEST-10 (version evolution) "version B" Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// This is a deliberately modified copy of waitResumeWorkflow.js,
// representing a "new version" of the same Workflow type (same exported
// function name `waitResumeWorkflow`, same signal `resumeSignal`) —
// intended to be registered by a SEPARATE Worker deployment
// (worker/complianceWorkerV2.js) pointed at the SAME task queue, never
// simultaneously with V1's file in the same Worker bundle.
//
// Uses @temporalio/workflow's `patched()`, verified from the installed
// package's type definitions
// (node_modules/@temporalio/workflow/lib/workflow.d.ts):
//   `export declare function patched(patchId: string): boolean;`
// "If the workflow is replaying an existing history, then this function
// returns true if that history was produced by a worker which also had a
// `patched` call with the same `patchId`. If the history was produced by
// a worker *without* such a call, then it will return false. If the
// workflow is not currently replaying, then this call *always* returns
// true." — this is exactly the mechanism needed to let an in-flight
// (paused) instance started under V1 (no `patched()` call at this point)
// keep completing under V1's original behavior on replay, while a freshly
// started instance takes the new branch.
//
// Contains no Francfort Trade business schema migration and no
// production component reference — same zero-dependency Compliance
// Activity wrapper as V1, structurally unchanged except for the added
// patched() branch.

const { proxyActivities, defineSignal, setHandler, condition, patched } = require('@temporalio/workflow');

const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const resumeSignal = defineSignal('resumeSignal');

/**
 * Same wait/resume shape as V1. Adds one patched() branch after resuming.
 *
 * @param {object} context - forwarded unchanged to checkComplianceActivity
 */
async function waitResumeWorkflow(context) {
	let resumed = false;
	setHandler(resumeSignal, () => {
		resumed = true;
	});
	await condition(() => resumed);

	if (patched('poc-v2-branch')) {
		// "New" branch: taken by any execution not currently replaying a
		// V1-produced history (i.e. fresh executions started under V2, or
		// V2-produced histories being replayed).
		const result = await checkComplianceActivity(context);
		return { ...result, pocVersion: 'v2-patched-branch' };
	}

	// "Old" branch: taken only when replaying a history produced by a
	// worker without this patched() call (a V1 execution that paused
	// before V2 was deployed) — preserves determinism for that in-flight
	// instance.
	return checkComplianceActivity(context);
}

module.exports = { waitResumeWorkflow, resumeSignal };
