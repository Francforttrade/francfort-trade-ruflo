// ADR-001A PoC — TEST-04 (Worker/process failure recovery) control
// harness. Structural definition only — nothing in this file is called
// at module load, and this file is not executed by this step.
//
// SCOPE: WORKER / PROCESS failure recovery, explicitly NOT Temporal
// Server failure. This harness never stops or restarts the Temporal
// Server; TEMPORAL_PERSISTENCE remains IN_MEMORY_EPHEMERAL and
// SERVER_CRASH_DURABLE_RECOVERY_PROVEN remains NO regardless of anything
// in this file.
//
// This orchestrates two things that already exist and were already
// individually authorized/verified in earlier steps:
//   - a real OS child process running the Worker (harness/runPocWorkerProcess.js)
//   - the paused-Workflow primitive (workflows/waitResumeWorkflow.js)
// It adds no new production-domain coupling, no new external resource
// access, and no financial/business semantics of its own.

const { spawn } = require('child_process');
const path = require('path');

const WORKER_ENTRY_SCRIPT = path.join(__dirname, 'runPocWorkerProcess.js');

/**
 * Spawns a new OS-level child process running the PoC Worker. NOT called
 * by this module — a future, separately authorized step would call this.
 *
 * @returns {import('child_process').ChildProcess}
 */
function spawnWorkerProcess() {
	return spawn(process.execPath, [WORKER_ENTRY_SCRIPT], { stdio: 'inherit' });
}

/**
 * Terminates a previously spawned Worker child process. NOT called by
 * this module.
 *
 * @param {import('child_process').ChildProcess} childProcess
 */
function killWorkerProcess(childProcess) {
	childProcess.kill('SIGKILL');
}

/**
 * Documents (without executing) the full TEST-04 sequence a future,
 * separately authorized behavioral step would run:
 *
 *   1. const proc1 = spawnWorkerProcess();
 *   2. Using a Temporal Client, start `waitResumeWorkflow` with a known
 *      workflowId against the already-running Temporal Server.
 *   3. Confirm (via Client query/describe) the Workflow is paused,
 *      awaiting `resumeSignal` — no Activity has executed yet.
 *   4. killWorkerProcess(proc1) — the Worker process dies; the Temporal
 *      Server (a separate, already-running process, untouched here)
 *      keeps the Workflow's durable history.
 *   5. const proc2 = spawnWorkerProcess() — a fresh Worker process,
 *      same task queue, connects to the same still-running Server.
 *   6. Send `resumeSignal` to the same workflowId via Client.
 *   7. Confirm the Workflow completes correctly under proc2 — its
 *      pre-kill progress (the paused/waiting state) was not lost, and no
 *      business-state field was advanced merely because proc1 died
 *      (nothing writes state until the Activity actually runs, which
 *      only happens after the signal is received by proc2).
 *
 * This function is defined but NOT called anywhere in this file or by
 * anything that imports it.
 *
 * @param {{workflowId: string}} _params
 */
async function runFailureRecoveryHarness(_params) {
	throw new Error(
		'runFailureRecoveryHarness is a documented, uncalled placeholder for a future, separately authorized behavioral step — it is intentionally not implemented in this structural-preparation step.'
	);
}

module.exports = { spawnWorkerProcess, killWorkerProcess, runFailureRecoveryHarness, WORKER_ENTRY_SCRIPT };
