const { isSellerReviewOverdue, needsEscalation } = require('./negotiation');

describe('comercial negotiation deadlines', () => {
	test('seller review is overdue after 24h', () => {
		const now = new Date('2026-08-20T12:00:00Z');
		expect(isSellerReviewOverdue('2026-08-19T11:00:00Z', now)).toBe(true); // 25h ago
		expect(isSellerReviewOverdue('2026-08-19T13:00:00Z', now)).toBe(false); // 23h ago
	});

	test('escalation triggers after 48h without response', () => {
		const now = new Date('2026-08-20T12:00:00Z');
		expect(needsEscalation('2026-08-18T11:00:00Z', now)).toBe(true); // 49h ago
		expect(needsEscalation('2026-08-18T13:00:00Z', now)).toBe(false); // 47h ago
	});
});
