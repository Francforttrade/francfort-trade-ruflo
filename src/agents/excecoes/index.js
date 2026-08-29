const logger = require('../../utils/logger');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const { getBackoffDelayMs, shouldRetry } = require('./backoff');
const { buildDlqEntry } = require('./dlqEntry');
const { buildEscalationMessage } = require('./escalation');
const { buildOverrideAuditEntry } = require('./override');

// EXCECOES: Retry logic, DLQ management, manual escalation, override audit. SLA: Immediate.
async function process(context) {
	if (context.action === 'override') {
		const auditEntry = buildOverrideAuditEntry({ ftrCode: context.ftrCode, approvedBy: context.approvedBy });
		await firestore.collection(COLLECTIONS.AUDIT_LOG).doc(`override-${context.ftrCode}-${Date.now()}`).set(auditEntry);
		logger.info('Override manual registrado', auditEntry);
		return { agent: 'excecoes', ftr_code: context.ftrCode, override: auditEntry };
	}

	if (context.action === 'record_failure') {
		const retryCount = context.retryCount || 0;

		if (shouldRetry(retryCount)) {
			const delayMs = getBackoffDelayMs(retryCount);
			logger.warn('Falha registrada, retry agendado', {
				ftrCode: context.ftrCode,
				agent: context.agent,
				retryCount,
				delayMs,
			});
			return { agent: 'excecoes', ftr_code: context.ftrCode, retry: true, retry_count: retryCount, delay_ms: delayMs };
		}

		const dlqEntry = buildDlqEntry({
			ftrCode: context.ftrCode,
			agent: context.agent,
			errorMsg: context.errorMsg,
			retryCount,
		});
		await firestore
			.collection(COLLECTIONS.FALHAS_PROCESSAMENTO)
			.doc(`dlq-${context.ftrCode}-${Date.now()}`)
			.set(dlqEntry);

		const escalationMessage = buildEscalationMessage({
			ftrCode: context.ftrCode,
			agent: context.agent,
			reason: context.errorMsg,
		});
		logger.error('Máximo de retries atingido — escalação manual', { ...dlqEntry, escalationMessage });

		return {
			agent: 'excecoes',
			ftr_code: context.ftrCode,
			retry: false,
			retry_count: retryCount,
			dlq_entry: dlqEntry,
			escalation_message: escalationMessage,
		};
	}

	// Fallback: routing failures reported by the orchestrator (invalid FTR /
	// unknown target agent) — no retry/DLQ semantics apply here, just log it.
	logger.warn('Exceção de roteamento recebida', context);
	return { agent: 'excecoes', reason: context.reason || null, message: context.message || null };
}

module.exports = { process };
