// ROADMAP: "Commission invoice, reconciliation report".
const DEFAULT_TOLERANCE_USD = 0.01;

function isPaymentReconciled(paidAmountUsd, commissionAmountUsd, toleranceUsd = DEFAULT_TOLERANCE_USD) {
	if (paidAmountUsd == null) {
		return false;
	}
	return Math.abs(paidAmountUsd - commissionAmountUsd) <= toleranceUsd;
}

module.exports = { DEFAULT_TOLERANCE_USD, isPaymentReconciled };
