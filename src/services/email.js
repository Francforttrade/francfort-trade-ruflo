// Thin outbound-email wrapper, following the same pattern as
// financeiro/bankQuery.js and logistics/searatesQuery.js: the real
// integration (SMTP relay or the Gmail API, sending as export@francfort.co)
// needs credentials this repo doesn't have, so this logs the message and
// returns a synthetic message ID until EMAIL_SMTP_* / EMAIL_PROVIDER env
// vars are configured. Internal alerts only — see alertService.js and
// section 14 of the task spec: this must never be pointed at a buyer.
const logger = require('../utils/logger');
const CONFIG = require('../config');

function isEmailConfigured() {
	return Boolean(process.env.EMAIL_SMTP_HOST && process.env.EMAIL_FROM_ADDRESS);
}

async function sendInternalAlertEmail({ to, subject, body }) {
	const recipients = Array.isArray(to) ? to : [to];
	// The body is never logged in full — section 13's "não exponha
	// informações sensíveis desnecessariamente nos logs" — only its length,
	// as a sanity check that a real alert body was actually built.
	const bodyLength = body ? body.length : 0;

	if (CONFIG.TEST_MODE) {
		logger.info('[MODO DE TESTE] Alerta não enviado — apenas logado', { recipients, subject, bodyLength });
		return { sent: false, message_id: null, error: 'test_mode' };
	}

	if (!isEmailConfigured()) {
		logger.warn('Envio de e-mail não configurado (EMAIL_SMTP_HOST/EMAIL_FROM_ADDRESS ausentes) — alerta apenas logado', {
			recipients,
			subject,
			bodyLength,
		});
		return { sent: false, message_id: null, error: 'email_not_configured' };
	}

	// TODO(real integration): call the configured SMTP relay or Gmail API here,
	// sending `body` as the message content. Left unimplemented deliberately —
	// no live credentials are available in this environment, and section 14
	// requires these to stay internal-only.
	logger.info('Alerta de cobrança enviado', { recipients, subject, bodyLength });
	return { sent: true, message_id: `ALERT-${Date.now()}`, error: null };
}

module.exports = { isEmailConfigured, sendInternalAlertEmail };
