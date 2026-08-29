const { buildApprovalRecord } = require('./buyerApproval');

describe('qualidade buyerApproval', () => {
	test('builds an approval record with a timestamp', () => {
		const record = buildApprovalRecord({ approved: true, approvedBy: 'ahmed@tassali.dz', approvedAt: '2026-08-18T10:00:00Z' });
		expect(record).toEqual({ approved: true, approved_by: 'ahmed@tassali.dz', approved_at: '2026-08-18T10:00:00Z' });
	});

	test('defaults approved to false and fills a timestamp when none is given', () => {
		const record = buildApprovalRecord({ approved: false });
		expect(record.approved).toBe(false);
		expect(record.approved_by).toBeNull();
		expect(typeof record.approved_at).toBe('string');
	});
});
