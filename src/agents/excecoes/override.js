// ROADMAP example: "Rodrigo override @ 2026-09-01 14:30".
function buildOverrideAuditEntry({ ftrCode, approvedBy, approvedAt = new Date() }) {
	const approvedAtIso = new Date(approvedAt).toISOString();
	return {
		ftr_code: ftrCode,
		approved_by: approvedBy,
		approved_at: approvedAtIso,
		note: `${approvedBy} override @ ${approvedAtIso}`,
	};
}

module.exports = { buildOverrideAuditEntry };
