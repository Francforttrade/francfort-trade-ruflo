/**
 * Small stateless helpers shared by GmailSync.gs — kept separate so they can
 * be reasoned about (and manually re-run from the editor) independently of
 * the Gmail-touching code.
 */

function loadProcessedIds_() {
  var raw = getScriptProp_(CONFIG.PROP_PROCESSED_IDS);
  if (!raw) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

// Caps the processed-id list so Script Properties (limited to ~9KB per
// value) never overflows — the checkpoint timestamp is the real incremental
// mechanism; this list only guards against reprocessing within the overlap
// window a run's search re-scans.
var MAX_PROCESSED_IDS_KEPT = 500;

function saveProcessedIds_(ids) {
  var trimmed = ids.slice(Math.max(0, ids.length - MAX_PROCESSED_IDS_KEPT));
  setScriptProp_(CONFIG.PROP_PROCESSED_IDS, JSON.stringify(trimmed));
}

function getCheckpointMs_() {
  var raw = getScriptProp_(CONFIG.PROP_LAST_CHECKPOINT);
  if (raw) return Number(raw);
  return Date.now() - CONFIG.INITIAL_BACKFILL_DAYS * 24 * 60 * 60 * 1000;
}

function setCheckpointMs_(ms) {
  setScriptProp_(CONFIG.PROP_LAST_CHECKPOINT, String(ms));
}

function formatDateForSearch_(date) {
  return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy/MM/dd');
}

// POSTs with exponential backoff. Returns the HTTPResponse on success or
// throws after exhausting retries — callers decide what "give up on this
// message" means (skip it, leave it unprocessed for next run).
function postWithRetry_(url, payload, secret) {
  var attempt = 0;
  var lastError = null;

  while (attempt < CONFIG.MAX_RETRIES) {
    try {
      var response = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-Webhook-Secret': secret },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      var code = response.getResponseCode();
      if (code >= 200 && code < 300) return response;

      lastError = new Error('Webhook respondeu HTTP ' + code + ': ' + response.getContentText());
    } catch (e) {
      lastError = e;
    }

    attempt += 1;
    if (attempt < CONFIG.MAX_RETRIES) {
      Utilities.sleep(CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
}

function getOrCreateDriveFolder_(name) {
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function base64EncodeAttachment_(attachment) {
  return Utilities.base64Encode(attachment.getBytes());
}
