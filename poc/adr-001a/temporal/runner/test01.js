// Executes TEST-01-PERSISTENT-WORKFLOW-IDENTITY per TEST_CONTRACT.md
// (frozen). Starts complianceWorkflow with an explicit, FTR-code-derived
// workflow ID and synthetic input; then, from a SEPARATE Client
// connection, fetches a handle for the SAME workflow ID and queries its
// status, confirming it resolves to the same single execution.

const { getClient, TASK_QUEUE, writeEvidence } = require('./lib');

async function main() {
	const startClient = await getClient();
	const workflowId = 'ftr-poc-0001';
	const syntheticInput = {
		ftrCode: 'ftr-poc-0001',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};

	const startHandle = await startClient.workflow.start('complianceWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [syntheticInput],
	});
	const startedRunId = startHandle.firstExecutionRunId;

	// Wait for the execution to actually complete so describe() below
	// reflects a stable, queryable final status rather than a race with
	// the Worker still processing it.
	const startResult = await startHandle.result();

	// ACTION: a SEPARATE Client call fetches a handle for the identical
	// workflow ID and queries its status.
	const lookupClient = await getClient();
	const lookupHandle = lookupClient.workflow.getHandle(workflowId);
	const description = await lookupHandle.describe();

	const resolvedWorkflowId = description.workflowId;
	const resolvedRunId = description.runId;
	const resolvedStatus = description.status.name;

	// PASS_CRITERIA: returned workflowId/runId match the originally
	// started execution; exactly one execution exists for that ID —
	// confirmed by both handles agreeing on the same runId (a duplicate,
	// independent execution for the same ID would either be structurally
	// impossible while open, per TEST-07's own finding, or would surface
	// as a DIFFERENT runId here).
	const workflowIdMatches = resolvedWorkflowId === workflowId;
	const runIdMatches = resolvedRunId === startedRunId;
	const handleResolved = !!description && resolvedStatus === 'COMPLETED';

	const pass = workflowIdMatches && runIdMatches && handleResolved;

	const evidence = {
		testId: 'TEST-01-PERSISTENT-WORKFLOW-IDENTITY',
		workflowId,
		syntheticInput,
		startedRunId,
		startResult,
		lookup: {
			resolvedWorkflowId,
			resolvedRunId,
			resolvedStatus,
		},
		workflowIdMatches,
		runIdMatches,
		handleResolved,
		passCriteria: 'Returned workflowId/runId match the originally started execution; exactly one execution exists for that ID.',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-01', evidence);
	console.log(`TEST-01 verdict: ${evidence.verdict}`);
	console.log(`  workflowId=${workflowId}`);
	console.log(`  startedRunId=${startedRunId}`);
	console.log(`  lookup.resolvedWorkflowId=${resolvedWorkflowId} (expected ${workflowId}) -> match=${workflowIdMatches}`);
	console.log(`  lookup.resolvedRunId=${resolvedRunId} (expected ${startedRunId}) -> match=${runIdMatches}`);
	console.log(`  lookup.resolvedStatus=${resolvedStatus}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-01 ERROR', err);
	process.exit(2);
});
