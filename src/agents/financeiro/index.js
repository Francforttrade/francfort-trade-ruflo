const logger = require('../../utils/logger');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const { buildAuditEntry } = require('../contratos/auditTrail');
const { isValidSwiftReference } = require('./swiftValidation');
const { queryBankCreditConfirmation } = require('./bankQuery');
const { canReleaseOriginalDocuments } = require('./releaseGate');
const { isPaymentSuspiciouslyEarly } = require('./reconciliation');
const { computePaymentStatus } = require('./paymentStatusService');
const { detectSwiftMention } = require('./paymentSignals');

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

	// Payment-tracking status/balance (task spec section 4) only computes when
	// the caller supplies an invoice total — most existing FINANCEIRO callers
	// (release-gate checks) don't, and this stays null for them rather than
	// guessing a total.
	let paymentTracking = null;
	if (context.totalInvoiceUsd != null) {
		const swiftReceived =
			context.swiftReceived ?? (context.messageText ? detectSwiftMention(context.messageText) : Boolean(swiftReference));
		paymentTracking = computePaymentStatus({
			totalInvoiceUsd: context.totalInvoiceUsd,
			confirmedPaymentsUsd: context.confirmedPaymentsUsd || 0,
			swiftReceived,
			dueDate: context.paymentDueDate || null,
			today: context.today ? new Date(context.today) : new Date(),
			alertWindowDays: context.alertWindowDays,
			needsManualReview: context.needsManualReview || false,
		});
	}

	return {
		agent: 'financeiro',
		ftr_code: ftrCode,
		swift_valid: swiftReference ? true : null,
		bank_credit_confirmed: bankCreditConfirmed,
		release_flag: releaseFlag,
		audit_id: auditId,
		reconciliation,
		payment_tracking: paymentTracking,
	};
}

module.exports = { process };
