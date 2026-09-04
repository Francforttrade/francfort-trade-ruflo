/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Triggers.gs
 * ============================================================
 *
 * ÚNICO arquivo que declara funções verdadeiramente globais — são as
 * únicas que um trigger instalável ou o menu da planilha conseguem
 * encontrar pelo nome. Todas prefixadas com `trackingFtr` para nunca
 * colidir com qualquer outro .gs no mesmo projeto Apps Script (ex.:
 * automacao.gs, que já declara `processarTrackingFTR`,
 * `testarExtracao`, `diagnosticarPlanilha` com OUTRO significado).
 *
 * ORDEM DE EXECUÇÃO RECOMENDADA — ver README do módulo:
 *   1. trackingFtrValidarPermissoes()
 *   2. trackingFtrDiagnosticarCabecalho()
 *   3. trackingFtrRodarTestesInternos()
 *   4. trackingFtrDryRun(10)
 *   5. trackingFtrProcessar()               (grava de verdade)
 *   6. trackingFtrInstalarAcionadores()      (automação)
 */

// ==========================================================
// EXECUÇÃO PRINCIPAL (grava na planilha — protegida por lock)
// ==========================================================

function trackingFtrProcessar() {
  console.log('=== TrackingFTR v' + TrackingFTR.VERSION + ' — EXECUÇÃO REAL ===');
  try {
    const relatorio = TrackingFTR.Persistence.comBloqueio(function () {
      return TrackingFTR.Pipeline.executar({ dryRun: false });
    });
    console.log(JSON.stringify({
      execucaoId: relatorio.execucaoId,
      threadsEncontradas: relatorio.threadsEncontradas,
      threadsFiltradas: relatorio.threadsFiltradas,
      threadsAmbiguas: relatorio.threadsAmbiguas,
      threadsSemFtr: relatorio.threadsSemFtr,
      threadsComErro: relatorio.threadsComErro,
      updates: relatorio.updates,
      novasLinhas: relatorio.novasLinhas,
      watermarkAvancado: relatorio.watermarkAvancado,
      execucaoCompleta: relatorio.execucaoCompleta,
      avisos: relatorio.avisos,
    }));
    return relatorio;
  } catch (e) {
    if (e.message && e.message.indexOf('LOCK_OCUPADO') === 0) {
      console.warn('TrackingFTR: execução abortada — outra execução já está em andamento. Nada foi gravado.');
      return { abortadoPorLock: true };
    }
    TrackingFTR.Security.logErroSeguro('TrackingFTR: ERRO CRÍTICO na execução principal', e);
    throw e;
  }
}

// ==========================================================
// DIAGNÓSTICO / TESTE (nunca gravam dados de produção)
// ==========================================================

function trackingFtrDiagnosticarCabecalho() { return TrackingFTR.Diag.diagnosticarCabecalho(); }
function trackingFtrDryRun(limiteThreads) { return TrackingFTR.Diag.executarDryRun(limiteThreads); }
function trackingFtrTestarThread(threadId) { return TrackingFTR.Diag.testarThreadEspecifica(threadId); }
function trackingFtrTestarAnexo(messageId, indiceAnexo) { return TrackingFTR.Diag.testarAnexoEspecifico(messageId, indiceAnexo); }
function trackingFtrRodarTestesInternos() { return TrackingFTR.Diag.rodarTestesInternos(); }
function trackingFtrExibirFilaOcr() { return TrackingFTR.Diag.exibirFilaOcr(); }
function trackingFtrValidarPermissoes() { return TrackingFTR.Diag.validarPermissoesServicos(); }
function trackingFtrValidarCompartilhamentos() { return TrackingFTR.Diag.validarCompartilhamentosInseguros(); }
function trackingFtrVerificarPastaTemp() { return TrackingFTR.Diag.verificarPastaTempAutorizada(); }
function trackingFtrVerificarAcessoRestrito() { return TrackingFTR.Diag.verificarAcessoRestritoPlanilhaELog(); }

// ==========================================================
// OPERAÇÃO / MANUTENÇÃO (gravam APENAS quando confirmado explicitamente)
// ==========================================================

function trackingFtrReprocessarFTR(ftrTexto, confirmarGravacao) {
  return TrackingFTR.Diag.reprocessarFTR(ftrTexto, confirmarGravacao === true);
}

