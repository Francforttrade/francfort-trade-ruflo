const { hasDemurrageRisk, demurrageDeadline } = require('./demurrage');

describe('logistics demurrage', () => {
	test('is at risk once the reference date passes ETA + free time', () => {
		expect(hasDemurrageRisk('2026-08-01T00:00:00Z', new Date('2026-08-20T00:00:00Z'), 14)).toBe(true); // 19 days after ETA
	});

	test('is not at risk within the free-time window', () => {
		expect(hasDemurrageRisk('2026-08-01T00:00:00Z', new Date('2026-08-10T00:00:00Z'), 14)).toBe(false); // 9 days after ETA
	});

	test('computes the deadline as ETA + free time', () => {
		expect(demurrageDeadline('2026-08-01T00:00:00Z', 14).toISOString()).toBe('2026-08-15T00:00:00.000Z');
	});
});
