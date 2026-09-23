// ADR-001A PoC — TEST-10 corrected scenario, "version B" (V2) half.
//
// Same exported function/signal names as versionEvolutionWorkflow.js
// (V1), registered by a SEPARATE Worker deployment
// (worker/complianceWorkerV2.js) on the same task queue — never
// simultaneously with V1's file in the same Worker bundle. Adds one
// patched('poc-v2-initial-branch') branch AROUND THE SAME POSITION V1
// calls checkComplianceActivity unconditionally — the position that, for
// an in-flight V1-started instance, is ALREADY recorded in history
// before this Worker version is ever deployed. That is what makes the
// asymmetry observable: a V2 worker replaying that already-recorded
// position sees no patch marker in the pre-existing history and
// correctly reconstructs the OLD branch (patched() returns false during
// that replay), while a freshly started instance (no prior history at
// all) correctly takes the NEW branch (patched() returns true, not
// replaying).

const { proxyActivities, defineSignal, setHandler, condition, patched } = require('@temporalio/workflow');

const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const resumeSignal = defineSignal('resumeSignal');

/**
 * @param {object} context - forwarded unchanged to checkComplianceActivity
 */
async function versionEvolutionWorkflow(context) {
	let result;
	if (patched('poc-v2-initial-branch')) {
		const activityResult = await checkComplianceActivity(context);
		result = { ...activityResult, pocVersion: 'v2-patched-branch' };
	} else {
		result = await checkComplianceActivity(context);
	}

	let resumed = false;
	setHandler(resumeSignal, () => {
		resumed = true;
	});
	await condition(() => resumed);

	return result;
}

module.exports = { versionEvolutionWorkflow, resumeSignal };
