// ADR-001A PoC — TEST-09 audit-record test double.
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application. Does NOT invoke the production AUDIT_LOG, Firestore,
// Supabase, any external logging provider, or any production analytics/
// business-audit subsystem.
//
// IMPORTANT DISTINCTION (do not blur this):
//   ENGINE EXECUTION EVIDENCE — workflow ID, run ID, event history,
//   Activity attempts, timestamps, engine state transitions — comes
//   natively from the durable-workflow engine itself (e.g. Temporal's
//   own Client/history API). This module does not produce that.
//
//   BUSINESS AUDIT EVIDENCE — an FTR/business correlation identifier, a
//   business event/action, a decision/result, and (optionally) an actor
//   — is what THIS module produces, synthetically, for PoC correlation
//   purposes only. It is not, and does not claim to be, the Francfort
//   Trade production AUDIT_LOG, and Temporal Workflow History is not
//   claimed to equal Francfort Trade business audit anywhere in this
//   PoC.
//
// Storage is in-memory only (a plain array scoped to this module/
// process) — no file, database, or network write occurs.

const records = [];

/**
 * Appends one synthetic business audit record, correlated to the
 * durable-engine identifiers the caller supplies.
 *
 * @param {{workflowId?: string, runId?: string, correlationId?: string, event?: string, outcome?: unknown}} input
 * @returns {{workflowId: string|null, runId: string|null, correlationId: string|null, event: string|null, outcome: unknown, recordedAt: string}}
 */
function writeAuditRecord(input) {
	const data = input || {};
	const record = {
		workflowId: data.workflowId || null,
		runId: data.runId || null,
		correlationId: data.correlationId || null,
		event: data.event || null,
		outcome: data.outcome === undefined ? null : data.outcome,
		recordedAt: new Date().toISOString(),
	};
	records.push(record);
	return record;
}

/**
 * Returns a copy of every synthetic audit record written so far in this
 * process. A copy, not the live array, so callers cannot mutate history.
 *
 * @returns {Array<object>}
 */
function getAuditLog() {
	return records.slice();
}

module.exports = { writeAuditRecord, getAuditLog };
