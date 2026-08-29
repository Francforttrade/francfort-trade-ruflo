const { canReleaseOriginalDocuments } = require('./releaseGate');

describe('financeiro releaseGate (GATE CRÍTICO)', () => {
	test('releases only when all three pre-conditions hold', () => {
		expect(
			canReleaseOriginalDocuments({ invoiceStatus: 'Issued', paymentStatus: 'Received', bankCreditConfirmed: true })
		).toBe(true);
	});

	test('blocks release when any single pre-condition is missing', () => {
		expect(
			canReleaseOriginalDocuments({ invoiceStatus: 'Draft', paymentStatus: 'Received', bankCreditConfirmed: true })
		).toBe(false);
		expect(
			canReleaseOriginalDocuments({ invoiceStatus: 'Issued', paymentStatus: 'Pending', bankCreditConfirmed: true })
		).toBe(false);
		expect(
			canReleaseOriginalDocuments({ invoiceStatus: 'Issued', paymentStatus: 'Received', bankCreditConfirmed: false })
		).toBe(false);
		expect(
			canReleaseOriginalDocuments({ invoiceStatus: 'Issued', paymentStatus: 'Received', bankCreditConfirmed: null })
		).toBe(false);
	});
});