function trackingFtrReprocessarPeriodo(dias, confirmarGravacao) {
  return TrackingFTR.Diag.reprocessarPeriodo(dias || 90, confirmarGravacao === true);
}

function trackingFtrLimparTemporarios() { return TrackingFTR.Diag.limparTemporarios(); }
function trackingFtrResetarWatermark() { return TrackingFTR.Diag.resetarWatermark(); }
function trackingFtrPadronizarFTRs(aplicar) { return TrackingFTR.Diag.padronizarFTRs(aplicar === true); }

/** Limpeza de órfãos + retenção do log — pensada para rodar 1x/dia via acionador. */
function trackingFtrManutencaoDiaria() {
  console.log('=== TrackingFTR — MANUTENÇÃO DIÁRIA ===');
  try {
    const limpeza = TrackingFTR.Attach.limparTemporariosOrfaos();
    console.log('Temporários removidos: ' + limpeza.removidos + '/' + limpeza.inspecionados);
  } catch (e) {
    TrackingFTR.Security.logErroSeguro('Manutenção: falha na limpeza de temporários', e);
  }
  try {
    const sheetInfo = TrackingFTR.Persistence.abrirPlanilha();
    const abaLog = TrackingFTR.Persistence.abrirOuCriarAbaLog(sheetInfo.spreadsheet);
    const removidas = TrackingFTR.Persistence.aplicarRetencaoLog(abaLog);
    console.log('Linhas de log removidas por retenção: ' + removidas);
  } catch (e) {
    TrackingFTR.Security.logErroSeguro('Manutenção: falha aplicando retenção do log', e);
  }
}

// ==========================================================
// INSTALAÇÃO / REMOÇÃO DE ACIONADORES
// ==========================================================

/**
 * Cria os acionadores automáticos deste módulo:
 *   - trackingFtrProcessar a cada 30 minutos;
 *   - trackingFtrManutencaoDiaria 1x por dia (limpeza + retenção).
 * Idempotente: remove primeiro qualquer acionador `trackingFtr*` já
 * existente antes de recriar, evitando duplicatas a cada chamada.
 */
function trackingFtrInstalarAcionadores() {
  trackingFtrRemoverAcionadores();

  ScriptApp.newTrigger('trackingFtrProcessar').timeBased().everyMinutes(30).create();
  ScriptApp.newTrigger('trackingFtrManutencaoDiaria').timeBased().everyDays(1).atHour(3).create();

  console.log('✓ Acionadores instalados: trackingFtrProcessar (30 min), trackingFtrManutencaoDiaria (diário, 03h).');
  console.log('ℹ Confirme a identidade que executa os acionadores em Configurações do projeto → Executar como.');
}

/** Remove SOMENTE os acionadores criados por este módulo (prefixo trackingFtr). */
function trackingFtrRemoverAcionadores() {
  const todos = ScriptApp.getProjectTriggers();
  let removidos = 0;
  todos.forEach(function (t) {
    if (t.getHandlerFunction().indexOf('trackingFtr') === 0) {
      ScriptApp.deleteTrigger(t);
      removidos++;
    }
  });
  console.log('✓ ' + removidos + ' acionador(es) do TrackingFTR removido(s).');
  return removidos;
}

// ==========================================================
// MENU (opcional — só funciona se o script estiver vinculado à
// planilha como script de contêiner; em script standalone, chame as
// funções diretamente pelo editor do Apps Script)
// ==========================================================

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('TrackingFTR')
      .addItem('Diagnosticar cabeçalho', 'trackingFtrDiagnosticarCabecalho')
      .addItem('Rodar testes internos', 'trackingFtrRodarTestesInternos')
      .addItem('Dry-run (10 threads)', 'trackingFtrDryRun')
      .addSeparator()
      .addItem('Processar agora (grava)', 'trackingFtrProcessar')
      .addSeparator()
      .addItem('Validar permissões/serviços', 'trackingFtrValidarPermissoes')
      .addItem('Validar compartilhamentos', 'trackingFtrValidarCompartilhamentos')
      .addToUi();
  } catch (e) {
    // Sem contexto de UI (script standalone, execução via trigger, etc.) — não é um erro.
  }
}
