// ROADMAP: seller deve revisar a oferta em 24h; sem resposta em >2 dias (48h)
// dispara escalação.
const SELLER_REVIEW_DEADLINE_HOURS = 24;
const ESCALATION_DEADLINE_HOURS = 48;

function hoursSince(fromIso, now) {
	return (now.getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60);
}

function isSellerReviewOverdue(quoteSentAt, now = new Date()) {
	return hoursSince(quoteSentAt, now) > SELLER_REVIEW_DEADLINE_HOURS;
}

function needsEscalation(lastResponseAt, now = new Date()) {
	return hoursSince(lastResponseAt, now) > ESCALATION_DEADLINE_HOURS;
}

module.exports = {
	SELLER_REVIEW_DEADLINE_HOURS,
	ESCALATION_DEADLINE_HOURS,
	isSellerReviewOverdue,
	needsEscalation,
};
