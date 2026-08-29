/**
 * Fallback de intake por Gmail para o agente COMUNICACAO (docs/ARQUITETURA.md,
 * docs/ROADMAP.md: "Fallback: Gmail trigger (Apps Script 15min)").
 *
 * A cada execução, varre a inbox por threads ainda não encaminhadas, envia
 * cada uma para o endpoint /webhook-gmail do Cloud Run e marca a thread com
 * PROCESSED_LABEL para não reenviar no próximo disparo.
 *
 * Script properties necessárias (Project Settings > Script Properties):
 *   - GCP_PROJECT_ID: projeto onde o secret francfort-whatsapp-webhook-secret
 *     existe (mesmo usado pelo Cloud Run, docs/DEPLOY.md).
 *   - WEBHOOK_URL: URL base do serviço Cloud Run (sem barra final).
 *
 * O secret do webhook não fica em Script Properties: é lido do Secret
 * Manager em tempo de execução via o token OAuth do próprio script
 * (escopo cloud-platform), reaproveitando o mesmo segredo já provisionado
 * para o Cloud Run em vez de duplicá-lo. A conta que autoriza o script
 * precisa do papel roles/secretmanager.secretAccessor nesse secret.
 */

const PROCESSED_LABEL = 'FTR-Processado';
const WEBHOOK_SECRET_NAME = 'francfort-whatsapp-webhook-secret';

function pollGmailIntake() {
	const webhookUrl = getRequiredProperty('WEBHOOK_URL');
	const webhookSecret = getWebhookSecret();
	const label = getOrCreateLabel(PROCESSED_LABEL);

	const threads = GmailApp.search(`in:inbox -label:${PROCESSED_LABEL}`, 0, 50);

	threads.forEach((thread) => {
		const messages = thread.getMessages();
		const lastMessage = messages[messages.length - 1];

		const payload = {
			threadId: thread.getId(),
			messageId: lastMessage.getId(),
			from: lastMessage.getFrom(),
			subject: thread.getFirstMessageSubject(),
			body: lastMessage.getPlainBody(),
		};

		try {
			sendToWebhook(webhookUrl, webhookSecret, payload);
			thread.addLabel(label);
		} catch (err) {
			console.error('Falha ao encaminhar thread do Gmail para o webhook: ' + err.message, {
				threadId: thread.getId(),
			});
		}
	});
}

function sendToWebhook(webhookUrl, webhookSecret, payload) {
	const response = UrlFetchApp.fetch(webhookUrl + '/webhook-gmail', {
		method: 'post',
		contentType: 'application/json',
		headers: { 'X-Webhook-Secret': webhookSecret },
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	});

	const status = response.getResponseCode();
	if (status < 200 || status >= 300) {
		throw new Error('Webhook retornou status ' + status + ': ' + response.getContentText());
	}
}

function getWebhookSecret() {
	const projectId = getRequiredProperty('GCP_PROJECT_ID');
	const url =
		'https://secretmanager.googleapis.com/v1/projects/' +
		projectId +
		'/secrets/' +
		WEBHOOK_SECRET_NAME +
		'/versions/latest:access';

	const response = UrlFetchApp.fetch(url, {
		headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
		muteHttpExceptions: true,
	});

	if (response.getResponseCode() !== 200) {
		throw new Error('Falha ao ler secret do Secret Manager: ' + response.getContentText());
	}

	const body = JSON.parse(response.getContentText());
	return Utilities.newBlob(Utilities.base64Decode(body.payload.data)).getDataAsString();
}

function getOrCreateLabel(name) {
	return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function getRequiredProperty(key) {
	const value = PropertiesService.getScriptProperties().getProperty(key);
	if (!value) {
		throw new Error('Script property ausente: ' + key + '. Configure em Project Settings > Script Properties.');
	}
	return value;
}

/**
 * Executar uma vez manualmente (editor do Apps Script) para criar o trigger
 * de 15 em 15 minutos. Idempotente: remove triggers antigos de
 * pollGmailIntake antes de recriar, então pode ser rodada de novo com
 * segurança.
 */
function setupTrigger() {
	ScriptApp.getProjectTriggers()
		.filter((trigger) => trigger.getHandlerFunction() === 'pollGmailIntake')
		.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

	ScriptApp.newTrigger('pollGmailIntake').timeBased().everyMinutes(15).create();
}
