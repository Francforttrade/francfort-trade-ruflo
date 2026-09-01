// Payment status + balance calculation for the "CONTROLE DE RECEBIMENTOS"
// tracking record (task spec section 4). The 9-state enum from the spec
// isn't crisply defined there beyond "not just a SWIFT copy = confirmed
// credit", so the precedence below is this module's documented
// interpretation — auditable and adjustable in one place rather than
// scattered through callers.
const PAYMENT_STATUS = {
	SEM_INFORMACAO: 'SEM_INFORMACAO',
	PAGAMENTO_PREVISTO: 'PAGAMENTO_PREVISTO',
	AGUARDANDO_SWIFT: 'AGUARDANDO_SWIFT',
	SWIFT_RECEBIDO: 'SWIFT_RECEBIDO',
	PAGAMENTO_PARCIAL: 'PAGAMENTO_PARCIAL',
	PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
	SALDO_PENDENTE: 'SALDO_PENDENTE',
	VENCIDO: 'VENCIDO',
	REVISAO_MANUAL: 'REVISAO_MANUAL',
};

const DEFAULT_ALERT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Saldo pendente = valor total da invoice - soma dos pagamentos CONFIRMADOS
// (bank_credit_confirmed = true) — a SWIFT copy alone never reduces this,
// per the spec's "não considere apenas a existência de um comprovante como
// confirmação definitiva do crédito bancário".
function calculateBalance(totalInvoiceUsd, confirmedPaymentsUsd = 0) {
	return Math.round((totalInvoiceUsd - confirmedPaymentsUsd) * 100) / 100;
}

function isOverdue(dueDateIso, todayDate) {
	if (!dueDateIso) return false;
	return todayDate.getTime() > new Date(dueDateIso).getTime();
}

function isDueSoon(dueDateIso, todayDate, alertWindowDays) {
	if (!dueDateIso) return false;
	const daysUntilDue = (new Date(dueDateIso).getTime() - todayDate.getTime()) / DAY_MS;
	return daysUntilDue >= 0 && daysUntilDue <= alertWindowDays;
}

function computePaymentStatus({
	totalInvoiceUsd,
	confirmedPaymentsUsd = 0,
	swiftReceived = false,
	dueDate = null,
	today = new Date(),
	alertWindowDays = DEFAULT_ALERT_WINDOW_DAYS,
	needsManualReview = false,
}) {
	if (needsManualReview) {
		return { status: PAYMENT_STATUS.REVISAO_MANUAL, balance: null };
	}

	if (totalInvoiceUsd == null) {
		return { status: PAYMENT_STATUS.SEM_INFORMACAO, balance: null };
	}

	const balance = calculateBalance(totalInvoiceUsd, confirmedPaymentsUsd);
	const overdue = isOverdue(dueDate, today);

	if (balance <= 0) {
		return { status: PAYMENT_STATUS.PAGAMENTO_CONFIRMADO, balance };
	}

	if (overdue) {
		return { status: PAYMENT_STATUS.VENCIDO, balance };
	}

	if (confirmedPaymentsUsd > 0) {
		return { status: PAYMENT_STATUS.PAGAMENTO_PARCIAL, balance };
	}

	if (swiftReceived) {
		return { status: PAYMENT_STATUS.SWIFT_RECEBIDO, balance };
	}

	if (isDueSoon(dueDate, today, alertWindowDays)) {
		return { status: PAYMENT_STATUS.AGUARDANDO_SWIFT, balance };
	}

	if (dueDate) {
		return { status: PAYMENT_STATUS.PAGAMENTO_PREVISTO, balance };
	}

	return { status: PAYMENT_STATUS.SALDO_PENDENTE, balance };
}

module.exports = { PAYMENT_STATUS, DEFAULT_ALERT_WINDOW_DAYS, calculateBalance, computePaymentStatus };
