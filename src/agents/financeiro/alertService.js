// 7-day arrival/collection alert — task spec sections 5 and 6. Builds the
// alert email content and decides *whether* to send, but never sends
// anything itself (that's src/services/email.js) and never contacts the
// buyer directly — these are internal alerts only, per section 14's "não
// poderá enviar cobrança diretamente ao comprador".
const { PAYMENT_STATUS } = require('./paymentStatusService');

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(etaIso, todayDate) {
	return Math.ceil((new Date(etaIso).getTime() - todayDate.getTime()) / DAY_MS);
}

function computeAlertDueDate(etaIso, daysBefore) {
	return new Date(new Date(etaIso).getTime() - daysBefore * DAY_MS);
}

// True once "today" has reached the alert window before ETA — covers both
// the normal 7-day-ahead case and an ETA that arrives already inside that
// window (spec: "se a ETA for informada quando faltarem menos de sete dias,
// envie o alerta imediatamente").
function isWithinAlertWindow(etaIso, todayDate, daysBefore) {
	if (!etaIso) return false;
	return todayDate.getTime() >= computeAlertDueDate(etaIso, daysBefore).getTime();
}

function isEtaOverdue(etaIso, todayDate) {
	if (!etaIso) return false;
	return todayDate.getTime() > new Date(etaIso).getTime();
}

// Skip re-sending the same alert: an alert already sent for the *current*
// ETA (etaSentFor === current eta) doesn't need to fire again. A changed ETA
// after a previous alert legitimately needs a new one (see
// buildEtaChangeAlertEmail), so this only dedupes against the ETA the last
// alert was actually sent for.
function shouldSendAlert({ etaCurrent, today, daysBefore, alreadySent, alertSentForEta, balance, needsManualReview }) {
	if (alreadySent && alertSentForEta === etaCurrent) return false;
	if (balance != null && balance <= 0 && !needsManualReview) return false;
	if (isEtaOverdue(etaCurrent, today)) return true;
	return isWithinAlertWindow(etaCurrent, today, daysBefore);
}

const NEXT_ACTION_RULES = [
	{ when: (ctx) => ctx.needsManualReview, action: 'Revisar manualmente a operação' },
	{
		when: (ctx) => ctx.paymentStatus === PAYMENT_STATUS.PAGAMENTO_PARCIAL,
		action: 'Cobrar o saldo pendente',
	},
	{
		when: (ctx) => ctx.paymentStatus === PAYMENT_STATUS.SWIFT_RECEBIDO,
		action: 'Confirmar crédito com o financeiro',
	},
	{
		when: (ctx) => ctx.paymentStatus === PAYMENT_STATUS.PAGAMENTO_CONFIRMADO,
		action: 'Pagamento confirmado — apenas acompanhar chegada',
	},
	{
		when: (ctx) =>
			[PAYMENT_STATUS.SEM_INFORMACAO, PAYMENT_STATUS.PAGAMENTO_PREVISTO, PAYMENT_STATUS.AGUARDANDO_SWIFT].includes(
				ctx.paymentStatus
			),
		action: 'Solicitar SWIFT/comprovante ao comprador',
	},
];

function determineNextAction(context) {
	const rule = NEXT_ACTION_RULES.find((candidate) => candidate.when(context));
	return rule ? rule.action : 'Revisar manualmente a operação';
}

function buildArrivalAlertEmail(record) {
	const days = daysUntil(record.etaCurrent, record.today || new Date());
	const overdue = isEtaOverdue(record.etaCurrent, record.today || new Date());
	const subject = overdue
		? `ALERTA DE COBRANÇA VENCIDA – ${record.ftrCode} – ${record.buyer} – ETA ${record.etaCurrent}`
		: `ALERTA DE CHEGADA E COBRANÇA – ${record.ftrCode} – ${record.buyer} – ETA ${record.etaCurrent}`;

	const nextAction = determineNextAction(record);

	const lines = [
		`FTR: ${record.ftrCode}`,
		`Invoice: ${record.invoiceNumber || '-'}`,
		`Booking: ${record.bookingId || '-'}`,
		`BL: ${record.blNumber || '-'}`,
		`Vendedor: ${record.seller || '-'}`,
		`Comprador: ${record.buyer}`,
		`Valor total: ${record.totalInvoiceUsd ?? '-'}`,
		`Valor recebido: ${record.confirmedPaymentsUsd ?? 0}`,
		`Saldo pendente: ${record.balance ?? '-'}`,
		`Status do pagamento: ${record.paymentStatus}`,
		`Condição de pagamento: ${record.paymentTerms || '-'}`,
		`Navio: ${record.vessel || '-'}`,
		`Porto de destino: ${record.destinationPort || '-'}`,
		`ETA: ${record.etaCurrent}`,
		`Dias restantes até a ETA: ${days}`,
		`Link da planilha/registro: ${record.trackingLink || '-'}`,
		`Link do evento no Calendar: ${record.calendarEventLink || '-'}`,
		`Link do e-mail/thread de origem: ${record.sourceEmailLink || '-'}`,
		`Próxima ação recomendada: ${nextAction}`,
	];

	return { subject, body: lines.join('\n'), nextAction };
}

function buildEtaChangeAlertEmail(record) {
	const subject = `ALTERAÇÃO DE ETA – ${record.ftrCode} – ${record.buyer} – NOVA ETA ${record.etaCurrent}`;

	const lines = [
		`FTR: ${record.ftrCode}`,
		`Booking: ${record.bookingId || '-'}`,
		`BL: ${record.blNumber || '-'}`,
		`ETA anterior: ${record.etaPrevious || '-'}`,
		`Nova ETA: ${record.etaCurrent}`,
		`Impacto na cobrança: ${record.balance > 0 ? 'Saldo pendente permanece em aberto' : 'Sem impacto — pagamento já confirmado'}`,
		`Novo prazo do alerta: ${computeAlertDueDate(record.etaCurrent, record.daysBefore || 7).toISOString().slice(0, 10)}`,
		`Status atual do pagamento: ${record.paymentStatus}`,
	];

	return { subject, body: lines.join('\n') };
}

module.exports = {
	daysUntil,
	computeAlertDueDate,
	isWithinAlertWindow,
	isEtaOverdue,
	shouldSendAlert,
	determineNextAction,
	buildArrivalAlertEmail,
	buildEtaChangeAlertEmail,
};
