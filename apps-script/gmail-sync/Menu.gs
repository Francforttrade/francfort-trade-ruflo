/**
 * Container-bound to a small control-panel Spreadsheet — see README.md for
 * setup. The menu is the operator's entire interface to this script; no
 * spreadsheet tab is otherwise required or written to by the sync itself.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('FRANCFORT – PAGAMENTOS')
    .addItem('Sincronizar agora', 'menuSyncNow_')
    .addSeparator()
    .addItem('Configurar credenciais (webhook)', 'menuConfigureCredentials_')
    .addItem('Ativar/desativar modo de teste', 'menuToggleTestMode_')
    .addItem('Ativar/desativar label de processado', 'menuToggleProcessedLabel_')
    .addSeparator()
    .addItem('Testar conexão com o webhook', 'menuTestWebhookConnection_')
    .addItem('Ver status/checkpoint atual', 'menuShowStatus_')
    .addItem('Resetar checkpoint (reprocessar tudo)', 'menuResetCheckpoint_')
    .addSeparator()
    .addItem('Instalar gatilho automático (15 min)', 'installSyncTrigger')
    .addItem('Remover gatilho automático', 'removeSyncTrigger')
    .addToUi();
}

function menuSyncNow_() {
  var ui = SpreadsheetApp.getUi();
  var result = syncGmailToWebhook();
  ui.alert('Sincronização concluída', JSON.stringify(result, null, 2), ui.ButtonSet.OK);
}

function menuConfigureCredentials_() {
  var ui = SpreadsheetApp.getUi();

  var urlResponse = ui.prompt('Configurar webhook', 'URL do endpoint /webhook-gmail (Cloud Run):', ui.ButtonSet.OK_CANCEL);
  if (urlResponse.getSelectedButton() !== ui.Button.OK) return;
  var url = urlResponse.getResponseText().trim();
  if (url) setScriptProp_(CONFIG.PROP_WEBHOOK_URL, url);

  var secretResponse = ui.prompt('Configurar webhook', 'Shared secret (deve ser igual a WEBHOOK_SHARED_SECRET no Cloud Run):', ui.ButtonSet.OK_CANCEL);
  if (secretResponse.getSelectedButton() !== ui.Button.OK) return;
  var secret = secretResponse.getResponseText().trim();
  if (secret) setScriptProp_(CONFIG.PROP_WEBHOOK_SECRET, secret);

  ui.alert('Credenciais salvas em Script Properties.');
}

function menuToggleTestMode_() {
  var next = !isTestMode();
  setScriptProp_(CONFIG.PROP_TEST_MODE, String(next));
  SpreadsheetApp.getUi().alert('Modo de teste agora está: ' + (next ? 'ATIVADO (nada será enviado ao webhook)' : 'DESATIVADO'));
}

function menuToggleProcessedLabel_() {
  var next = !isProcessedLabelEnabled();
  setScriptProp_(CONFIG.PROP_USE_LABEL, String(next));
  SpreadsheetApp.getUi().alert(
    'Label "' + CONFIG.PROCESSED_LABEL_NAME + '" agora está: ' + (next ? 'ATIVADA' : 'DESATIVADA')
  );
}

function menuTestWebhookConnection_() {
  var ui = SpreadsheetApp.getUi();
  try {
    var result = testWebhookConnection();
    ui.alert('Conexão OK', 'HTTP ' + result.status + '\n' + result.body, ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Falha na conexão', String(e), ui.ButtonSet.OK);
  }
}

function menuShowStatus_() {
  var ui = SpreadsheetApp.getUi();
  var checkpointMs = getCheckpointMs_();
  var status = [
    'Checkpoint atual: ' + new Date(checkpointMs).toISOString(),
    'Modo de teste: ' + (isTestMode() ? 'ATIVADO' : 'desativado'),
    'Label de processado: ' + (isProcessedLabelEnabled() ? 'ATIVADA' : 'desativada'),
    'Mensagens já processadas (cache local): ' + loadProcessedIds_().length,
    'Webhook configurado: ' + (getScriptProp_(CONFIG.PROP_WEBHOOK_URL) ? 'sim' : 'NÃO'),
  ].join('\n');
  ui.alert('Status da sincronização', status, ui.ButtonSet.OK);
}

function menuResetCheckpoint_() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    'Resetar checkpoint',
    'Isso fará a próxima sincronização reprocessar até ' + CONFIG.INITIAL_BACKFILL_DAYS + ' dias de e-mails novamente. Continuar?',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  PropertiesService.getScriptProperties().deleteProperty(CONFIG.PROP_LAST_CHECKPOINT);
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.PROP_PROCESSED_IDS);
  ui.alert('Checkpoint e cache de mensagens processadas foram limpos.');
}
