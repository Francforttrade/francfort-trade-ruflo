/**
 * Installs/removes the time-driven trigger. Idempotent: installing twice
 * doesn't create a second trigger, and removing when none exists is a no-op.
 */
function installSyncTrigger() {
  deleteSyncTriggers_();
  ScriptApp.newTrigger('syncGmailToWebhook').timeBased().everyMinutes(CONFIG.SYNC_TRIGGER_MINUTES).create();
  SpreadsheetApp.getUi().alert('Gatilho instalado: sincronização a cada ' + CONFIG.SYNC_TRIGGER_MINUTES + ' minutos.');
}

function removeSyncTrigger() {
  var removed = deleteSyncTriggers_();
  SpreadsheetApp.getUi().alert(removed > 0 ? 'Gatilho(s) removido(s): ' + removed : 'Nenhum gatilho estava instalado.');
}

function deleteSyncTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncGmailToWebhook') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed += 1;
    }
  }
  return removed;
}
