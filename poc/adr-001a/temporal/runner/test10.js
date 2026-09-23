// Executes TEST-10-VERSION-EVOLUTION per TEST_CONTRACT.md.
// Starts a Workflow paused mid-flight under "version A" Worker code,
// stops V1, deploys "version B" Worker code, resumes the paused
// instance, then separately starts a fresh instance under V2. Compares
// which branch each took.
//
// Usage: node test10.js <v1WorkerPid>

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
	if (!v1WorkerPid) throw new Error('Usage: node test10.js <v1WorkerPid>');

	const client = await getClient();
	const context = {
		ftrCode: 'ftr-poc-t10',
		market: 'Egypt',
		labResultPpb: 1,
		presentDocuments: { ACID: true },
		expiryDates: {},
	};

	// 1. Start the in-flight instance under V1, let it pause.
	const inFlightId = `test10-inflight-${Date.now()}`;
	const inFlightHandle = await client.workflow.start('waitResumeWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId: inFlightId,
		args: [context],
	});
	await sleep(1500);
	const prePauseHistory = await inFlightHandle.fetchHistory();
	const prePauseEvents = summarizeHistory(prePauseHistory);
	const pausedBeforeSwap = !prePauseEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');

	// 2. Stop V1 Worker.
	process.kill(v1WorkerPid, 'SIGKILL');
	await sleep(1000);

	// 3. Deploy V2 Worker (same task queue).
	const logFile = path.join(__dirname, 'evidence', 'TEST-10-v2-worker.log');
	const v2Proc = spawnV2Worker(logFile);
	const v2Pid = v2Proc.pid;
	const v2Ready = await waitForPollerPid(v2Pid, 20000);

	// 4. Resume the in-flight (paused-under-V1) instance now that only V2 is polling.
	await inFlightHandle.signal('resumeSignal');
	const inFlightResult = await inFlightHandle.result();

	// 5. Start a fresh instance under V2.
	const freshId = `test10-fresh-${Date.now()}`;
	const freshHandle = await client.workflow.start('waitResumeWorkflow', {
		taskQueue: TASK_QUEUE,
		workflowId: freshId,
		args: [context],
	});
	await sleep(800);
	await freshHandle.signal('resumeSignal');
	const freshResult = await freshHandle.result();

	const inFlightTookNewBranch = inFlightResult.pocVersion === 'v2-patched-branch';
	const freshTookNewBranch = freshResult.pocVersion === 'v2-patched-branch';

	// EXPECTED_BEHAVIOR per contract: in-flight completes under ORIGINAL
	// (pre-patch) behavior; fresh instance takes the NEW patched branch —
	// i.e. a DIFFERENCE between the two, with no non-determinism error
	// raised on either.
	const pass = v2Ready && pausedBeforeSwap && !inFlightTookNewBranch && freshTookNewBranch;

	const evidence = {
		testId: 'TEST-10-VERSION-EVOLUTION',
		v1WorkerPid,
		v2WorkerPid: v2Pid,
		v2Ready,
		inFlight: { workflowId: inFlightId, runId: inFlightHandle.firstExecutionRunId, pausedBeforeSwap, result: inFlightResult, tookNewBranch: inFlightTookNewBranch },
		fresh: { workflowId: freshId, runId: freshHandle.firstExecutionRunId, result: freshResult, tookNewBranch: freshTookNewBranch },
		passCriteria: 'In-flight instance completes deterministically under original (pre-patch) behavior; a freshly started instance takes the new, patched branch. No non-determinism error on either.',
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-10', evidence);
	console.log(`TEST-10 verdict: ${evidence.verdict}`);
	console.log(`  v1WorkerPid=${v1WorkerPid} killed; v2WorkerPid=${v2Pid} ready=${v2Ready}`);
	console.log(`  in-flight (${inFlightId}) pausedBeforeSwap=${pausedBeforeSwap} tookNewBranch=${inFlightTookNewBranch} (expected false) result=${JSON.stringify(inFlightResult)}`);
	console.log(`  fresh (${freshId}) tookNewBranch=${freshTookNewBranch} (expected true) result=${JSON.stringify(freshResult)}`);
	console.log(`Evidence written to ${file}`);
	console.log(`NEW_WORKER_PID=${v2Pid}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-10 ERROR', err);
	process.exit(2);
});
