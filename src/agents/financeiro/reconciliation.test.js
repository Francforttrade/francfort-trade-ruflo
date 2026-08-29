const { isPaymentSuspiciouslyEarly } = require('./reconciliation');

describe('financeiro reconciliation', () => {
	test('flags a payment more than 7 days before arrival', () => {
		expect(isPaymentSuspiciouslyEarly('2026-08-10', '2026-08-20')).toBe(true); // 10 days
	});

	test('does not flag a payment within the 7-day window', () => {
		expect(isPaymentSuspiciouslyEarly('2026-08-15', '2026-08-20')).toBe(false); // 5 days
		expect(isPaymentSuspiciouslyEarly('2026-08-13', '2026-08-20')).toBe(false); // exactly 7 days
	});
});
