// ADR-001A PoC — Workflow index. Re-exports every PoC Workflow so a
// single Worker's workflowsPath can register all of them at once. This
// is the standard Temporal pattern (an index file aggregating workflow
// exports) — it adds no logic of its own.

module.exports = {
	...require('./complianceWorkflow'),
	...require('./waitResumeWorkflow'),
	...require('./buyerDecisionWorkflow'),
	...require('./financialGateWorkflow'),
	...require('./auditCorrelationWorkflow'),
	...require('./retryWorkflow'),
	...require('./test02BranchingWorkflow'),
	...require('./financialGateRetryWorkflow'),
	...require('./financialGateSignalWorkflow'),
	...require('./versionEvolutionWorkflow'),
};
