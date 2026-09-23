// Executes TEST-04-FAILURE-RECOVERY per TEST_CONTRACT.md.
// Scope: Worker/process failure recovery only (Temporal Server keeps
// running throughout — see persistence-scope discipline in
// TEST_CONTRACT.md). Starts waitResumeWorkflow, confirms it is paused,
// kills the Worker process, spawns a fresh Worker process on the same
// task queue against the same still-running Server, sends the resume
// signal, and confirms the Workflow completes correctly with no
// duplicated/skipped Activity execution.
//
// Usage: node test04.js <oldWorkerPid>

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getClient, TASK_QUEUE, writeEvidence, summarizeHistory } = require('./lib');

const WORKER_ENTRY = path.join(__dirname, '..', 'harness', 'runPocWorkerProcess.js');
const POC_ROOT = path.join(__dirname, '..');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnWorker(logFile) {
	const fd = fs.openSync(logFile, 'a');
	const child = spawn(process.execPath, [WORKER_ENTRY], {
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
			// ignore transient CLI errors, retry
		}
		await sleep(1000);
	}
	return false;
}

async function main() {
	const oldWorkerPid = parseInt(process.argv[2], 10);
	if (!oldWorkerPid) {
		throw new Error('Usage: node test04.js <oldWorkerPid>');
	}

	const client = await getClient();
	const workflowId = `test04-failure-recovery-${Date.now()}`;
	const context = {
		ftrCode: 'ftr-poc-t04',
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

	await sleep(1500);
	const preKillHistory = await handle.fetchHistory();
	const preKillEvents = summarizeHistory(preKillHistory);
	const activityScheduledBeforeKill = preKillEvents.some((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');

	process.kill(oldWorkerPid, 'SIGKILL');
	const killedAt = new Date().toISOString();

	await sleep(1000);

	const logFile = path.join(__dirname, 'evidence', 'TEST-04-new-worker.log');
	const newWorkerProc = spawnWorker(logFile);
	const newWorkerPid = newWorkerProc.pid;

	const newWorkerReady = await waitForPollerPid(newWorkerPid, 20000);

	await handle.signal('resumeSignal');
	const result = await handle.result();

	const postHistory = await handle.fetchHistory();
	const postEvents = summarizeHistory(postHistory);
	const activityScheduledEvents = postEvents.filter((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_SCHEDULED');
	const activityCompletedEvents = postEvents.filter((e) => e.eventType === 'EVENT_TYPE_ACTIVITY_TASK_COMPLETED');

	const pass =
		newWorkerReady &&
		!activityScheduledBeforeKill &&
		activityScheduledEvents.length === 1 &&
		activityCompletedEvents.length === 1 &&
		result &&
		result.agent === 'compliance';

	const evidence = {
		testId: 'TEST-04-FAILURE-RECOVERY',
		workflowId,
		runId: handle.firstExecutionRunId,
		oldWorkerPid,
		killedAt,
		newWorkerPid,
		newWorkerReady,
		activityScheduledBeforeKill,
		activityScheduledEventCount: activityScheduledEvents.length,
		activityCompletedEventCount: activityCompletedEvents.length,
		result,
		postHistorySummary: postEvents,
		verdict: pass ? 'PASS' : 'FAIL',
	};

	const file = writeEvidence('TEST-04', evidence);
	console.log(`TEST-04 verdict: ${evidence.verdict}`);
	console.log(`  workflowId=${workflowId}`);
	console.log(`  oldWorkerPid=${oldWorkerPid} killed at ${killedAt}`);
	console.log(`  newWorkerPid=${newWorkerPid} ready=${newWorkerReady}`);
	console.log(`  activityScheduledBeforeKill=${activityScheduledBeforeKill} (expected false)`);
	console.log(`  activityScheduledEventCount=${activityScheduledEvents.length} (expected 1, no duplication)`);
	console.log(`  final result.agent=${result && result.agent}`);
	console.log(`Evidence written to ${file}`);
	console.log(`NEW_WORKER_PID=${newWorkerPid}`);
	process.exit(pass ? 0 : 1);
}

main().catch((err) => {
	console.error('TEST-04 ERROR', err);
	process.exit(2);
});
