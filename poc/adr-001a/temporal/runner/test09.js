// Executes TEST-09-AUDIT-CORRELATION per TEST_CONTRACT.md.
// Runs auditCorrelationWorkflow, then inspects the Workflow's own raw
// history for the writeAuditRecord Activity's completed result (side B:
// the synthetic business audit record) and confirms its workflowId/runId
// field matches the engine's own identifiers (side A).

const { getClient, TASK_QUEUE, writeEvidence, decodeJsonPayload } = require('./lib');

async function main() {
	const client = await getClient();
	const workflowId = `test09-audit-correlation-${Date.now()}`;
	const context = {
		ftrCode: 'ftr-poc-t09',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};

	const handle = await client.workflow.start('auditCorrelationWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [context],
	});

	const result = await handle.result();
	const engineRunId = handle.firstExecutionRunId; // side A

	const history = await handle.fetchHistory();
	const rawEvents = history.events || [];

	const scheduled = rawEvents.find(
		(e) => e.activityTaskScheduledEventAttributes && e.activityTaskScheduledEventAttributes.activityType && e.activityTaskScheduledEventAttributes.activityType.name === 'writeAuditRecord'
	);
	const scheduledEventId = scheduled && scheduled.eventId;
	const completed = rawEvents.find(
		(e) => e.activityTaskCompletedEventAttributes && String(e.activityTaskCompletedEventAttributes.scheduledEventId) === String(scheduledEventId)
	);
	const auditRecord = completed && decodeJsonPayload(completed.activityTaskCompletedEventAttributes.result.payloads[0]); // side B

	const correlationHolds = !!auditRecord && auditRecord.workflowId === workflowId && auditRecord.runId === engineRunId;

	const pass = !!scheduled && !!completed && correlationHolds && auditRecord.event === 'compliance_check_completed' && result && result.agent === 'compliance';

	const evidence = {
		testId: 'TEST-09-AUDIT-CORRELATION',
		workflowId,
		engineRunId,
		sideA_engineIdentifiers: { workflowId, runId: engineRunId },
		sideB_syntheticAuditRecord: auditRecord,
		correlationHolds,
		complianceResult: result,
		passCriteria: 'Correlation field present and matching in both the engine history (side A) and the synthetic audit record (side B).',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-09', evidence);
	console.log(`TEST-09 verdict: ${evidence.verdict}`);
	console.log(`  workflowId=${workflowId} engineRunId=${engineRunId}`);
	console.log(`  auditRecord.workflowId=${auditRecord && auditRecord.workflowId} auditRecord.runId=${auditRecord && auditRecord.runId}`);
	console.log(`  correlationHolds=${correlationHolds}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-09 ERROR', err);
	process.exit(2);
});
