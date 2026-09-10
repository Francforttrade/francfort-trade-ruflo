// ADR-001A PoC — minimal Temporal Worker DEFINITION (structural only).
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application; not imported by src/ or server.js; not built or deployed.
//
// Despite the filename (kept for continuity with its original,
// Compliance-only authorization — not renamed to avoid an unauthorized-
// feeling churn), this file now registers the shared PoC Worker
// definition for ALL frozen ADR-001A tests: the original Compliance
// adapter (TEST-01/02/07/etc.), the wait/resume primitive (TEST-03/04),
// the buyer-decision double (TEST-06), the financial-gate double
// (TEST-08), and the audit-correlation workflow (TEST-09).
//
// CRITICAL: this file must NOT start a Worker as a side effect of being
// imported. It exports configuration data (a plain object) and an
// UNCALLED factory function. There is no top-level Worker.create(),
// worker.run(), NativeConnection.connect(), or process.exit() anywhere in
// this file. Calling createPocWorker() is left to a future, separately
// authorized step — it is not invoked here.

const { Worker } = require('@temporalio/worker');
const { checkComplianceActivity } = require('../activities/complianceActivity');
const { recordBuyerDecision } = require('../activities/buyerDecisionActivity');
const { evaluateFinancialGate } = require('../activities/financialGateActivity');
const { writeAuditRecord } = require('../activities/auditRecordActivity');
const { injectableFailureActivity } = require('../activities/failureInjectionActivity');
const { evaluateFinancialGateWithInjectedRetries } = require('../activities/financialGateRetryActivity');

// PoC-only task queue name. This identifier is PoC configuration, not a
// production architecture decision — it exists only to keep this PoC's
// Workflow/Activity traffic isolated from any other Temporal task queue.
const TASK_QUEUE = 'adr001a-temporal-poc';

// Structural wiring, expressed as plain data — proves which Workflow
// index file and which Activity functions this Worker WOULD register,
// without calling any Temporal Worker API.
const workerOptions = {
	taskQueue: TASK_QUEUE,
	workflowsPath: require.resolve('../workflows/index.js'),
	activities: {
		checkComplianceActivity,
		recordBuyerDecision,
		evaluateFinancialGate,
		writeAuditRecord,
		injectableFailureActivity,
		evaluateFinancialGateWithInjectedRetries,
	},
};

/**
 * Factory for a real Temporal Worker instance, matching Temporal's own
 * Worker.create(options) API shape. Renamed from createComplianceWorker
 * to createPocWorker to reflect its now-shared scope across all 10
 * frozen tests — same function, same not-yet-called status.
 *
 * NOT CALLED by this module. Calling it is an actual runtime-construction
 * operation (Worker.create() is async and, per Temporal's SDK design, will
 * establish a NativeConnection — a default connection to localhost:7233 if
 * none is supplied — as part of constructing the Worker). That crosses
 * from "definition" into "runtime execution," which is outside this step's
 * authorization. This function exists only to show the exact call that a
 * future, separately authorized step would make; invoking it is deferred.
 *
 * @returns {Promise<import('@temporalio/worker').Worker>}
 */
async function createPocWorker() {
	return Worker.create(workerOptions);
}

module.exports = { TASK_QUEUE, workerOptions, createPocWorker };
