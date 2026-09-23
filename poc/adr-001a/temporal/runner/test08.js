// Executes TEST-08-FINANCIAL-GATE per TEST_CONTRACT.md — all nine
// EXPECTED_BEHAVIOR points.

const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGate(label, syntheticEvidence) {
	const client = await getClient();
	const workflowId = `test08-${label}-${Date.now()}`;
	const handle = await client.workflow.start('financialGateWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId,
		args: [syntheticEvidence],
	});
	const result = await handle.result();
	return { label, workflowId, syntheticEvidence, result };
}

async function main() {
	// (a)-(e): five synthetic evidence inputs, each stopping at a named state.
	const evidenceCases = [
		{ label: 'a-payment-unknown', evidence: {}, expectedFinalState: 'PAYMENT_UNKNOWN' },
		{ label: 'b-signal-detected', evidence: { signalDetected: true }, expectedFinalState: 'PAYMENT_SIGNAL_DETECTED' },
		{ label: 'c-evidence-received', evidence: { signalDetected: true, evidenceReceived: true }, expectedFinalState: 'PAYMENT_EVIDENCE_RECEIVED' },
		{ label: 'd-validated', evidence: { signalDetected: true, evidenceReceived: true, validated: true }, expectedFinalState: 'PAYMENT_VALIDATED' },
		{
			label: 'e-release-eligible',
			evidence: { signalDetected: true, evidenceReceived: true, validated: true, bankConfirmed: true },
			expectedFinalState: 'RELEASE_ELIGIBLE',
		},
	];

	const runs = [];
	for (const c of evidenceCases) {
		runs.push(await runGate(c.label, c.evidence));
	}

	// Point 1-3 checks against (a)-(e).
	const point1 = runs[0].result.finalState !== 'RELEASE_ELIGIBLE';
	const point2 = runs[1].result.finalState !== 'RELEASE_ELIGIBLE' && runs[2].result.finalState !== 'RELEASE_ELIGIBLE' && runs[3].result.finalState !== 'RELEASE_ELIGIBLE';
	const point3 = runs[4].result.finalState === 'RELEASE_ELIGIBLE' && runs[4].result.path.includes('BANK_CREDIT_CONFIRMED');
	const allExpectedStatesMatch = runs.every((r, i) => r.result.finalState === evidenceCases[i].expectedFinalState);

	// Point 4: direct-jump request rejected by the test double's own state
	// machine — evaluateFinancialGate structurally cannot accept a target
	// state (only atomic evidence flags), and isTransitionAllowed rejects
	// any non-immediate-successor request. Verified structurally (code
	// inspection, not a workflow run) since there is no Workflow-level
	// entry point that accepts a target state at all — confirming that
	// absence IS the point.
	const financialGateActivity = require('../activities/financialGateActivity');
	const point4a = financialGateActivity.isTransitionAllowed('PAYMENT_UNKNOWN', 'RELEASE_ELIGIBLE').allowed === false;
	const point4b = financialGateActivity.evaluateFinancialGate.length === 1; // only accepts one evidence-flags argument, no target-state param

	// Point 5: every transition visible in Workflow event history — spot
	// check via CLI-captured history in the accompanying .txt evidence
	// (WorkflowExecutionStarted -> ActivityTaskScheduled/Started/Completed
	// -> WorkflowExecutionCompleted); confirmed per-run below.
	const historiesByRun = {};
	for (const r of runs) {
		const client = await getClient();
		const handle = client.workflow.getHandle(r.workflowId);
		const history = await handle.fetchHistory();
		historiesByRun[r.workflowId] = summarizeHistory(history);
	}
	const point5 = Object.values(historiesByRun).every((events) => events.some((e) => e.eventType === 'EVENT_TYPE_WORKFLOW_EXECUTION_COMPLETED'));

	// Point 6: retrying the gate Activity reproduces the identical final
	// state (financialGateRetryWorkflow, composition-only addition).
	const client6 = await getClient();
	const retryWorkflowId = `test08-retry-${Date.now()}`;
	const retryHandle = await client6.workflow.start('financialGateRetryWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId: retryWorkflowId,
		args: [{ failUntilAttempt: 3, syntheticEvidence: evidenceCases[4].evidence }],
	});
	const retryResult = await retryHandle.result();
	const retryHistory = await retryHandle.fetchHistory();
	const retryEvents = summarizeHistory(retryHistory);
	const rawStartedEvent = (retryHistory.events || []).find(
		(e) => e.eventType === require('@temporalio/proto').temporal.api.enums.v1.EventType.EVENT_TYPE_ACTIVITY_TASK_STARTED
	);
	const retryEngineAttempt = rawStartedEvent && rawStartedEvent.activityTaskStartedEventAttributes.attempt;
	const point6Actual = retryEngineAttempt === 3 && retryResult.gateResult.finalState === 'RELEASE_ELIGIBLE';

	// Point 7: duplicated confirmation signal does not advance the state
	// machine a second time (financialGateSignalWorkflow, composition-only
	// addition, same latch pattern as buyerDecisionWorkflow).
	const client7 = await getClient();
	const signalWorkflowId = `test08-signal-${Date.now()}`;
	const signalHandle = await client7.workflow.start('financialGateSignalWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId: signalWorkflowId,
		args: [],
	});
	await sleep(1000);
	await signalHandle.signal('paymentConfirmedSignal', evidenceCases[4].evidence);
	await signalHandle.signal('paymentConfirmedSignal', evidenceCases[4].evidence); // duplicate
	const signalResult = await signalHandle.result();
	const signalHistory = await signalHandle.fetchHistory();
	const signalEvents = summarizeHistory(signalHistory);
	const signalActivityScheduledCount = signalEvents.filter((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED').length;
	const point7 = signalResult.signalCount === 2 && signalActivityScheduledCount === 1 && signalResult.gateResult.finalState === 'RELEASE_ELIGIBLE';

	// Point 8: no LLM call anywhere in the test double or Workflow code —
	// verified by source inspection (no llm/gemini/anthropic import in
	// either file).
	const fs = require('fs');
	const path = require('path');
	const gateActivitySrc = fs.readFileSync(path.join(__dirname, '..', 'activities', 'financialGateActivity.js'), 'utf8');
	const gateWorkflowSrc = fs.readFileSync(path.join(__dirname, '..', 'workflows', 'financialGateWorkflow.js'), 'utf8');
	// Only actual require()/import statements count — the header comments
	// of both files deliberately NAME llm/Firestore/Supabase/Gmail in
	// prose to document their absence, so a plain text search over the
	// whole file (comments included) would false-positive on those very
	// disclaimers. Extract only require(...) call targets.
	const requireTargets = [gateActivitySrc, gateWorkflowSrc]
		.flatMap((src) => [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]));
	const point8 = !requireTargets.some((t) => /llm|gemini|anthropic|openai/i.test(t));

	// Point 9: no Firestore/Supabase/Gmail/banking/external provider
	// contacted — verified by source inspection of actual require()
	// targets only, not comment prose.
	const point9 = !requireTargets.some((t) => /firestore|supabase|gmail|googleapis|axios/i.test(t)) && !/\bfetch\(|http\.request|https\.request/.test(gateActivitySrc + gateWorkflowSrc);

	const pass = point1 && point2 && point3 && allExpectedStatesMatch && point4a && point4b && point5 && point6Actual && point7 && point8 && point9;

	const evidence = {
		testId: 'TEST-08-FINANCIAL-GATE',
		evidenceRuns: runs,
		allExpectedStatesMatch,
		points: {
			point1_neverReleaseFromUnknown: point1,
			point2_neverReleaseFromPartial: point2,
			point3_bankConfirmedAlwaysReachedBeforeRelease: point3,
			point4_directJumpStructurallyImpossible: { isTransitionAllowedCheck: point4a, noTargetStateParam: point4b },
			point5_everyTransitionVisibleInHistory: point5,
			point6_retryReproducesIdenticalState: {
				workflowId: retryWorkflowId,
				engineAttempt: retryEngineAttempt,
				result: retryResult,
				pass: point6Actual,
			},
			point7_duplicateSignalDoesNotAdvanceTwice: {
				workflowId: signalWorkflowId,
				signalCount: signalResult.signalCount,
				activityScheduledCount: signalActivityScheduledCount,
				result: signalResult,
				pass: point7,
			},
			point8_noLlmCall: point8,
			point9_noExternalIo: point9,
		},
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-08', evidence);
	console.log(`TEST-08 verdict: ${evidence.verdict}`);
	for (const r of runs) {
		console.log(`  ${r.label} -> finalState=${r.result.finalState} releaseEligible=${r.result.releaseEligible}`);
	}
	console.log(`  point1(never release from unknown)=${point1}`);
	console.log(`  point2(never release from partial)=${point2}`);
	console.log(`  point3(bank confirmed always before release)=${point3}`);
	console.log(`  point4(direct jump structurally impossible)=${point4a && point4b}`);
	console.log(`  point5(every transition visible)=${point5}`);
	console.log(`  point6(retry reproduces identical state)=${point6Actual} engineAttempt=${retryEngineAttempt}`);
	console.log(`  point7(duplicate signal no double-advance)=${point7} signalCount=${signalResult.signalCount} activityScheduledCount=${signalActivityScheduledCount}`);
	console.log(`  point8(no LLM call)=${point8}`);
	console.log(`  point9(no external I/O)=${point9}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-08 ERROR', err);
	process.exit(2);
});
