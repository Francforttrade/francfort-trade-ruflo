/**
 * RUFLO — Gmail intake (docs/ARQUITETURA.md "APPSCRIPT" node).
 *
 * Runs on a 15min time trigger, searches Gmail for unread trade messages,
 * and POSTs each one to the Cloud Run /webhook-email endpoint, which routes
 * it through master.route() into the COMUNICACAO agent exactly like
 * /webhook-whatsapp does for WhatsApp messages.
 *
 * Setup: see docs/GMAIL_INTAKE.md. Summary:
 *   1. Push this project with clasp (or paste into script.google.com).
 *   2. Set Script Properties (File > Project properties > Script properties):
 *        RUFLO_ENDPOINT_URL   e.g. https://ruflo-xxx.run.app/webhook-email
 *        GMAIL_SEARCH_QUERY   optional, overrides DEFAULT_SEARCH_QUERY below
 *        USE_IAM_AUTH         "true" if Cloud Run requires authenticated
 *                             invocations (the DEPLOY.md default)
 *        IAM_SERVICE_ACCOUNT_EMAIL  the service account granted
 *                             roles/run.invoker on the Cloud Run service
 *                             (only needed when USE_IAM_AUTH is "true")
 *   3. Run setup() once from the Apps Script editor to create the Gmail
 *      labels and the 15min trigger.
 */

var DEFAULT_SEARCH_QUERY =
	'is:unread -label:Ruflo/Processado -label:Ruflo/Falhou (FTR OR booking OR invoice OR fatura OR oferta OR "BL" OR phyto)';
var PROCESSED_LABEL_NAME = 'Ruflo/Processado';
var FAILED_LABEL_NAME = 'Ruflo/Falhou';
var MAX_THREADS_PER_RUN = 50;
var MAX_BODY_LENGTH = 20000;
var ID_TOKEN_CACHE_SECONDS = 50 * 60; // ID tokens last ~1h; refresh a bit early.

/**
 * One-time setup: creates the Gmail labels this script manages and installs
 * the 15min trigger. Safe to re-run — it clears any previous intakeGmail
 * trigger before creating a new one.
 */
function setup() {
	getOrCreateLabel_(PROCESSED_LABEL_NAME);
	getOrCreateLabel_(FAILED_LABEL_NAME);

	var triggers = ScriptApp.getProjectTriggers();
	for (var i = 0; i < triggers.length; i++) {
		if (triggers[i].getHandlerFunction() === 'intakeGmail') {
			ScriptApp.deleteTrigger(triggers[i]);
		}
	}

	ScriptApp.newTrigger('intakeGmail').timeBased().everyMinutes(15).create();
	Logger.log('Setup concluído: labels criadas e trigger de 15min instalado.');
}

/**
 * Trigger entry point. Searches for unread trade emails and forwards each
 * one to the Cloud Run intake endpoint.
 */
function intakeGmail() {
	var props = PropertiesService.getScriptProperties();
	var endpointUrl = props.getProperty('RUFLO_ENDPOINT_URL');
	if (!endpointUrl) {
		Logger.log('RUFLO_ENDPOINT_URL não configurado em Script Properties — abortando.');
		return;
	}

	var searchQuery = props.getProperty('GMAIL_SEARCH_QUERY') || DEFAULT_SEARCH_QUERY;
	var processedLabel = getOrCreateLabel_(PROCESSED_LABEL_NAME);
	var failedLabel = getOrCreateLabel_(FAILED_LABEL_NAME);

	var threads = GmailApp.search(searchQuery, 0, MAX_THREADS_PER_RUN);
	Logger.log('Encontradas ' + threads.length + ' threads para processar.');

	var successCount = 0;
	var failureCount = 0;

	for (var t = 0; t < threads.length; t++) {
		var thread = threads[t];
		var messages = thread.getMessages();
		var threadOk = true;

		for (var m = 0; m < messages.length; m++) {
			var message = messages[m];
			if (!message.isUnread()) continue;

			try {
				postToRuflo_(endpointUrl, buildPayload_(message));
				message.markRead();
				successCount++;
			} catch (err) {
				threadOk = false;
				failureCount++;
				Logger.log('Falha ao processar mensagem "' + message.getSubject() + '": ' + err);
			}
		}

		thread.addLabel(threadOk ? processedLabel : failedLabel);
	}

	Logger.log('intakeGmail concluído: ' + successCount + ' mensagens ok, ' + failureCount + ' falhas.');
}

function buildPayload_(message) {
	var body = message.getPlainBody() || '';
	if (body.length > MAX_BODY_LENGTH) {
		body = body.substring(0, MAX_BODY_LENGTH);
	}

	return {
		from: message.getFrom(),
		subject: message.getSubject(),
		body: body,
		threadId: message.getThread().getId(),
	};
}

function postToRuflo_(endpointUrl, payload) {
	var options = {
		method: 'post',
		contentType: 'application/json',
		payload: JSON.stringify(payload),
		muteHttpExceptions: true,
	};

	var authHeader = buildAuthHeader_(endpointUrl);
	if (authHeader) {
		options.headers = { Authorization: authHeader };
	}

	var response = UrlFetchApp.fetch(endpointUrl, options);
	var status = response.getResponseCode();
	if (status < 200 || status >= 300) {
		throw new Error('HTTP ' + status + ': ' + response.getContentText());
	}
}

/**
 * Cloud Run is deployed with --no-allow-unauthenticated (docs/DEPLOY.md), so
 * calls need a Google-signed ID token whose audience is the service URL.
 * Apps Script can't mint that directly, so it impersonates a service
 * account (granted roles/run.invoker on the Cloud Run service) via the IAM
 * Credentials API, which requires the script's own identity to hold
 * roles/iam.serviceAccountTokenCreator on that service account. See
 * docs/GMAIL_INTAKE.md for the one-time IAM setup.
 */
function buildAuthHeader_(audience) {
	var props = PropertiesService.getScriptProperties();
	if (props.getProperty('USE_IAM_AUTH') !== 'true') {
		return null;
	}

	var serviceAccountEmail = props.getProperty('IAM_SERVICE_ACCOUNT_EMAIL');
	if (!serviceAccountEmail) {
		throw new Error('USE_IAM_AUTH=true requer IAM_SERVICE_ACCOUNT_EMAIL em Script Properties.');
	}

	var cache = CacheService.getScriptCache();
	var cacheKey = 'id_token_' + serviceAccountEmail;
	var cached = cache.get(cacheKey);
	if (cached) {
		return 'Bearer ' + cached;
	}

	var url =
		'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/' +
		encodeURIComponent(serviceAccountEmail) +
		':generateIdToken';

	var response = UrlFetchApp.fetch(url, {
		method: 'post',
		contentType: 'application/json',
		headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
		payload: JSON.stringify({ audience: audience, includeEmail: true }),
		muteHttpExceptions: true,
	});

	if (response.getResponseCode() !== 200) {
		throw new Error('Falha ao gerar ID token via generateIdToken: ' + response.getContentText());
	}

	var idToken = JSON.parse(response.getContentText()).token;
	cache.put(cacheKey, idToken, ID_TOKEN_CACHE_SECONDS);
	return 'Bearer ' + idToken;
}

function getOrCreateLabel_(name) {
	return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
