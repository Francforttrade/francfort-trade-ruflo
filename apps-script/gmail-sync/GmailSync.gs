/**
 * Main sync entry point — installed on a 15-minute time trigger (see
 * Triggers.gs) and also runnable on demand from the "FRANCFORT –
 * PAGAMENTOS" menu ("Sincronizar agora").
 *
 * What it does, per task spec section 9:
 *  - only touches messages newer than the stored checkpoint;
 *  - never marks read, archives, deletes, moves, or replies;
 *  - optionally applies one label (configurable, off by default);
 *  - guards against overlapping runs with LockService;
 *  - is safe to re-run: a message already forwarded is skipped by id.
 */
function syncGmailToWebhook() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    Logger.log('Sincronização já em andamento (lock ocupado) — encerrando.');
    return { skipped: true, reason: 'lock_busy' };
  }

  try {
    return runSync_();
  } finally {
    lock.releaseLock();
  }
}

function runSync_() {
  var checkpointMs = getCheckpointMs_();
  var searchFromMs = checkpointMs - CONFIG.OVERLAP_MINUTES * 60 * 1000;
  var processedIds = loadProcessedIds_();
  var processedIdSet = {};
  for (var i = 0; i < processedIds.length; i++) processedIdSet[processedIds[i]] = true;

  var query = CONFIG.GMAIL_SEARCH_BASE + ' after:' + formatDateForSearch_(new Date(searchFromMs));
  var threads = GmailApp.search(query, 0, 200);

  var candidates = [];
  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = 0; m < messages.length; m++) {
      var message = messages[m];
      if (message.getDate().getTime() <= searchFromMs) continue;
      if (processedIdSet[message.getId()]) continue;
      candidates.push(message);
    }
  }

  // Oldest first, so the checkpoint advances monotonically as messages
  // succeed and a mid-batch failure leaves the checkpoint at the right spot
  // for the next run to pick up from.
  candidates.sort(function (a, b) {
    return a.getDate().getTime() - b.getDate().getTime();
  });

  var batch = candidates.slice(0, CONFIG.MAX_MESSAGES_PER_RUN);
  var sent = 0;
  var failed = 0;
  var maxSuccessfulDate = checkpointMs;
  var consecutiveFailures = 0;

  for (var idx = 0; idx < batch.length; idx++) {
    var msg = batch[idx];
    try {
      forwardMessage_(msg);
      processedIds.push(msg.getId());
      maxSuccessfulDate = Math.max(maxSuccessfulDate, msg.getDate().getTime());
      sent += 1;
      consecutiveFailures = 0;

      if (isProcessedLabelEnabled()) {
        applyProcessedLabel_(msg.getThread());
      }
    } catch (e) {
      failed += 1;
      consecutiveFailures += 1;
      Logger.log('Falha ao encaminhar mensagem ' + msg.getId() + ': ' + e);
      // Left unprocessed on purpose — it stays a candidate on the next run
      // instead of silently being skipped forever.
      if (consecutiveFailures >= 3) {
        notifyCriticalFailure_(e, msg);
        break; // webhook is likely down/misconfigured — stop burning quota this run
      }
    }
  }

  saveProcessedIds_(processedIds);
  setCheckpointMs_(maxSuccessfulDate);

  var summary = { candidates: candidates.length, sent: sent, failed: failed, checkpoint: new Date(maxSuccessfulDate).toISOString() };
  Logger.log('Sync concluído: ' + JSON.stringify(summary));
  return summary;
}

function forwardMessage_(message) {
  var thread = message.getThread();
  var payload = {
    messageId: message.getId(),
    threadId: thread.getId(),
    permalink: 'https://mail.google.com/mail/u/0/#all/' + thread.getId(),
    from: message.getFrom(),
    to: message.getTo(),
    subject: message.getSubject(),
    body: message.getPlainBody(),
    date: message.getDate().toISOString(),
    attachments: collectAttachments_(message),
  };

  if (isTestMode()) {
    Logger.log('[MODO DE TESTE] Payload que seria enviado: ' + JSON.stringify(payload).slice(0, 500) + '...');
    return;
  }

  postWithRetry_(getWebhookUrl_(), payload, getWebhookSecret_());
}

// Small attachments (PDFs, xlsx, docx, images) travel inline as base64 so
// the Node side can extract text from them directly; larger ones are
// uploaded to a Drive folder instead and only the link is sent — keeping
// the webhook payload small and within Apps Script's own size limits.
function collectAttachments_(message) {
  var attachments = message.getAttachments({ includeInlineImages: true, includeAttachments: true });
  var result = [];

  for (var i = 0; i < attachments.length; i++) {
    var attachment = attachments[i];
    var size = attachment.getSize();
    var entry = { filename: attachment.getName(), mimeType: attachment.getContentType(), size: size };

    if (size <= CONFIG.MAX_INLINE_ATTACHMENT_BYTES) {
      entry.contentBase64 = base64EncodeAttachment_(attachment);
    } else {
      try {
        var folder = getOrCreateDriveFolder_(CONFIG.DRIVE_FOLDER_NAME);
        var file = folder.createFile(attachment);
        entry.driveFileId = file.getId();
        entry.driveUrl = file.getUrl();
      } catch (e) {
        entry.uploadError = String(e);
      }
    }

    result.push(entry);
  }

  return result;
}

function applyProcessedLabel_(thread) {
  var label = GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL_NAME) || GmailApp.createLabel(CONFIG.PROCESSED_LABEL_NAME);
  thread.addLabel(label);
}

function notifyCriticalFailure_(error, message) {
  try {
    MailApp.sendEmail({
      to: CONFIG.ERROR_NOTIFICATION_EMAIL,
      subject: 'FRANCFORT – Falha crítica na sincronização Gmail → Ruflo',
      body:
        'A sincronização parou após falhas consecutivas ao encaminhar mensagens para o webhook.\n\n' +
        'Última mensagem tentada: ' + (message ? message.getSubject() : 'N/D') + '\n' +
        'Erro: ' + error + '\n\n' +
        'Verifique se o serviço Cloud Run está no ar e se WEBHOOK_URL/WEBHOOK_SHARED_SECRET ainda são válidos.',
    });
  } catch (e) {
    Logger.log('Não foi possível enviar e-mail de alerta crítico: ' + e);
  }
}
