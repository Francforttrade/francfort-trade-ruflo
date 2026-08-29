const logger = require('../../utils/logger');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const { parseMessage } = require('./parser');
const { getResponseTemplate } = require('./templates');

// COMUNICACAO: Parse email/WhatsApp, extract FTR/Booking/Invoice, route to MASTER. SLA: <5min.
async function process(context) {
	const text = [context.subject, context.body].filter(Boolean).join('\n');
	const parsed = parseMessage(text);

	const sessionId = context.threadId || `sess-${Date.now()}`;
	const session = {
		session_id: sessionId,
		channel: context.channel || 'unknown',
		from: context.from || null,
		subject: context.subject || null,
		body: context.body || null,
		...parsed,
		received_at: new Date().toISOString(),
	};

	await firestore.collection(COLLECTIONS.SESSIONS).doc(sessionId).set(session);

	logger.info('Mensagem processada pelo COMUNICACAO', {
		sessionId,
		intent: parsed.intent,
		ftrCode: parsed.ftr_code,
	});

	return {
		agent: 'comunicacao',
		session_id: sessionId,
		response_template: getResponseTemplate(parsed.intent),
		...parsed,
	};
}

module.exports = { process };
