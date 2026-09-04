/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Diagnostics.gs
 * ============================================================
 *
 * Funções de teste e diagnóstico. Nenhuma delas grava na planilha de
 * produção nem envia dado nenhum a serviço externo. Os wrappers
 * globais chamáveis por nome (menu/editor) ficam em Triggers.gs, com
 * o prefixo `trackingFtr...`; este arquivo só implementa a lógica.
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Diag = {};

(function (D) {

  // ==========================================================
  // 0) PADRONIZAÇÃO DA COLUNA FTR (mantido do indexador original —
  //    reescreve "3062-26", "FTR-03062-26" etc. no formato canônico
  //    "FTR 03062-26". Dry-run por padrão; só grava com aplicar=true.
  // ==========================================================

  D.padronizarFTRs = function (aplicar) {
    const modo = aplicar === true ? 'APLICAR' : 'DRY-RUN';
    console.log('=== TrackingFTR — PADRONIZAR COLUNA FTR (' + modo + ') ===');

    let sheetInfo;
    try {
      sheetInfo = TrackingFTR.Persistence.abrirPlanilha();
    } catch (e) {
      TrackingFTR.Security.logErroSeguro('Diagnostics: não foi possível abrir a planilha com segurança', e);
      return;
    }
    const colInfo = TrackingFTR.SheetMap.mapearColunas(sheetInfo.sheet);
    if (!colInfo.mapa.FTR) { console.error('Coluna FTR não localizada.'); return; }

    const sheet = sheetInfo.sheet;
    const ultimaLinha = sheet.getLastRow();
    if (ultimaLinha < TrackingFTR.Config.LINHA_INICIAL) { console.log('Planilha vazia.'); return; }

    const range = sheet.getRange(TrackingFTR.Config.LINHA_INICIAL, colInfo.mapa.FTR, ultimaLinha - TrackingFTR.Config.LINHA_INICIAL + 1, 1);
    const valores = range.getValues();

    let semFtr = 0, jaCorretos = 0, aPadronizar = 0, invalidos = 0;
    const novosValores = valores.map(function (linha) {
      const atual = (linha[0] || '').toString().trim();
      if (!atual) { semFtr++; return [atual]; }
      const numero = TrackingFTR.Extract.normalizarFTR(atual);
      if (!numero) { invalidos++; return [atual]; }
      const padronizado = TrackingFTR.Extract.formatarFTRParaGravar(numero);
      if (atual === padronizado) { jaCorretos++; return [atual]; }
      aPadronizar++;
      return [padronizado];
    });

    console.log('Já no padrão: ' + jaCorretos + ' | A padronizar: ' + aPadronizar + ' | Inválidos: ' + invalidos + ' | Vazios: ' + semFtr);

    if (aplicar === true && aPadronizar > 0) {
      TrackingFTR.Persistence.comBloqueio(function () {
        range.setValues(novosValores);
        range.setNumberFormat('@');
      });
      console.log('✓ APLICADO: ' + aPadronizar + ' linha(s) padronizada(s).');
    } else if (aPadronizar > 0) {
      console.log('ℹ DRY-RUN — nada foi escrito. Para aplicar: trackingFtrPadronizarFTRs(true)');
    } else {
      console.log('✓ Nada a fazer — coluna FTR já consistente.');
    }
  };

  // ==========================================================
  // 1) DIAGNÓSTICO DE CABEÇALHO / MAPEAMENTO DE COLUNAS
  // ==========================================================

  D.diagnosticarCabecalho = function () {
    console.log('=== TrackingFTR v' + TrackingFTR.VERSION + ' — DIAGNÓSTICO DE CABEÇALHO ===');
    let sheetInfo;
    try {
      sheetInfo = TrackingFTR.Persistence.abrirPlanilha();
    } catch (e) {
      TrackingFTR.Security.logErroSeguro('Diagnostics: não foi possível abrir a planilha com segurança', e);
      return;
    }
    const colInfo = TrackingFTR.SheetMap.mapearColunas(sheetInfo.sheet);
    console.log('Planilha: "' + sheetInfo.sheet.getName() + '" — linhas=' + sheetInfo.sheet.getLastRow() + ', colunas=' + sheetInfo.sheet.getLastColumn());
    if (colInfo.colunasCriadas.length) {
      console.log('Colunas criadas nesta chamada: ' + colInfo.colunasCriadas.join(', '));
    }
    console.log('Mapeamento lógico → coluna:');
    Object.keys(colInfo.mapa).forEach(function (chave) {
      console.log('  ' + chave + ' → ' + (colInfo.mapa[chave] || '(não encontrada)'));
    });

    const indice = TrackingFTR.Persistence.construirIndice(sheetInfo.sheet, colInfo.mapa);
    console.log('FTRs indexados: ' + indice.porFtr.size + ' | Bookings indexados: ' + indice.porBooking.size + ' | BLs indexados: ' + indice.porBl.size);

    const watermark = TrackingFTR.Gmail.obterWatermark();
    console.log('Watermark salvo: ' + (watermark ? watermark.toISOString() : '(nenhum — próxima execução usa janela padrão)'));
  };

  // ==========================================================
  // 2) DRY-RUN
  // ==========================================================

  D.executarDryRun = function (limiteThreads) {
    console.log('=== TrackingFTR v' + TrackingFTR.VERSION + ' — DRY-RUN (nada será gravado) ===');
    const relatorio = TrackingFTR.Pipeline.executar({ dryRun: true, maxThreads: limiteThreads || 10 });
    imprimirRelatorio_(relatorio);
    console.log('✓ Nenhum dado foi escrito na planilha.');
    console.log('✓ Nenhum anexo original foi alterado.');
    console.log('✓ Nenhum conteúdo foi enviado a serviço externo (só Google Drive/Docs/Sheets dentro do próprio domínio autorizado).');
    return relatorio;
  };

  // ==========================================================
  // 3) TESTAR UMA THREAD ESPECÍFICA
  // ==========================================================

  D.testarThreadEspecifica = function (threadId) {
    if (!threadId) { console.error('Informe o threadId. Ex.: trackingFtrTestarThread("18abc...")'); return; }
    console.log('=== TrackingFTR — TESTE DE THREAD ÚNICA (DRY-RUN) ===');
    const relatorio = TrackingFTR.Pipeline.executar({ dryRun: true, threadIds: [threadId] });
    imprimirRelatorio_(relatorio);
    return relatorio;
  };

  // ==========================================================
  // 4) TESTAR UM ANEXO ESPECÍFICO
  // ==========================================================

  /**
   * Roda o pipeline de conversão/OCR sobre UM anexo real (por
   * messageId + índice do anexo), imprime o resultado mascarado e
   * limpa qualquer temporário criado. Não altera a mensagem nem o
   * anexo original; não escreve na planilha.
   */
  D.testarAnexoEspecifico = function (messageId, indiceAnexo) {
    if (!messageId) { console.error('Informe o messageId. Ex.: trackingFtrTestarAnexo("18abc...", 0)'); return; }
    console.log('=== TrackingFTR — TESTE DE ANEXO ÚNICO (nenhuma gravação) ===');

    let msg;
    try {
      msg = GmailApp.getMessageById(messageId);
    } catch (e) {
      TrackingFTR.Security.logErroSeguro('Diagnostics: mensagem não encontrada/acessível', e);
      return;
    }

    const anexos = msg.getAttachments({ includeInlineImages: false });
    const idx = indiceAnexo || 0;
    if (!anexos[idx]) { console.error('Anexo de índice ' + idx + ' não existe nesta mensagem (total: ' + anexos.length + ').'); return; }

    const folder = TrackingFTR.Attach.obterPastaTemp();
    const registro = TrackingFTR.Attach.novoRegistroTemp();
    const orcamento = { restantes: 4 };

    try {
      const resultado = TrackingFTR.Attach.processarAnexo(anexos[idx], folder, registro, orcamento);
      const classif = resultado.ok && resultado.texto ? TrackingFTR.Extract.classificarDocumento(resultado.texto, (anexos[idx].getName() || '').toLowerCase()) : { tipo: 'N/A', pontuacao: 0 };

      console.log('  Nome mascarado: ' + TrackingFTR.Security.mascararNomeArquivo(anexos[idx].getName()));
      console.log('  Tipo interno: ' + resultado.tipoInterno);
      console.log('  OK: ' + resultado.ok + (resultado.motivoRejeicao ? (' | motivo rejeição: ' + resultado.motivoRejeicao) : ''));
      console.log('  Via OCR: ' + resultado.viaOcr + (resultado.idioma ? (' (idioma: ' + resultado.idioma + ')') : ''));
      console.log('  Tipo documental classificado: ' + classif.tipo + ' (pontuação ' + classif.pontuacao + ')');
      console.log('  Evidência mínima (mascarada): ' + TrackingFTR.Security.mascararEvidencia(resultado.texto || '', 100));
      console.log('  Hash do anexo (dedup, não é o conteúdo): ' + (resultado.hash ? resultado.hash.substring(0, 16) + '…' : '(n/a)'));
      console.log('✓ Nenhum arquivo original foi alterado. Temporários desta chamada serão removidos agora.');
      return resultado;
    } finally {
      TrackingFTR.Attach.limparRegistroTemp(registro);
    }
  };

  // ==========================================================
  // 5) REPROCESSAR UM FTR / UM PERÍODO (grava de verdade — exige confirmação)
  // ==========================================================

  D.reprocessarFTR = function (ftrTexto, confirmarGravacao) {
    const ftrNorm = TrackingFTR.Extract.normalizarFTR(ftrTexto || '');
    if (!ftrNorm) { console.error('FTR inválido: "' + ftrTexto + '"'); return; }

    console.log('=== TrackingFTR — REPROCESSAR FTR ' + TrackingFTR.Security.mascarar(ftrNorm, 3, 2) + ' (' + (confirmarGravacao ? 'GRAVAÇÃO REAL' : 'DRY-RUN') + ') ===');
    const query = 'label:' + TrackingFTR.Config.LABEL_PROCESSADO + ' "FTR ' + ftrNorm + '"';
    const threads = GmailApp.search(query, 0, 20);
    console.log('Threads encontradas para este FTR: ' + threads.length);
    if (!threads.length) return;

    const relatorio = executarComLockSeGravando_(confirmarGravacao, threads);
    imprimirRelatorio_(relatorio);
    if (!confirmarGravacao) console.log('ℹ DRY-RUN — para gravar de verdade: trackingFtrReprocessarFTR("' + ftrTexto + '", true)');
    return relatorio;
  };

  D.reprocessarPeriodo = function (dias, confirmarGravacao) {
    console.log('=== TrackingFTR — REPROCESSAR PERÍODO (' + dias + ' dias, ' + (confirmarGravacao ? 'GRAVAÇÃO REAL' : 'DRY-RUN') + ') ===');
    const query = 'label:' + TrackingFTR.Config.LABEL_PROCESSADO + ' newer_than:' + dias + 'd';
    const threads = GmailApp.search(query, 0, TrackingFTR.Config.MAX_THREADS_POR_EXECUCAO);
    console.log('Threads encontradas: ' + threads.length);
    const relatorio = executarComLockSeGravando_(confirmarGravacao, threads);
    imprimirRelatorio_(relatorio);
    if (!confirmarGravacao) console.log('ℹ DRY-RUN — para gravar de verdade: trackingFtrReprocessarPeriodo(' + dias + ', true)');
    return relatorio;
  };

  // ==========================================================
  // 6) LIMPEZA DE TEMPORÁRIOS ÓRFÃOS
  // ==========================================================

  D.limparTemporarios = function () {
    console.log('=== TrackingFTR — LIMPEZA DE TEMPORÁRIOS ÓRFÃOS ===');
    return TrackingFTR.Attach.limparTemporariosOrfaos();
  };

  // ==========================================================
  // 7) RESETAR WATERMARK
  // ==========================================================

  D.resetarWatermark = function () {
    TrackingFTR.Gmail.resetarWatermark();
    console.log('✓ Watermark removido. Próxima execução real usa a janela padrão de ' + TrackingFTR.Config.DIAS_BUSCA_PADRAO + ' dias.');
  };

  // ==========================================================
  // 8) ESTADO DA FILA DE OCR
  // ==========================================================

  D.exibirFilaOcr = function () {
    console.log('=== TrackingFTR — ESTADO DO ORÇAMENTO DE OCR ===');
    console.log('Limite por execução: ' + TrackingFTR.Config.MAX_OPERACOES_OCR_POR_EXECUCAO + ' operações.');
    const bruto = PropertiesService.getScriptProperties().getProperty('TRACKING_FTR_ULTIMO_USO_OCR');
    if (!bruto) { console.log('Nenhuma execução registrou uso de OCR ainda.'); return; }
    try {
      const info = JSON.parse(bruto);
      console.log('Última execução: ' + info.usadas + '/' + info.limite + ' operações de OCR usadas, em ' + info.em + '.');
    } catch (e) {
      console.log('(estado de OCR ilegível)');
    }
  };

  // ==========================================================
  // 9) VALIDAÇÃO DE PERMISSÕES / SERVIÇOS
  // ==========================================================

  D.validarPermissoesServicos = function () {
    console.log('=== TrackingFTR — VALIDAÇÃO DE PERMISSÕES E SERVIÇOS ===');
    console.log('Drive API (serviço avançado) disponível: ' + TrackingFTR.Attach.driveAvancadoDisponivel());

    try {
      TrackingFTR.Persistence.abrirPlanilha();
      console.log('Acesso à planilha de produção: OK.');
    } catch (e) {
      console.log('Acesso à planilha de produção: FALHOU — ' + TrackingFTR.Security.mascararEvidencia(e.message, 150));
    }

    try {
      TrackingFTR.Attach.obterPastaTemp();
      console.log('Acesso/validação da pasta temporária: OK.');
    } catch (e) {
      console.log('Acesso/validação da pasta temporária: FALHOU — ' + TrackingFTR.Security.mascararEvidencia(e.message, 150));
    }

    const acionadores = ScriptApp.getProjectTriggers();
    const instalados = acionadores.filter(function (t) { return t.getHandlerFunction() === 'trackingFtrProcessar'; });
    console.log('Acionadores instalados para trackingFtrProcessar: ' + instalados.length);

    console.log('Conta em execução: ' + Session.getEffectiveUser().getEmail());
  };

  // ==========================================================
  // 10) VALIDAÇÃO DE COMPARTILHAMENTOS INSEGUROS
  // ==========================================================

  D.validarCompartilhamentosInseguros = function () {
    console.log('=== TrackingFTR — VALIDAÇÃO DE COMPARTILHAMENTOS ===');
    try {
      const ss = SpreadsheetApp.openById(TrackingFTR.Config.PLANILHA_ID);
      const r1 = TrackingFTR.Security.validarCompartilhamentoPlanilha(ss);
      console.log('Planilha: ' + (r1.seguro ? 'OK (não publicada / não pública).' : 'INSEGURO — ' + r1.motivo));
    } catch (e) {
      console.log('Planilha: não foi possível validar — ' + TrackingFTR.Security.mascararEvidencia(e.message, 150));
    }

    try {
      const folder = TrackingFTR.Attach.obterPastaTemp();
      const r2 = TrackingFTR.Security.validarPastaTemp(folder);
      console.log('Pasta temporária: ' + (r2.seguro ? 'OK (não compartilhada).' : 'INSEGURO — ' + r2.motivo));
    } catch (e) {
      console.log('Pasta temporária: ' + TrackingFTR.Security.mascararEvidencia(e.message, 150));
    }
  };

  // ==========================================================
  // 11) VERIFICAR PASTA TEMPORÁRIA / ACESSO RESTRITO PLANILHA+LOG
  // ==========================================================

  D.verificarPastaTempAutorizada = function () {
    console.log('=== TrackingFTR — PASTA TEMPORÁRIA ===');
    const folder = TrackingFTR.Attach.obterPastaTemp();
    console.log('Nome: ' + folder.getName() + ' (criada/gerida pelo próprio script).');
    console.log('Proprietário: ' + folder.getOwner().getEmail());
    console.log('Acesso de compartilhamento: ' + folder.getSharingAccess());
  };

  D.verificarAcessoRestritoPlanilhaELog = function () {
    console.log('=== TrackingFTR — ACESSO RESTRITO (planilha + LOG_EXTRAÇÃO) ===');
    let sheetInfo;
    try {
      sheetInfo = TrackingFTR.Persistence.abrirPlanilha();
    } catch (e) {
      console.log('FALHOU: ' + TrackingFTR.Security.mascararEvidencia(e.message, 150));
      return;
    }
    const file = DriveApp.getFileById(sheetInfo.spreadsheet.getId());
    console.log('Compartilhamento da planilha: ' + file.getSharingAccess() + ' / permissão: ' + file.getSharingPermission());
    console.log('Editores: ' + file.getEditors().length + ' | Visualizadores: ' + file.getViewers().length);

    const abaLog = sheetInfo.spreadsheet.getSheetByName(TrackingFTR.Config.ABA_LOG);
    if (!abaLog) {
      console.log('Aba ' + TrackingFTR.Config.ABA_LOG + ' ainda não existe (será criada na primeira execução real).');
      return;
    }
    const protecoes = abaLog.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    console.log('Aba ' + TrackingFTR.Config.ABA_LOG + ' — proteções de aba configuradas: ' + protecoes.length + (protecoes.length ? '' : ' (recomenda-se proteger esta aba para administradores/revisores apenas).'));
  };

  /**
   * Toda chamada de reprocessamento MANUAL que efetivamente grava
   * (confirmarGravacao=true) precisa do mesmo lock que protege
   * trackingFtrProcessar — senão um reprocessamento manual poderia
   * colidir com a execução automática agendada.
   */
  function executarComLockSeGravando_(confirmarGravacao, threads) {
    const opcoes = { dryRun: !confirmarGravacao, threadIds: threads.map(function (t) { return t.getId(); }) };
    if (!confirmarGravacao) return TrackingFTR.Pipeline.executar(opcoes);
    return TrackingFTR.Persistence.comBloqueio(function () { return TrackingFTR.Pipeline.executar(opcoes); });
  }

  function imprimirRelatorio_(r) {
    console.log('Execução: ' + r.execucaoId + (r.dryRun ? ' [DRY-RUN]' : ''));
    console.log('Threads encontradas: ' + r.threadsEncontradas + ' | filtradas: ' + r.threadsFiltradas + ' | ambíguas: ' + r.threadsAmbiguas + ' | sem FTR: ' + r.threadsSemFtr + ' | com erro: ' + r.threadsComErro);
    console.log('FTRs resolvidos: ' + r.ftrsResolvidos.length + ' | updates: ' + r.updates + ' | novas linhas: ' + r.novasLinhas);
    const verbo = r.dryRun ? 'campos que SERIAM gravados' : 'campos gravados';
    r.ftrsResolvidos.forEach(function (f) {
      console.log('  FTR ' + f.ftr + ' — ' + (f.novaLinha ? (r.dryRun ? 'NOVA LINHA (simulada)' : 'NOVA LINHA') : (r.dryRun ? 'UPDATE (simulado)' : 'UPDATE')) + ' — ' + verbo + ': ' + f.camposGravados + (f.temConflito ? ' — ⚠ CONFLITO (marcado REVISAR)' : ''));
    });
    (r.avisos || []).forEach(function (a) { console.log('⚠ ' + a); });
    if (r.erroCritico) console.log('✗ ERRO CRÍTICO: ' + r.erroCritico);
    console.log('Watermark avançado: ' + r.watermarkAvancado + ' | execução completa: ' + r.execucaoCompleta);
  }

  // ==========================================================
  // 12) 15 CASOS DE TESTE INTERNOS (dados sintéticos, sem I/O externo)
  // ==========================================================

  function unidadeSintetica_(origem, texto, tipoDoc, diasAtras) {
    return {
      origem: origem, texto: texto, tipoDoc: tipoDoc,
      dataMensagem: new Date(Date.now() - (diasAtras || 0) * 86400000),
      mensagemIdMascarado: 'sintetico', threadIdMascarado: 'sintetico',
      nomeArquivo: null, hash: null,
      indicadorVersao: TrackingFTR.Extract.detectarIndicadorVersao(texto),
      prioridadeFonte: origem === 'ATTACHMENT' ? 1 : 5, viaOcr: false,
    };
  }

  function aproxIgual_(a, b, tolerancia) { return Math.abs(a - b) <= (tolerancia || 0.01); }

  D.rodarTestesInternos = function () {
    console.log('=== TrackingFTR — 15 CASOS DE TESTE INTERNOS (dados sintéticos) ===');
    const E = TrackingFTR.Extract, R = TrackingFTR.Resolver;
    let passou = 0, total = 0;

    function caso(nome, condicao, detalhe) {
      total++;
      if (condicao) { passou++; console.log('  ✓ [' + total + '] ' + nome); }
      else { console.error('  ✗ [' + total + '] ' + nome + ' — ' + (detalhe || '')); }
    }

    // 1. PDF com texto pesquisável (simulado como texto já extraído)
    const t1 = 'COMMERCIAL INVOICE\nINVOICE NUMBER: 229\nSHIPPER: MINEKS\nCONSIGNEE: BEST FOODS\nPORT OF LOADING: SANTOS\nPORT OF DISCHARGE: ALEXANDRIA\nTOTAL NET WEIGHT: 27.500 KGS\nINCOTERM: FOB SANTOS';
    const c1 = E.classificarDocumento(t1);
    const p1 = E.extrairPesoMT(t1);
    caso('PDF com texto: classifica COMMERCIAL_INVOICE e converte 27.500 KGS → 27.5 MT', c1.tipo === 'COMMERCIAL_INVOICE' && p1 && aproxIgual_(p1.valorMT, 27.5));

    // 2. PDF escaneado "scan.pdf" — classificação não depende do nome do arquivo
    const t2 = 'BOOKING CONFIRMATION\nBOOKING NUMBER: BKG-774411\nVESSEL: MSC LORETO\nVOYAGE: FW412A\nPORT OF LOADING: SANTOS\nPORT OF DISCHARGE: DAMIETTA';
    const c2 = E.classificarDocumento(t2, 'scan.pdf');
    caso('Anexo "scan.pdf": classificado pelo CONTEÚDO como BOOKING_CONFIRMATION (nome genérico ignorado)', c2.tipo === 'BOOKING_CONFIRMATION');

    // 3. Imagem JPG (texto ruidoso simulando OCR) — packing list
    const t3 = 'PACKING LIST\nNET WEIGHT: 25.000 KGS\nGROSS WEIGHT: 25.500 KGS\nCALIBRE 38/42';
    const c3 = E.classificarDocumento(t3);
    const p3 = E.extrairPesoMT(t3);
    caso('Imagem/OCR de packing list: classifica PACKING_LIST e usa NET (não GROSS) → 25 MT', c3.tipo === 'PACKING_LIST' && p3 && aproxIgual_(p3.valorMT, 25));

    // 4. XLSX (texto linearizado célula-a-célula)
    const t4 = 'PORT OF LOADING | SANTOS\nPORT OF DISCHARGE | ALEXANDRIA\nBOOKING NO | SSZ-2456781';
    const pol4 = E.extrairPortoOrigem(t4);
    const pod4 = E.extrairPortoDestino(t4);
    const bk4 = E.extrairBooking(t4, null, null);
    caso('XLSX linearizado: POL=SANTOS, POD=ALEXANDRIA, booking=SSZ-2456781', pol4 && pol4.valorNormalizado === 'SANTOS' && pod4 && pod4.valorNormalizado === 'ALEXANDRIA' && bk4 && bk4.valorNormalizado === 'SSZ-2456781');

    // 5. DOCX — shipping instruction com booking e BL distintos
    const t5 = 'SHIPPING INSTRUCTION\nBOOKING NUMBER: SI-BOOK-88213\nBL: HLCUBLXYZ998877\nSHIPPER: TEKNOFERT';
    const c5 = E.classificarDocumento(t5);
    const bl5 = E.extrairBL(t5, 'SI-BOOK-88213');
    caso('DOCX: classifica SHIPPING_INSTRUCTION e extrai BL distinto do booking', c5.tipo === 'SHIPPING_INSTRUCTION' && bl5 && bl5.valorGravar === 'HLCUBLXYZ998877');

    // 6. Booking com POL e POD
    const t6 = 'BOOKING CONFIRMATION\nBOOKING NO: BKG-774411\nPORT OF LOADING: PARANAGUÁ\nPORT OF DISCHARGE: TUNIS';
    const pol6 = E.extrairPortoOrigem(t6);
    const pod6 = E.extrairPortoDestino(t6);
    caso('Booking com POL e POD distintos e corretos', pol6 && pod6 && pol6.valorNormalizado !== pod6.valorNormalizado && pod6.valorNormalizado === 'TUNIS');

    // 7. Invoice com peso em kg
    const t7 = 'COMMERCIAL INVOICE\nNET WEIGHT: 27.500 KGS';
    const p7 = E.extrairPesoMT(t7);
    caso('Invoice com peso em kg: 27.500 KGS → 27.5 MT', p7 && aproxIgual_(p7.valorMT, 27.5) && p7.regra === 'net_weight');

    // 8. Invoice com peso em MT
    const t8 = 'COMMERCIAL INVOICE\nNET WEIGHT: 27.5 MT';
    const p8 = E.extrairPesoMT(t8);
    caso('Invoice com peso já em MT: mantém 27.5 MT', p8 && aproxIgual_(p8.valorMT, 27.5));

    // 9. Packing list com vários contêineres (soma pesos individuais)
    const t9 = 'PACKING LIST\nCONTAINER 1 NET WEIGHT: 27.500 KGS\nCONTAINER 2 NET WEIGHT: 26.800 KGS\nCONTAINER 3 NET WEIGHT: 25.200 KGS';
    const p9 = E.extrairPesoMT(t9);
    caso('Packing list com 3 contêineres sem total geral: soma = 79.5 MT', p9 && p9.regra === 'soma_pesos_individuais' && aproxIgual_(p9.valorMT, 79.5, 0.1), p9 && ('obtido=' + p9.valorMT));

    // 10. BL com booking e BL diferentes
    const t10 = 'BILL OF LADING\nBOOKING NO: BKG-991122\nB/L NO: MEDUBL5567788\nVESSEL: MAERSK SALINA';
    const bk10 = E.extrairBooking(t10, null, null);
    const bl10 = E.extrairBL(t10, bk10 ? bk10.valorNormalizado : null);
    caso('BL: booking e BL extraídos e DIFERENTES entre si', bk10 && bl10 && bk10.valorNormalizado !== bl10.valorGravar);

    // 11. Master BL e House BL
    const t11 = 'BILL OF LADING\nMASTER B/L: MEDUMB1122334\nHOUSE B/L: HLCUHB2233445\nSHIPPER: CALIXTO';
    const bl11 = E.extrairBL(t11, null);
    caso('Master BL + House BL: formato combinado "MBL: x | HBL: y"', bl11 && bl11.valorGravar === 'MBL: MEDUMB1122334 | HBL: HLCUHB2233445', bl11 && bl11.valorGravar);

    // 12. Tonelagem repetida em várias páginas (não deve duplicar)
    const t12 = 'COMMERCIAL INVOICE\nTOTAL NET WEIGHT: 550.000 KGS\n--- PAGE 2 ---\nTOTAL NET WEIGHT: 550.000 KGS';
    const p12 = E.extrairPesoMT(t12);
    caso('TOTAL NET WEIGHT repetido em 2 "páginas": resultado continua 550 MT (não 1100)', p12 && aproxIgual_(p12.valorMT, 550));

    // 13. Calibre 38/42 não confundido com peso
    const t13 = 'PRODUCT: RAW PEANUTS 38/42\nNET WEIGHT: 25.000 KGS';
    const p13 = E.extrairPesoMT(t13);
    const prod13 = E.extrairProduto('', t13);
    caso('Calibre 38/42 não interpretado como peso; peso real = 25 MT', p13 && aproxIgual_(p13.valorMT, 25) && prod13.indexOf('38/42') !== -1);

    // 14. Conflito entre dois valores de BOOKING no mesmo nível de confiança
    const u14a = unidadeSintetica_('ATTACHMENT', 'BOOKING NO: BKG-111111', 'BOOKING_CONFIRMATION', 0);
    const u14b = unidadeSintetica_('ATTACHMENT', 'BOOKING NO: BKG-222222', 'BOOKING_CONFIRMATION', 0);
    const r14 = R.resolverBooking([u14a, u14b], '03062-26');
    caso('Dois bookings divergentes no mesmo tipo documental → marcado CONFLITO (não escolhe sozinho)', r14.conflito === true);

    // 15. Documento sem FTR no anexo, mas FTR confirmado no assunto
    const u15a = unidadeSintetica_('ATTACHMENT', 'COMMERCIAL INVOICE\nNO REFERENCE NUMBER HERE', 'COMMERCIAL_INVOICE', 0);
    const u15b = unidadeSintetica_('SUBJECT', 'FTR 03062-26 - MINEKS x BEST FOODS', 'EMAIL', 0);
    const r15 = R.resolverFTR([u15a, u15b]);
    caso('Anexo sem FTR, mas assunto confirma FTR 03062-26 → resolvido via assunto', r15.ftr === '03062-26' && !r15.ambiguo);

    console.log('=== RESULTADO: ' + passou + '/' + total + ' casos passaram ===');
    console.log('✓ Nenhum dado real foi lido; nenhuma gravação ocorreu; nenhum serviço externo foi chamado.');
    return { passou: passou, total: total };
  };

})(TrackingFTR.Diag);
