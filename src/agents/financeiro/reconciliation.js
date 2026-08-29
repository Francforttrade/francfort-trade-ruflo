// ROADMAP: "Flag: pagamento >7 dias antes chegada → alerta desnecessário (bounce?)".
const EARLY_PAYMENT_ALERT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function isPaymentSuspiciouslyEarly(paymentDateIso, etaDateIso) {
	const daysBeforeArrival = (new Date(etaDateIso).getTime() - new Date(paymentDateIso).getTime()) / DAY_MS;
	return daysBeforeArrival > EARLY_PAYMENT_ALERT_DAYS;
}

module.exports = { EARLY_PAYMENT_ALERT_DAYS, isPaymentSuspiciouslyEarly };
