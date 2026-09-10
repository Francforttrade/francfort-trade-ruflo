// ADR-001A PoC — TEST-10 "version B" Worker DEFINITION (structural only).
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application; not imported by src/ or server.js; not built or deployed.
//
// Identical to worker/complianceWorker.js except workflowsPath points at
// workflows/indexV2.js (the patched waitResumeWorkflow variant) instead
// of workflows/index.js — representing a redeployed Worker running new
// code, on the SAME task queue as the "version A" Worker. Same
// activities map (activities are not versioned in this scenario, only
// the Workflow bundle differs).
//
// CRITICAL: this file must NOT start a Worker as a side effect of being
// imported — same discipline as complianceWorker.js. No top-level
// Worker.create(), worker.run(), NativeConnection.connect(), or
// process.exit() anywhere in this file. Calling createPocWorkerV2() is
// left to a future, separately authorized step.

const { Worker } = require('@temporalio/worker');
const { checkComplianceActivity } = require('../activities/complianceActivity');
const { recordBuyerDecision } = require('../activities/buyerDecisionActivity');
const { evaluateFinancialGate } = require('../activities/financialGateActivity');
const { writeAuditRecord } = require('../activities/auditRecordActivity');
const { injectableFailureActivity } = require('../activities/failureInjectionActivity');

// Same PoC-only task queue as complianceWorker.js — this is the whole
// point of TEST-10: two Worker deployments, same task queue.
const TASK_QUEUE = 'adr001a-temporal-poc';

const workerOptions = {
	taskQueue: TASK_QUEUE,
	workflowsPath: require.resolve('../workflows/indexV2.js'),
	activities: {
		checkComplianceActivity,
		recordBuyerDecision,
		evaluateFinancialGate,
		writeAuditRecord,
		injectableFailureActivity,
	},
};

/**
 * Factory for a real Temporal Worker instance running "version B" code.
 * NOT CALLED by this module — same reasoning as
 * complianceWorker.js#createPocWorker.
 *
 * @returns {Promise<import('@temporalio/worker').Worker>}
 */
async function createPocWorkerV2() {
	return Worker.create(workerOptions);
}

module.exports = { TASK_QUEUE, workerOptions, createPocWorkerV2 };
