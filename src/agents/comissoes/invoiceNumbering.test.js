const { buildCommissionId } = require('./invoiceNumbering');

describe('comissoes invoiceNumbering', () => {
	test('matches the commissions.commission_id pattern from the DB schema', () => {
		expect(buildCommissionId(1, 2026)).toBe('COM-000001-26');
		expect(buildCommissionId(42, 2026)).toBe('COM-000042-26');
	});
});
