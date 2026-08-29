const logger = require('../../utils/logger');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const { isWithinCreditLimit } = require('../comercial/pricing');
const { parseContract } = require('./parser');
const { nextFtrVersion } = require('./versioning');
const { isSignatureComplete } = require('./signature');
const { buildAuditEntry } = require('./auditTrail');

// CONTRATOS: Contract T&C parse, signature workflow, amendment tracking. SLA: 4 days.
async function process(context) {
	const parsed = parseContract(context.body || '');

	const totalValueUsd =
		parsed.quantity_mt != null && parsed.unit_price_usd != null ? parsed.quantity_mt * parsed.unit_price_usd : null;

	const creditCheck = {
		within_limit:
			totalValueUsd == null ? null : isWithinCreditLimit(totalValueUsd, context.buyer && context.buyer.credit_limit_usd),
	};

	const signatureCheck = { complete: isSignatureComplete(context) };

	let newFtrCode = null;
	let auditId = null;

	if (parsed.is_amendment) {
		newFtrCode = nextFtrVersion(context.ftrCode);
		const auditEntry = buildAuditEntry({
			operation: 'amend_ftr',
			resourceId: context.ftrCode,
			userEmail: context.userEmail,
			beforeState: { quantity_mt: context.previousQuantityMt ?? null },
			afterState: { quantity_mt: parsed.amended_quantity_mt, new_ftr_code: newFtrCode },
		});

		await firestore.collection(COLLECTIONS.AUDIT_LOG).doc(auditEntry.audit_id).set(auditEntry);
		auditId = auditEntry.audit_id;

		logger.info('Amendment detectado, nova versão de FTR criada', { ftrCode: context.ftrCode, newFtrCode });
	}

	return {
		agent: 'contratos',
		parsed,
		total_value_usd: totalValueUsd,
		credit_check: creditCheck,
		signature_check: signatureCheck,
		new_ftr_code: newFtrCode,
		audit_id: auditId,
	};
}

module.exports = { process };
