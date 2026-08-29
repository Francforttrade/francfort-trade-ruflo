// Matches supabase/migrations/0001_init_schema.sql commissions.commission_id
// pattern: "COM-000001-26".
function buildCommissionId(sequence, year = new Date().getFullYear()) {
	const yearSuffix = String(year).slice(-2);
	return `COM-${String(sequence).padStart(6, '0')}-${yearSuffix}`;
}

module.exports = { buildCommissionId };
