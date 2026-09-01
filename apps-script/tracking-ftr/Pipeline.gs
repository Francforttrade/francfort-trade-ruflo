/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Pipeline.gs
 * ============================================================
 *
 * Orquestração principal: valida o ambiente, busca threads (com
 * watermark), coleta evidências, resolve campos, decide gravação e
 * escreve em lote — respeitando orçamento de tempo/OCR, lock de
 * concorrência e checkpoint/retomada.
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Pipeline = {};

(function (PL, CFG, SEC, G, R, A, P) {

  function criarDedupCache_() {
    const cache = CacheService.getScriptCache();
    return {
      has: function (hash) { try { return !!cache.get(CFG.CACHE_PREFIX_HASH + hash); } catch (e) { return false; } },
      add: function (hash) { try { cache.put(CFG.CACHE_PREFIX_HASH + hash, '1', CFG.CACHE_TTL_HASH_SEGUNDOS); } catch (e) { /* cache indisponível não é fatal */ } },
    };
  }

  function lerCheckpoint_(watermarkAtual) {
    const props = PropertiesService.getScriptProperties();
    const bruto = props.getProperty(CFG.PROP_CHECKPOINT);
    if (!bruto) return { watermarkTs: watermarkAtual, threadsFeitas: [] };
    try {
      const obj = JSON.parse(bruto);
      if (obj.watermarkTs !== watermarkAtual) return { watermarkTs: watermarkAtual, threadsFeitas: [] };
      return obj;
    } catch (e) {
      return { watermarkTs: watermarkAtual, threadsFeitas: [] };
    }
  }

  function salvarCheckpoint_(checkpoint) {
    const MAX_ITENS = 500;
    if (checkpoint.threadsFeitas.length > MAX_ITENS) {
      checkpoint.threadsFeitas = checkpoint.threadsFeitas.slice(-MAX_ITENS);
    }
    PropertiesService.getScriptProperties().setProperty(CFG.PROP_CHECKPOINT, JSON.stringify(checkpoint));
  }

  function limparCheckpoint_() {
    PropertiesService.getScriptProperties().deleteProperty(CFG.PROP_CHECKPOINT);
  }

  /**
   * Monta o objeto de "campos resolvidos" de um FTR a partir das
   * unidades de evidência já coletadas para a thread inteira.
   */
  function resolverCamposDoFtr_(unidades, ftr) {
    const bookingResolvido = R.resolverBooking(unidades, ftr);
    return {
      invoice: R.resolverInvoice(unidades, ftr),
      exportador: R.resolverExportador(unidades),
      importador: null, // preenchido pelo chamador (depende da label do organizador)
      produto: R.resolverProduto(unidades),
      portoOrigem: R.resolverPortoOrigem(unidades),
      portoDestino: R.resolverPortoDestino(unidades),
      placeOfReceipt: R.resolverPlaceOfReceipt(unidades),
      placeOfDelivery: R.resolverPlaceOfDelivery(unidades),
      incoterm: R.resolverIncoterm(unidades),
      safra: R.resolverSafra(unidades),
      mt: R.resolverMT(unidades),
      termoPagamento: R.resolverTermoPagamento(unidades),
      valorUnitario: R.resolverValorUnitario(unidades),
      valorTotal: R.resolverValorTotal(unidades),
      dataEmbarque: R.resolverDataEmbarque(unidades),
      booking: bookingResolvido,
      bl: R.resolverBL(unidades, bookingResolvido),
      etd: R.resolverETD(unidades),
      eta: R.resolverETA(unidades),
      vessel: R.resolverVessel(unidades),
      voyage: R.resolverVoyage(unidades),
      armador: R.resolverArmador(unidades),
      containers: R.resolverContainers(unidades),
    };
  }

  /**
   * Executa o pipeline completo. `opcoes`:
   *   dryRun (bool)            — não grava nada, só devolve o relatório;
   *   maxThreads (number)      — override de CFG.MAX_THREADS_POR_EXECUCAO;
   *   threadIds (string[])     — processa só estas threads (uso em teste);
   *   silencioso (bool)        — suprime logs de progresso (usado por diagnóstico).
   */
  PL.executar = function (opcoes) {
    const opt = opcoes || {};
    const execucaoId = Utilities.getUuid();
    const relatorio = {
      execucaoId: execucaoId, dryRun: !!opt.dryRun, threadsEncontradas: 0, threadsFiltradas: 0,
      threadsAmbiguas: 0, threadsSemFtr: 0, threadsComErro: 0, ftrsResolvidos: [], updates: 0,
      novasLinhas: 0, watermarkAvancado: false, execucaoCompleta: false, avisos: [],
    };

    if (!A.driveAvancadoDisponivel()) {
      relatorio.avisos.push('Serviço avançado "Drive API" não está habilitado — PDFs/imagens escaneados não serão OCRizados nesta execução (ver instruções de ativação).');
      SEC.logWarn('Pipeline: Drive API (serviço avançado) indisponível — degradando sem OCR.');
    }

    let sheetInfo, folder;
    try {
      sheetInfo = P.abrirPlanilha();
      folder = A.obterPastaTemp();
    } catch (e) {
      SEC.logErro('Pipeline: ABORTADO por configuração insegura ou inacessível — ' + SEC.mascararEvidencia(e.message, 200));
      relatorio.erroCritico = 'config_insegura_ou_inacessivel';
      return relatorio;
    }

    const colInfo = SM_mapearColunasSeguro_(sheetInfo.sheet);
    const colMap = colInfo.mapa;
    const ultimaColuna = colInfo.ultimaColunaAposCriacao;
    const indice = P.construirIndice(sheetInfo.sheet, colMap);

    const query = opt.threadIds ? null : G.montarQueryComWatermark();
    const watermarkAtualTs = (G.obterWatermark() || new Date(0)).getTime();
    const checkpoint = lerCheckpoint_(watermarkAtualTs);
    const jaFeitas = new Set(checkpoint.threadsFeitas);

    let threads;
    if (opt.threadIds) {
      threads = opt.threadIds.map(function (id) { return GmailApp.getThreadById(id); }).filter(Boolean);
    } else {
      threads = GmailApp.search(query, 0, opt.maxThreads || CFG.MAX_THREADS_POR_EXECUCAO);
      if (!opt.silencioso) SEC.logInfo('Pipeline: query="' + query + '" — threads=' + threads.length);
      if (threads.length === (opt.maxThreads || CFG.MAX_THREADS_POR_EXECUCAO)) {
        relatorio.avisos.push('Atingiu o limite de threads por execução — pode haver threads fora desta busca. A próxima execução continua a partir do checkpoint.');
      }
    }
    relatorio.threadsEncontradas = threads.length;

    const orcamentoOcr = { restantes: CFG.MAX_OPERACOES_OCR_POR_EXECUCAO };
    const dedupCache = criarDedupCache_();
    const registroTemp = A.novoRegistroTemp();

    const inicioMs = Date.now();
    const limiteMs = (CFG.LIMITE_SEGUNDOS_EXECUCAO - CFG.MARGEM_SEGURANCA_SEGUNDOS) * 1000;

    const acumuladoPorFtr = new Map(); // ftr -> { resultado, unidades }
    let truncado = false;

    try {
      for (let i = 0; i < threads.length; i++) {
        if (Date.now() - inicioMs > limiteMs) { truncado = true; break; }

        const thread = threads[i];
        const threadIdMascarado = SEC.idMascarado(thread.getId());
        if (jaFeitas.has(threadIdMascarado)) continue;

        try {
          const mensagens = thread.getMessages();
          if (!G.threadEhRelevante(thread, mensagens)) {
            relatorio.threadsFiltradas++;
            jaFeitas.add(threadIdMascarado);
            continue;
          }

          const coleta = R.coletarUnidades(thread, mensagens, folder, registroTemp, orcamentoOcr, dedupCache);
          const unidades = coleta.unidades;

          const resolucaoFtr = R.resolverFTR(unidades);
          if (resolucaoFtr.ambiguo) {
            relatorio.threadsAmbiguas++;
            SEC.logWarn('Pipeline: thread ' + SEC.mascarar(threadIdMascarado, 4, 4) + ' com FTR ambíguo — não associada. ' + resolucaoFtr.motivo);
            jaFeitas.add(threadIdMascarado);
            continue;
          }
          if (!resolucaoFtr.ftr) {
            relatorio.threadsSemFtr++;
            jaFeitas.add(threadIdMascarado);
            continue;
          }

          const ftr = resolucaoFtr.ftr;
          const labelsCliente = G.obterLabelsCliente(thread);
          const clienteDaLabel = G.extrairNomeClienteDeLabels(labelsCliente);

          const campos = resolverCamposDoFtr_(unidades, ftr);
          campos.importador = R.resolverImportador(unidades, TrackingFTR.Extract.aplicarNomeCanonico(clienteDaLabel));
          if (campos.exportador && campos.exportador.vencedor) {
            campos.exportador.vencedor.valorNormalizado = TrackingFTR.Extract.aplicarNomeCanonico(campos.exportador.vencedor.valorNormalizado);
          }

          const dataMaisRecente = mensagens[mensagens.length - 1] ? mensagens.reduce(function (max, m) { return m.getDate() > max ? m.getDate() : max; }, new Date(0)) : new Date();

          const resultado = { ftr: ftr, dataObj: dataMaisRecente, campos: campos, anexosProcessados: coleta.anexosProcessados };

          const previo = acumuladoPorFtr.get(ftr);
          if (!previo || dataMaisRecente > previo.resultado.dataObj) {
            acumuladoPorFtr.set(ftr, { resultado: resultado });
          }

          jaFeitas.add(threadIdMascarado);
        } catch (eThread) {
          relatorio.threadsComErro++;
          SEC.logErroSeguro('Pipeline: erro processando thread', eThread);
          jaFeitas.add(threadIdMascarado); // evita loop infinito reprocessando uma thread quebrada
        }
      }
    } finally {
      A.limparRegistroTemp(registroTemp);
      try {
        PropertiesService.getScriptProperties().setProperty('TRACKING_FTR_ULTIMO_USO_OCR', JSON.stringify({
          usadas: CFG.MAX_OPERACOES_OCR_POR_EXECUCAO - orcamentoOcr.restantes,
          limite: CFG.MAX_OPERACOES_OCR_POR_EXECUCAO,
          em: new Date().toISOString(),
        }));
      } catch (eProp) { /* não crítico */ }
    }

    // ------------------------------------------------------------
    // Gravação (pulada inteiramente em dry-run)
    // ------------------------------------------------------------
    const todasLogEntradas = [];
    for (const [ftr, item] of acumuladoPorFtr) {
      const resultado = item.resultado;
      const linhaExistente = indice.porFtr.get(ftr);
      const ultimaColunaAtual = Math.max(ultimaColuna, sheetInfo.sheet.getLastColumn());

      // Ler a linha atual é seguro mesmo em dry-run (leitura não é
      // gravação) e deixa o relatório de simulação fiel ao que uma
      // execução real decidiria (célula já preenchida x vazia).
      const valoresAtuais = linhaExistente
        ? sheetInfo.sheet.getRange(linhaExistente, 1, 1, ultimaColunaAtual).getValues()[0]
        : new Array(ultimaColunaAtual).fill('');

      const montado = P.montarAtualizacao(resultado, colMap, indice, valoresAtuais, execucaoId);
      todasLogEntradas.push.apply(todasLogEntradas, montado.logEntradas);

      relatorio.ftrsResolvidos.push({
        ftr: SEC.mascarar(ftr, 3, 2), novaLinha: !linhaExistente, temConflito: montado.temConflito,
        algumaGravacao: montado.algumaGravacao, camposGravados: Object.keys(montado.valoresPorColuna).length,
      });

      if (opt.dryRun) continue;

      if (linhaExistente) {
        const mudou = P.aplicarNaLinha(sheetInfo.sheet, linhaExistente, ultimaColunaAtual, montado.valoresPorColuna);
        if (mudou) relatorio.updates++;
      } else {
        const novaLinha = P.adicionarNovaLinha(sheetInfo.sheet, ultimaColunaAtual, colMap, montado.valoresPorColuna, TrackingFTR.Extract.formatarFTRParaGravar(ftr));
        indice.porFtr.set(ftr, novaLinha);
        relatorio.novasLinhas++;
      }

      // Atualiza o índice em memória para pegar colisões dentro da MESMA execução.
      if (colMap.BOOKING && montado.valoresPorColuna[colMap.BOOKING]) {
        indice.porBooking.set(montado.valoresPorColuna[colMap.BOOKING].valor.toString().toUpperCase(), { linha: linhaExistente || sheetInfo.sheet.getLastRow(), ftr: ftr });
      }
      if (colMap.BL && montado.valoresPorColuna[colMap.BL]) {
        indice.porBl.set(montado.valoresPorColuna[colMap.BL].valor.toString().toUpperCase(), { linha: linhaExistente || sheetInfo.sheet.getLastRow(), ftr: ftr });
      }
    }

    if (!opt.dryRun && todasLogEntradas.length) {
      const abaLog = P.abrirOuCriarAbaLog(sheetInfo.spreadsheet);
      P.gravarLog(abaLog, todasLogEntradas);
    }

    relatorio.execucaoCompleta = !truncado;
    if (!opt.dryRun) {
      if (!truncado && !opt.threadIds) {
        limparCheckpoint_();
        G.salvarWatermark(new Date());
        relatorio.watermarkAvancado = true;
      } else if (!opt.threadIds) {
        salvarCheckpoint_({ watermarkTs: watermarkAtualTs, threadsFeitas: Array.from(jaFeitas) });
        relatorio.avisos.push('Execução truncada por tempo — watermark NÃO avançado; checkpoint salvo para retomada na próxima execução.');
      }
    }

    return relatorio;
  };

  function SM_mapearColunasSeguro_(sheet) {
    return TrackingFTR.SheetMap.mapearColunas(sheet);
  }

})(TrackingFTR.Pipeline, TrackingFTR.Config, TrackingFTR.Security, TrackingFTR.Gmail, TrackingFTR.Resolver, TrackingFTR.Attach, TrackingFTR.Persistence);
