// ADR-001A PoC — TEST-09 (audit correlation) Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// IMPORTANT: this Workflow correlates engine execution evidence (its own
// workflowId/runId, read via workflowInfo() — a Workflow-safe, Temporal
// API) with a synthetic PoC-local business audit record. It does not
// claim Temporal Workflow History equals Francfort Trade business audit
// — see the header comment in
// poc/adr-001a/temporal/activities/auditRecordActivity.js for that
// distinction. No production AUDIT_LOG, Firestore, or Supabase access
// anywhere in this file.

const { proxyActivities, workflowInfo } = require('@temporalio/workflow');

const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const { writeAuditRecord } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

/**
 * Runs the existing Compliance Activity, then correlates the result with
 * a synthetic PoC-local audit record carrying this Workflow's own
 * identifiers.
 *
 * @param {object} context - forwarded unchanged to checkComplianceActivity
 */
async function auditCorrelationWorkflow(context) {
	const info = workflowInfo();
	const result = await checkComplianceActivity(context);
	await writeAuditRecord({
		workflowId: info.workflowId,
		runId: info.runId,
		correlationId: context && context.ftrCode,
		event: 'compliance_check_completed',
		outcome: result,
	});
	return result;
}

module.exports = { auditCorrelationWorkflow };
