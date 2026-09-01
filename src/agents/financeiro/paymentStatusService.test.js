const { PAYMENT_STATUS, calculateBalance, computePaymentStatus } = require('./paymentStatusService');

const TODAY = new Date('2026-09-01T00:00:00Z');

describe('calculateBalance', () => {
	test('total minus confirmed payments', () => {
		expect(calculateBalance(750000, 250000)).toBe(500000);
	});

	test('defaults confirmed payments to zero', () => {
		expect(calculateBalance(750000)).toBe(750000);
	});
});

describe('computePaymentStatus', () => {
	test('REVISAO_MANUAL takes precedence over everything else', () => {
		expect(computePaymentStatus({ totalInvoiceUsd: 1000, needsManualReview: true }).status).toBe(
			PAYMENT_STATUS.REVISAO_MANUAL
		);
	});

	test('SEM_INFORMACAO when the invoice total is unknown', () => {
		expect(computePaymentStatus({ totalInvoiceUsd: null, today: TODAY }).status).toBe(PAYMENT_STATUS.SEM_INFORMACAO);
	});

	test('PAGAMENTO_CONFIRMADO when confirmed payments cover the full invoice', () => {
		const result = computePaymentStatus({ totalInvoiceUsd: 750000, confirmedPaymentsUsd: 750000, today: TODAY });
		expect(result.status).toBe(PAYMENT_STATUS.PAGAMENTO_CONFIRMADO);
		expect(result.balance).toBe(0);
	});

	test('VENCIDO when overdue and balance remains, even with a partial payment in', () => {
		const result = computePaymentStatus({
			totalInvoiceUsd: 750000,
			confirmedPaymentsUsd: 100000,
			dueDate: '2026-08-01',
			today: TODAY,
		});
		expect(result.status).toBe(PAYMENT_STATUS.VENCIDO);
		expect(result.balance).toBe(650000);
	});

	test('PAGAMENTO_PARCIAL when some confirmed money is in but not overdue', () => {
		const result = computePaymentStatus({
			totalInvoiceUsd: 750000,
			confirmedPaymentsUsd: 100000,
			dueDate: '2026-12-01',
			today: TODAY,
		});
		expect(result.status).toBe(PAYMENT_STATUS.PAGAMENTO_PARCIAL);
	});

	test('SWIFT_RECEBIDO when a SWIFT/receipt was seen but nothing is confirmed yet', () => {
		const result = computePaymentStatus({
			totalInvoiceUsd: 750000,
			confirmedPaymentsUsd: 0,
			swiftReceived: true,
			dueDate: '2026-12-01',
			today: TODAY,
		});
		expect(result.status).toBe(PAYMENT_STATUS.SWIFT_RECEBIDO);
	});

	test('AGUARDANDO_SWIFT when due date is within the alert window and nothing received', () => {
		const result = computePaymentStatus({
			totalInvoiceUsd: 750000,
			dueDate: '2026-09-05',
			today: TODAY,
			alertWindowDays: 7,
		});
		expect(result.status).toBe(PAYMENT_STATUS.AGUARDANDO_SWIFT);
	});

	test('PAGAMENTO_PREVISTO when due date is further out', () => {
		const result = computePaymentStatus({ totalInvoiceUsd: 750000, dueDate: '2026-12-01', today: TODAY });
		expect(result.status).toBe(PAYMENT_STATUS.PAGAMENTO_PREVISTO);
	});

	test('SALDO_PENDENTE when there is a balance but no due date or signal at all', () => {
		const result = computePaymentStatus({ totalInvoiceUsd: 750000, today: TODAY });
		expect(result.status).toBe(PAYMENT_STATUS.SALDO_PENDENTE);
	});
});
