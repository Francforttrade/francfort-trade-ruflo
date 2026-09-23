// Executes TEST-06-HITL per TEST_CONTRACT.md.
// Runs buyerDecisionWorkflow twice: once signaled APPROVED, once signaled
// REJECTED. Confirms the wait holds until the external signal arrives and
// the recording stub merely records what the signal carried.

const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(label, decision) {
	const client = await getClient();
	const workflowId = `test06-${label}-${Date.now()}`;

	const handle = await client.workflow.start('buyerDecisionWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [],
	});

	await sleep(1500);
	const preSignalHistory = await handle.fetchHistory();
	const preSignalEvents = summarizeHistory(preSignalHistory);
	const activityScheduledBeforeSignal = preSignalEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');

	await handle.signal('buyerDecisionSignal', decision);
	const result = await handle.result();

	const postSignalHistory = await handle.fetchHistory();
	const postSignalEvents = summarizeHistory(postSignalHistory);
	const activityScheduledAfterSignal = postSignalEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');

	return {
		label,
		workflowId,
		runId: handle.firstExecutionRunId,
		decisionSent: decision,
		result,
		activityScheduledBeforeSignal,
		activityScheduledAfterSignal,
		decisionMatches: result.decision === decision,
		waitHeld: !activityScheduledBeforeSignal && activityScheduledAfterSignal,
	};
}

async function main() {
	const runApproved = await runOnce('approved', 'APPROVED');
	const runRejected = await runOnce('rejected', 'REJECTED');

	const pass = runApproved.decisionMatches && runApproved.waitHeld && runRejected.decisionMatches && runRejected.waitHeld;

	const evidence = {
		testId: 'TEST-06-HITL',
		runs: [runApproved, runRejected],
		passCriteria: 'Both APPROVED and REJECTED runs show the wait point held until signaled, and the correct downstream branch in each case.',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-06', evidence);
	console.log(`TEST-06 verdict: ${evidence.verdict}`);
	console.log(`  APPROVED run -> workflowId=${runApproved.workflowId} decision=${runApproved.result.decision} waitHeld=${runApproved.waitHeld}`);
	console.log(`  REJECTED run -> workflowId=${runRejected.workflowId} decision=${runRejected.result.decision} waitHeld=${runRejected.waitHeld}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-06 ERROR', err);
	process.exit(2);
});
