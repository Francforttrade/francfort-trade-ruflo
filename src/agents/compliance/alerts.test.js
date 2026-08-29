const { needsExpiryAlert, daysUntilExpiry } = require('./alerts');

describe('compliance alerts', () => {
	test('needs an alert within the 7-day window', () => {
		const now = new Date('2026-08-20T00:00:00Z');
		expect(needsExpiryAlert('2026-08-25T00:00:00Z', now)).toBe(true); // 5 days
		expect(needsExpiryAlert('2026-08-27T00:00:00Z', now)).toBe(true); // exactly 7 days
	});

	test('does not alert outside the window or after expiry', () => {
		const now = new Date('2026-08-20T00:00:00Z');
		expect(needsExpiryAlert('2026-09-01T00:00:00Z', now)).toBe(false); // 12 days away
		expect(needsExpiryAlert('2026-08-19T00:00:00Z', now)).toBe(false); // already expired
	});

	test('counts down days until expiry', () => {
		expect(daysUntilExpiry('2026-08-25T00:00:00Z', new Date('2026-08-20T00:00:00Z'))).toBe(5);
	});
});
