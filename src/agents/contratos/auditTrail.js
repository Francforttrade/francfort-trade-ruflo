// Matches the audit_log shape documented in docs/FIRESTORE_SUPABASE.md.
function buildAuditEntry({ operation, resourceId, userEmail, beforeState, afterState, status = 'Success' }) {
	return {
		audit_id: `AUD-${Date.now()}`,
		timestamp: new Date().toISOString(),
		user_email: userEmail || null,
		operation,
		resource_type: 'FTR',
		resource_id: resourceId,
		before_state: beforeState || null,
		after_state: afterState || null,
		status,
	};
}

module.exports = { buildAuditEntry };
