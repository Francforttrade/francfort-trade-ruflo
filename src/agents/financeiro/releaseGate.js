// ROADMAP GATE CRÍTICO: "Não liberar docs até SWIFT confirmado + crédito ✅".
function canReleaseOriginalDocuments({ invoiceStatus, paymentStatus, bankCreditConfirmed }) {
	return invoiceStatus === 'Issued' && paymentStatus === 'Received' && bankCreditConfirmed === true;
}

module.exports = { canReleaseOriginalDocuments };
