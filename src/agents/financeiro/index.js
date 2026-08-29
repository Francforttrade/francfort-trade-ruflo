const logger = require('../../utils/logger');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const { buildAuditEntry } = require('../contratos/auditTrail');
const { isValidSwiftReference } = require('./swiftValidation');
const { queryBankCreditConfirmation } = require('./bankQuery');
const { canReleaseOriginalDocuments } = require('./releaseGate');
const { isPaymentSuspiciouslyEarly } = require('./reconciliation');

// FINANCEIRO: Validate SWIFT ref, confirm bank credit, authorize document release. SLA: 7 days pre-arrival.
async function process(context) {
	const { ftrCode, swiftReference, invoiceStatus, paymentStatus, etaDate, paymentDate, userEmail } = context;

	if (swiftReference && !isValidSwiftReference(swiftReference)) {
		logger.warn('SWIFT reference com formato inválido', { ftrCode, swiftReference });
		return { agent: 'financeiro', ftr_code: ftrCode, swift_valid: false, bank_credit_confirmed: null, release_flag: false, audit_id: null };
	}

	let bankCreditConfirmed = context.bankCreditConfirmed ?? null;
	if (swiftReference && bankCreditConfirmed == null) {
		const bankResult = await queryBankCreditConfirmation(swiftReference);
		bankCreditConfirmed = bankResult.confirmed;
	}

	const releaseFlag = canReleaseOriginalDocuments({ invoiceStatus, paymentStatus, bankCreditConfirmed });

	let auditId = null;
	if (releaseFlag) {
		const auditEntry = buildAuditEntry({
			operation: 'release_documents',
			resourceId: ftrCode,
			userEmail,
			beforeState: { original_documents_released: false },
			afterState: { original_documents_released: true, release_date: new Date().toISOString() },
		});

		await firestore.collection(COLLECTIONS.AUDIT_LOG).doc(auditEntry.audit_id).set(auditEntry);
		auditId = auditEntry.audit_id;

		logger.info('GATE CRÍTICO: documentos originais liberados', { ftrCode, auditId });
	}

	const reconciliation =
		paymentDate && etaDate ? { suspiciously_early: isPaymentSuspiciouslyEarly(paymentDate, etaDate) } : null;

	return {
		agent: 'financeiro',
		ftr_code: ftrCode,
		swift_valid: swiftReference ? true : null,
		bank_credit_confirmed: bankCreditConfirmed,
		release_flag: releaseFlag,
		audit_id: auditId,
		reconciliation,
	};
}

module.exports = { process };
