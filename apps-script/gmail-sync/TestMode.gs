/**
 * Connectivity + config self-checks. None of these touch real Gmail data or
 * send anything to a buyer — testWebhookConnection() does call the real
 * webhook, but with an explicit `ping: true` payload the Node side can (and
 * should) recognize and no-op on rather than treat as a real message.
 */
function testWebhookConnection() {
  var url = getWebhookUrl_();
  var secret = getWebhookSecret_();

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Webhook-Secret': secret },
    payload: JSON.stringify({ ping: true, source: 'apps-script-gmail-sync', sentAt: new Date().toISOString() }),
    muteHttpExceptions: true,
  });

  return { status: response.getResponseCode(), body: response.getContentText() };
}

// Sanity-checks configuration without touching Gmail, Drive, or the
// network — safe to run at any time, including before credentials exist.
function runSelfTests() {
  var results = [];

  results.push(checkTrue_('WEBHOOK_URL está configurado', Boolean(getScriptProp_(CONFIG.PROP_WEBHOOK_URL))));
  results.push(checkTrue_('GCP_PROJECT_ID está configurado', Boolean(getScriptProp_(CONFIG.PROP_GCP_PROJECT_ID))));
  results.push(checkTrue_('Checkpoint é um número válido', !isNaN(getCheckpointMs_())));
  results.push(checkTrue_('Lista de processados é um array', Array.isArray(loadProcessedIds_())));

  var summary = results.map(function (r) { return (r.ok ? 'OK  ' : 'FAIL') + ' - ' + r.label; }).join('\n');
  Logger.log(summary);

  if (typeof SpreadsheetApp !== 'undefined') {
    try {
      SpreadsheetApp.getUi().alert('Testes de configuração', summary, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (e) {
      // Running from the script editor without a bound UI context — the
      // Logger output above is enough.
    }
  }

  return results;
}

function checkTrue_(label, condition) {
  return { label: label, ok: Boolean(condition) };
}

// Exercises the pure formatting/checkpoint helpers with fixed inputs — the
// closest thing to a unit test this environment supports. Run manually from
// the script editor (select the function, press Run) after any edit to
// Utils.gs/GmailSync.gs.
function runFormattingSelfTests_() {
  var assertions = [];

  var fixedDate = new Date('2026-09-01T00:00:00Z');
  assertions.push(['formatDateForSearch_', formatDateForSearch_(fixedDate) === '2026/09/01']);

  setScriptProp_(CONFIG.PROP_PROCESSED_IDS, JSON.stringify(['a', 'b', 'c']));
  assertions.push(['loadProcessedIds_ round-trip', JSON.stringify(loadProcessedIds_()) === JSON.stringify(['a', 'b', 'c'])]);
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.PROP_PROCESSED_IDS);

  var failed = assertions.filter(function (a) { return !a[1]; });
  Logger.log(assertions.map(function (a) { return (a[1] ? 'OK  ' : 'FAIL') + ' - ' + a[0]; }).join('\n'));
  if (failed.length > 0) throw new Error(failed.length + ' asserção(ões) falharam — veja os Logs.');
  return 'Todas as asserções passaram.';
}
