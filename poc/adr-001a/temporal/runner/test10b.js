// TEST-10 corrected scenario (addendum, not a replacement for the
// original TEST-10 row/evidence). Uses versionEvolutionWorkflow.js (V1)
// / versionEvolutionWorkflowV2.js (V2), which call checkComplianceActivity
// UNCONDITIONALLY BEFORE pausing — so an in-flight instance's Activity
// call is already recorded in history before any version swap, unlike
// the original waitResumeWorkflow.js pair.
//
// Usage: node test10b.js <v1WorkerPid>

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

const V2_WORKER_ENTRY = path.join(__dirname, '..', 'harness', 'runPocWorkerProcessV2.js');
const POC_ROOT = path.join(__dirname, '..');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnV2Worker(logFile) {
	const fd = fs.openSync(logFile, 'a');
	const child = spawn(process.execPath, [V2_WORKER_ENTRY], {
		cwd: POC_ROOT,
		detached: true,
		stdio: ['ignore', fd, fd],
	});
	child.unref();
	return child;
}

async function waitForPollerPid(pid, timeoutMs) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const out = execSync('temporal task-queue describe --task-queue ' + TASK_QUEUE, { encoding: 'utf8' });
			if (out.includes(String(pid) + '@')) return true;
		} catch (e) {
			// retry
		}
		await sleep(1000);
	}
	return false;
}

async function main() {
	const v1WorkerPid = parseInt(process.argv[2], 10);
	if (!v1WorkerPid) throw new Error('Usage: node test10b.js <v1WorkerPid>');

	const client = await getClient();
	const context = {
		ftrCode: 'ftr-poc-t10b',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};

	// 1. Start the in-flight instance under V1. Its checkComplianceActivity
	// call happens immediately (unconditional), then it pauses.
	const inFlightId = `test10b-inflight-${Date.now()}`;
	const inFlightHandle = await client.workflow.start('versionEvolutionWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId: inFlightId,
		args: [context],
	});
	await sleep(2000);
	const prePauseHistory = await inFlightHandle.fetchHistory();
	const prePauseEvents = summarizeHistory(prePauseHistory);
	const activityRecordedBeforeSwap = prePauseEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');
	const activityCompletedBeforeSwap = prePauseEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED');

	// 2. Stop V1 Worker.
	process.kill(v1WorkerPid, 'SIGKILL');
	await sleep(1000);

	// 3. Deploy V2 Worker (same task queue).
	const logFile = path.join(__dirname, 'evidence', 'TEST-10b-v2-worker.log');
	const v2Proc = spawnV2Worker(logFile);
	const v2Pid = v2Proc.pid;
	const v2Ready = await waitForPollerPid(v2Pid, 20000);

	// 4. Resume the in-flight instance now that only V2 is polling. This
	// forces V2 to replay the ALREADY-RECORDED Activity call from scratch.
	await inFlightHandle.signal('resumeSignal');
	const inFlightResult = await inFlightHandle.result();

	const postResumeHistory = await inFlightHandle.fetchHistory();
	const postResumeEvents = summarizeHistory(postResumeHistory);
	const activityScheduledCountTotal = postResumeEvents.filter((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED').length;
	const markerRecordedEventsInFlight = (postResumeHistory.events || []).filter(
		(e) => e.eventType === require('@temporalio/proto').temporal.api.enums.v1.EventType.EVENT_TYPE_MARKER_RECORDED
	);

	// 5. Start a fresh instance under V2 (no prior history at all).
	const freshId = `test10b-fresh-${Date.now()}`;
	const freshHandle = await client.workflow.start('versionEvolutionWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId: freshId,
		args: [context],
	});
	await sleep(1000);
	await freshHandle.signal('resumeSignal');
	const freshResult = await freshHandle.result();
	const freshHistory = await freshHandle.fetchHistory();
	const markerRecordedEventsFresh = (freshHistory.events || []).filter(
		(e) => e.eventType === require('@temporalio/proto').temporal.api.enums.v1.EventType.EVENT_TYPE_MARKER_RECORDED
	);

	const inFlightTookNewBranch = inFlightResult.pocVersion === 'v2-patched-branch';
	const freshTookNewBranch = freshResult.pocVersion === 'v2-patched-branch';

	const pass =
		v2Ready &&
		activityRecordedBeforeSwap &&
		activityCompletedBeforeSwap &&
		activityScheduledCountTotal === 1 && // no duplicate Activity execution across the replay
		!inFlightTookNewBranch && // in-flight preserves OLD behavior
		freshTookNewBranch; // fresh instance takes NEW behavior

	const evidence = {
		testId: 'TEST-10-VERSION-EVOLUTION (corrected scenario addendum)',
		v1WorkerPid,
		v2WorkerPid: v2Pid,
		v2Ready,
		inFlight: {
			workflowId: inFlightId,
			runId: inFlightHandle.firstExecutionRunId,
			activityRecordedBeforeSwap,
			activityCompletedBeforeSwap,
			activityScheduledCountTotal,
			result: inFlightResult,
			tookNewBranch: inFlightTookNewBranch,
			markerRecordedEvents: markerRecordedEventsInFlight.length,
		},
		fresh: {
			workflowId: freshId,
			runId: freshHandle.firstExecutionRunId,
			result: freshResult,
			tookNewBranch: freshTookNewBranch,
			markerRecordedEvents: markerRecordedEventsFresh.length,
		},
		passCriteria:
			'In-flight instance (Activity call already recorded pre-swap) replays under OLD behavior with no duplicate Activity execution; freshly started instance (no prior history) takes NEW behavior. No non-determinism error on either.',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-10b', evidence);
	console.log(`TEST-10 (corrected scenario) verdict: ${evidence.verdict}`);
	console.log(`  v1WorkerPid=${v1WorkerPid} killed; v2WorkerPid=${v2Pid} ready=${v2Ready}`);
	console.log(`  in-flight (${inFlightId}) activityRecordedBeforeSwap=${activityRecordedBeforeSwap} activityCompletedBeforeSwap=${activityCompletedBeforeSwap}`);
	console.log(`  in-flight activityScheduledCountTotal=${activityScheduledCountTotal} (expected 1, no duplicate on replay)`);
	console.log(`  in-flight tookNewBranch=${inFlightTookNewBranch} (expected false) result=${JSON.stringify(inFlightResult)}`);
	console.log(`  fresh (${freshId}) tookNewBranch=${freshTookNewBranch} (expected true) result=${JSON.stringify(freshResult)}`);
	console.log(`Evidence written to ${file}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-10 (corrected scenario) ERROR', err);
	process.exit(2);
});
