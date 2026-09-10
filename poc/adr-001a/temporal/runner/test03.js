// Executes TEST-03-WAIT-RESUME per TEST_CONTRACT.md.
// Starts waitResumeWorkflow, confirms it is paused (no Activity scheduled
// yet), sends resumeSignal, confirms the Activity then executes.

const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	const client = await getClient();
	const workflowId = `test03-wait-resume-${Date.now()}`;
	const context = {
		ftrCode: 'ftr-poc-t03',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};

	const handle = await client.workflow.start('waitResumeWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [context],
	});

	// Give the Worker a moment to process the initial Workflow Task
	// (schedule + start + complete, landing on the condition() wait) before
	// we inspect history for "no Activity scheduled yet".
	await sleep(1500);

	const preSignalHistory = await handle.fetchHistory();
	const preSignalEvents = summarizeHistory(preSignalHistory);
	const activityScheduledBeforeSignal = preSignalEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');

	const preSignalDescribe = await handle.describe();

	await handle.signal('resumeSignal');

	const result = await handle.result();

	const postSignalHistory = await handle.fetchHistory();
	const postSignalEvents = summarizeHistory(postSignalHistory);
	const activityScheduledAfterSignal = postSignalEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');

	const pass = !activityScheduledBeforeSignal && activityScheduledAfterSignal && result && result.agent === 'compliance';

	const evidence = {
		testId: 'TEST-03-WAIT-RESUME',
		workflowId,
		runId: handle.firstExecutionRunId,
		preSignalStatus: preSignalDescribe.status.name,
		preSignalEventCount: preSignalEvents.length,
		activityScheduledBeforeSignal,
		activityScheduledAfterSignal,
		postSignalEventCount: postSignalEvents.length,
		result,
		preSignalHistorySummary: preSignalEvents,
		postSignalHistorySummary: postSignalEvents,
		passCriteria: 'Event history shows a wait/marker event before the signal and Activity scheduling only after it.',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-03', evidence);
	console.log(`TEST-03 verdict: ${evidence.verdict}`);
	console.log(`  workflowId=${workflowId}`);
	console.log(`  activityScheduledBeforeSignal=${activityScheduledBeforeSignal} (expected false)`);
	console.log(`  activityScheduledAfterSignal=${activityScheduledAfterSignal} (expected true)`);
	console.log(`  final result.agent=${result && result.agent}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-03 ERROR', err);
	process.exit(2);
});
