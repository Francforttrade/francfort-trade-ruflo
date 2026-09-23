// Executes TEST-05-RETRY per TEST_CONTRACT.md.
// Runs retryWorkflow with a synthetic failure injection that fails until
// attempt 3, then succeeds. Confirms the engine retries automatically up
// to the succeeding attempt, with no manual/external retry trigger.

const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

async function main() {
	const client = await getClient();
	const workflowId = `test05-retry-${Date.now()}`;
	const failUntilAttempt = 3;

	const handle = await client.workflow.start('retryWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [{ failUntilAttempt, payload: { synthetic: true, testId: 'TEST-05' } }],
	});

	const result = await handle.result();

	const history = await handle.fetchHistory();
	const events = summarizeHistory(history);
	const completedEvents = events.filter((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED');

	// Temporal does not emit a separate history event per failed retry
	// attempt (by design, to keep history compact) — the authoritative
	// per-attempt evidence lives on the single ActivityTaskStarted event's
	// own `attempt` and `lastFailure` fields (raw protobuf, not exposed by
	// summarizeHistory's compact view), which the engine itself stamps.
	const rawStartedEvent = (history.events || []).find(
		(e) => e.eventType === require('@temporalio/proto').temporal.api.enums.v1.EventType.EVENT_TYPE_ACTIVITY_TASK_STARTED
	);
	const engineAttempt = rawStartedEvent && rawStartedEvent.activityTaskStartedEventAttributes.attempt;
	const engineLastFailureMessage =
		rawStartedEvent &&
		rawStartedEvent.activityTaskStartedEventAttributes.lastFailure &&
		rawStartedEvent.activityTaskStartedEventAttributes.lastFailure.message;

	const pass =
		result.succeededOnAttempt === failUntilAttempt &&
		engineAttempt === failUntilAttempt &&
		typeof engineLastFailureMessage === 'string' &&
		engineLastFailureMessage.includes(`attempt ${failUntilAttempt - 1}`) &&
		completedEvents.length === 1;

	const evidence = {
		testId: 'TEST-05-RETRY',
		workflowId,
		runId: handle.firstExecutionRunId,
		failUntilAttempt,
		result,
		engineAttempt,
		engineLastFailureMessage,
		activityCompletedCount: completedEvents.length,
		historySummary: events,
		passCriteria: "Event history shows the engine's own attempt counter reached the expected value, carrying the prior attempt's failure, with eventual success and no external/manual retry trigger.",
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-05', evidence);
	console.log(`TEST-05 verdict: ${evidence.verdict}`);
	console.log(`  workflowId=${workflowId}`);
	console.log(`  succeededOnAttempt (Activity's own return)=${result.succeededOnAttempt} (expected ${failUntilAttempt})`);
	console.log(`  engineAttempt (Temporal ActivityTaskStarted.attempt)=${engineAttempt} (expected ${failUntilAttempt})`);
	console.log(`  engineLastFailureMessage=${engineLastFailureMessage}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-05 ERROR', err);
	process.exit(2);
});
