function buildApprovalRecord({ approved, approvedBy, approvedAt = new Date().toISOString() }) {
	return { approved: Boolean(approved), approved_by: approvedBy || null, approved_at: approvedAt };
}

module.exports = { buildApprovalRecord };
