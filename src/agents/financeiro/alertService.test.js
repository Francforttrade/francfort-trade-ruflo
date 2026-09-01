const {
	daysUntil,
	computeAlertDueDate,
	isWithinAlertWindow,
	isEtaOverdue,
	shouldSendAlert,
	determineNextAction,
	buildArrivalAlertEmail,
	buildEtaChangeAlertEmail,
} = require('./alertService');
const { PAYMENT_STATUS } = require('./paymentStatusService');

const TODAY = new Date('2026-09-01T00:00:00Z');

describe('computeAlertDueDate / isWithinAlertWindow', () => {
	test('alert due date is N days before ETA', () => {
		expect(computeAlertDueDate('2026-09-20', 7).toISOString().slice(0, 10)).toBe('2026-09-13');
	});

	test('within window once today reaches the due date', () => {
		expect(isWithinAlertWindow('2026-09-08', TODAY, 7)).toBe(true);
		expect(isWithinAlertWindow('2026-09-20', TODAY, 7)).toBe(false);
	});
});

describe('isEtaOverdue', () => {
	test('true once ETA is in the past', () => {
		expect(isEtaOverdue('2026-08-01', TODAY)).toBe(true);
		expect(isEtaOverdue('2026-09-20', TODAY)).toBe(false);
	});
});

describe('shouldSendAlert', () => {
	test('sends when within the alert window and balance is outstanding', () => {
		expect(
			shouldSendAlert({ etaCurrent: '2026-09-05', today: TODAY, daysBefore: 7, alreadySent: false, balance: 1000 })
		).toBe(true);
	});

	test('does not send twice for the same ETA', () => {
		expect(
			shouldSendAlert({
				etaCurrent: '2026-09-05',
				today: TODAY,
				daysBefore: 7,
				alreadySent: true,
				alertSentForEta: '2026-09-05',
				balance: 1000,
			})
		).toBe(false);
	});

	test('sends again when the ETA changed since the last alert', () => {
		expect(
			shouldSendAlert({
				etaCurrent: '2026-09-06',
				today: TODAY,
				daysBefore: 7,
				alreadySent: true,
				alertSentForEta: '2026-09-05',
				balance: 1000,
			})
		).toBe(true);
	});

	test('does not send once the balance is settled', () => {
		expect(
			shouldSendAlert({ etaCurrent: '2026-09-05', today: TODAY, daysBefore: 7, alreadySent: false, balance: 0 })
		).toBe(false);
	});

	test('sends a critical alert once ETA has passed with a balance still open', () => {
		expect(
			shouldSendAlert({ etaCurrent: '2026-08-01', today: TODAY, daysBefore: 7, alreadySent: false, balance: 1000 })
		).toBe(true);
	});
});

describe('determineNextAction', () => {
	test('follows the spec rules in priority order', () => {
		expect(determineNextAction({ needsManualReview: true })).toBe('Revisar manualmente a operação');
		expect(determineNextAction({ paymentStatus: PAYMENT_STATUS.PAGAMENTO_PARCIAL })).toBe('Cobrar o saldo pendente');
		expect(determineNextAction({ paymentStatus: PAYMENT_STATUS.SWIFT_RECEBIDO })).toBe(
			'Confirmar crédito com o financeiro'
		);
		expect(determineNextAction({ paymentStatus: PAYMENT_STATUS.PAGAMENTO_CONFIRMADO })).toBe(
			'Pagamento confirmado — apenas acompanhar chegada'
		);
		expect(determineNextAction({ paymentStatus: PAYMENT_STATUS.SEM_INFORMACAO })).toBe(
			'Solicitar SWIFT/comprovante ao comprador'
		);
	});
});

describe('buildArrivalAlertEmail', () => {
	test('builds the standard arrival/collection alert', () => {
		const { subject, body } = buildArrivalAlertEmail({
			ftrCode: '03073-26',
			buyer: 'AGROTRADE RUS LLC',
			etaCurrent: '2026-09-08',
			today: TODAY,
			paymentStatus: PAYMENT_STATUS.PAGAMENTO_PARCIAL,
			balance: 250000,
			blNumber: 'MEDU1234567',
		});
		expect(subject).toBe('ALERTA DE CHEGADA E COBRANÇA – 03073-26 – AGROTRADE RUS LLC – ETA 2026-09-08');
		expect(body).toContain('FTR: 03073-26');
		expect(body).toContain('Próxima ação recomendada: Cobrar o saldo pendente');
	});

	test('flags the subject as overdue once ETA has passed', () => {
		const { subject } = buildArrivalAlertEmail({
			ftrCode: '03073-26',
			buyer: 'AGROTRADE RUS LLC',
			etaCurrent: '2026-08-01',
			today: TODAY,
			paymentStatus: PAYMENT_STATUS.SEM_INFORMACAO,
			balance: 250000,
		});
		expect(subject).toBe('ALERTA DE COBRANÇA VENCIDA – 03073-26 – AGROTRADE RUS LLC – ETA 2026-08-01');
	});
});

describe('buildEtaChangeAlertEmail', () => {
	test('builds the ETA-change alert with before/after dates', () => {
		const { subject, body } = buildEtaChangeAlertEmail({
			ftrCode: '03073-26',
			buyer: 'AGROTRADE RUS LLC',
			etaPrevious: '2026-09-08',
			etaCurrent: '2026-09-15',
			balance: 250000,
			paymentStatus: PAYMENT_STATUS.PAGAMENTO_PARCIAL,
			daysBefore: 7,
		});
		expect(subject).toBe('ALTERAÇÃO DE ETA – 03073-26 – AGROTRADE RUS LLC – NOVA ETA 2026-09-15');
		expect(body).toContain('ETA anterior: 2026-09-08');
		expect(body).toContain('Nova ETA: 2026-09-15');
	});
});
