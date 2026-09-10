// ADR-001A PoC — TEST-10 "version B" Workflow index. Identical to
// index.js except waitResumeWorkflow.js is swapped for its patched V2
// variant — representing a redeployed Worker running new code, still on
// the same task queue as V1. Used only by worker/complianceWorkerV2.js.

module.exports = {
	...require('./complianceWorkflow'),
	...require('./waitResumeWorkflowV2'),
	...require('./buyerDecisionWorkflow'),
	...require('./financialGateWorkflow'),
	...require('./auditCorrelationWorkflow'),
	...require('./retryWorkflow'),
	...require('./versionEvolutionWorkflowV2'),
};
