/**
 * FRANCFORT — Gmail → Ruflo webhook sync
 *
 * Thin "sensor" only: this script never parses FTR/booking/payment data
 * itself. It watches export@francfort.co's inbox and forwards each new
 * message (plus small attachments, or Drive links for large ones) to the
 * Ruflo Cloud Run service's existing /webhook-gmail endpoint, which routes
 * it to the COMUNICACAO agent. All extraction, cross-referencing, payment
 * status, Calendar events and 7-day alerts live in that Node service
 * (src/agents/comunicacao, src/agents/financeiro, src/agents/logistics) —
 * see docs/ARQUITETURA.md and docs/PAGAMENTOS_TRACKING.md for why.
 *
 * Secrets (webhook URL + shared secret) are never hardcoded here — they are
 * read from Script Properties, set via the "FRANCFORT – PAGAMENTOS" menu's
 * "Configurar credenciais" item or manually under
 * Project Settings → Script Properties.
 */

var CONFIG = {
  // Script Properties keys (values set via the menu, not hardcoded).
  PROP_WEBHOOK_URL: 'WEBHOOK_URL', // e.g. https://ruflo-xxxx.run.app/webhook-gmail
  PROP_WEBHOOK_SECRET: 'WEBHOOK_SHARED_SECRET', // must match Cloud Run's WEBHOOK_SHARED_SECRET
  PROP_TEST_MODE: 'TEST_MODE', // 'true' | 'false' (string, Script Properties are strings)
  PROP_USE_LABEL: 'USE_PROCESSED_LABEL', // 'true' | 'false'
  PROP_LAST_CHECKPOINT: 'LAST_CHECKPOINT_EPOCH_MS',
  PROP_PROCESSED_IDS: 'PROCESSED_MESSAGE_IDS', // JSON array, capped — see Utils.gs

  TIMEZONE: 'America/Sao_Paulo',

  // Gmail search scope. Kept broad (inbox only) rather than filtered by
  // subject keywords — task spec section 1: "o código não deve depender
  // exclusivamente do assunto do e-mail".
  GMAIL_SEARCH_BASE: 'in:inbox',
  // First-ever run has no checkpoint; this bounds how far back it looks so
  // it doesn't try to walk the entire mailbox history in one execution.
  INITIAL_BACKFILL_DAYS: 30,
  // A few minutes of overlap on every run guards against a message that
  // arrived mid-execution and could otherwise be skipped by a hard cutoff.
  OVERLAP_MINUTES: 10,

  MAX_MESSAGES_PER_RUN: 25, // stays well under the 6-minute execution quota
  MAX_INLINE_ATTACHMENT_BYTES: 3 * 1024 * 1024, // larger attachments go to Drive instead
  DRIVE_FOLDER_NAME: 'Francfort Ruflo - Anexos Gmail Sync',

  PROCESSED_LABEL_NAME: 'AUTOMACAO/PAGAMENTOS-PROCESSADO',

  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,

  SYNC_TRIGGER_MINUTES: 15,

  ERROR_NOTIFICATION_EMAIL: 'export@francfort.co',
};

function getScriptProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setScriptProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
}

function isTestMode() {
  return getScriptProp_(CONFIG.PROP_TEST_MODE) === 'true';
}

function isProcessedLabelEnabled() {
  return getScriptProp_(CONFIG.PROP_USE_LABEL) === 'true';
}

function getWebhookUrl_() {
  var url = getScriptProp_(CONFIG.PROP_WEBHOOK_URL);
  if (!url) throw new Error('WEBHOOK_URL não configurado. Use o menu "FRANCFORT – PAGAMENTOS" > "Configurar credenciais".');
  return url;
}

function getWebhookSecret_() {
  var secret = getScriptProp_(CONFIG.PROP_WEBHOOK_SECRET);
  if (!secret) throw new Error('WEBHOOK_SHARED_SECRET não configurado. Use o menu "FRANCFORT – PAGAMENTOS" > "Configurar credenciais".');
  return secret;
}
