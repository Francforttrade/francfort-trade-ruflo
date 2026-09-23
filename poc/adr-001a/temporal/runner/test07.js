// Executes TEST-07-DUPLICATE-PROTECTION per TEST_CONTRACT.md.
// Starts waitResumeWorkflow (paused, open), then attempts a second
// `start` call with the IDENTICAL Workflow ID while the first is still
// open — simulating a redelivered webhook for the same FTR. Confirms the
// second start is rejected and only one execution's work occurs.

const { WorkflowExecutionAlreadyStartedError } = require('@temporalio/client');
const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	const client = await getClient();
	const workflowId = `test07-duplicate-${Date.now()}`;
	const context = {
		ftrCode: 'ftr-poc-t07',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};

	const firstHandle = await client.workflow.start('waitResumeWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [context],
	});

	await sleep(1500);

	let secondStartRejected = false;
	let secondStartErrorName = null;
	try {
		await client.workflow.start('waitResumeWorkflow', {
			taskQueue: TASK_QUEUE,
			workflowId, // identical ID, simulating redelivery
			args: [context],
		});
	} catch (err) {
		secondStartRejected = err instanceof WorkflowExecutionAlreadyStartedError || err.name === 'WorkflowExecutionAlreadyStartedError';
		secondStartErrorName = err.name;
		if (!secondStartRejected) throw err; // unexpected error type — surface it
	}

	// Resolve the still-open first execution.
	await firstHandle.signal('resumeSignal');
	const result = await firstHandle.result();

	const history = await firstHandle.fetchHistory();
	const events = summarizeHistory(history);
	const activityScheduledEvents = events.filter((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');
	const workflowStartedEvents = events.filter((e) => e.eventType === 'EVENT_TYPE_WORKFLOW_EXECUTION_STARTED');

	const pass =
		secondStartRejected &&
		activityScheduledEvents.length === 1 &&
		workflowStartedEvents.length === 1 &&
		result &&
		result.agent === 'compliance';

	const evidence = {
		testId: 'TEST-07-DUPLICATE-PROTECTION',
		workflowId,
		runId: firstHandle.firstExecutionRunId,
		secondStartRejected,
		secondStartErrorName,
		activityScheduledEventCount: activityScheduledEvents.length,
		workflowStartedEventCount: workflowStartedEvents.length,
		result,
		passCriteria: "Exactly one execution's work occurs for the duplicated ID; the second start call surfaces a clear reuse-policy response.",
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-07', evidence);
	console.log(`TEST-07 verdict: ${evidence.verdict}`);
	console.log(`  workflowId=${workflowId}`);
	console.log(`  secondStartRejected=${secondStartRejected} (errorName=${secondStartErrorName})`);
	console.log(`  activityScheduledEventCount=${activityScheduledEvents.length} (expected 1, single execution)`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-07 ERROR', err);
	process.exit(2);
});
