// Executes TEST-02-VALID-STATE-TRANSITIONS per TEST_CONTRACT.md.
// Runs test02BranchingWorkflow once with a complete:true-shaped input and
// once with a complete:false-shaped input (real, unmodified compliance
// checklist branches for market Egypt, which requires document 'ACID').

const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

async function runOnce(label, context, expectedBranch) {
	const client = await getClient();
	const workflowId = `test02-${label}-${Date.now()}`;
	const handle = await client.workflow.start('test02BranchingWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [context],
	});
	const result = await handle.result();
	const history = await handle.fetchHistory();
	return {
		label,
		workflowId,
		runId: handle.firstExecutionRunId,
		context,
		result,
		expectedBranch,
		branchMatches: result.branch === expectedBranch,
		historyEventCount: (history.events || []).length,
		historySummary: summarizeHistory(history),
	};
}

async function main() {
	const completeInput = {
		ftrCode: 'ftr-poc-t02-complete',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};
	const incompleteInput = {
		ftrCode: 'ftr-poc-t02-incomplete',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: {},
		expiryDates: {},
	};

	const runA = await runOnce('complete-true', completeInput, 'PATH_A');
	const runB = await runOnce('complete-false', incompleteInput, 'PATH_B');

	const pass = runA.branchMatches && runB.branchMatches;

	const evidence = {
		testId: 'TEST-02-VALID-STATE-TRANSITIONS',
		runs: [runA, runB],
		passCriteria: 'History for each run matches the expected branch deterministically.',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-02', evidence);
	console.log(`TEST-02 verdict: ${evidence.verdict}`);
	console.log(`  run A (complete:true)  -> workflowId=${runA.workflowId} branch=${runA.result.branch} (expected ${runA.expectedBranch})`);
	console.log(`  run B (complete:false) -> workflowId=${runB.workflowId} branch=${runB.result.branch} (expected ${runB.expectedBranch})`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-02 ERROR', err);
	process.exit(2);
});
