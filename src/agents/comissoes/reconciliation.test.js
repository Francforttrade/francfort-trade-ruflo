const { isPaymentReconciled } = require('./reconciliation');

describe('comissoes reconciliation', () => {
	test('reconciles when the paid amount matches the calculated commission', () => {
		expect(isPaymentReconciled(15000, 15000)).toBe(true);
	});

	test('does not reconcile when amounts differ beyond tolerance', () => {
		expect(isPaymentReconciled(14000, 15000)).toBe(false);
	});

	test('is not reconciled when no payment has been made yet', () => {
		expect(isPaymentReconciled(null, 15000)).toBe(false);
	});
});
