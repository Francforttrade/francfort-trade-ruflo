/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Persistence.gs
 * ============================================================
 *
 * Abertura segura da planilha, índice de FTRs/booking/BL já
 * gravados, política de "quando gravar x quando mandar pra REVISAR",
 * escrita em lote, LockService (item 17: nenhuma execução concorrente
 * grava os mesmos dados) e a aba LOG_EXTRAÇÃO (auditoria restrita,
 * sem conteúdo integral).
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Persistence = {};

(function (P) {

  // ==========================================================
  // ABERTURA DA PLANILHA (com validação de compartilhamento)
  // ==========================================================

  P.abrirPlanilha = function () {
    const ss = SpreadsheetApp.openById(TrackingFTR.Config.PLANILHA_ID);

    const validacao = TrackingFTR.Security.validarCompartilhamentoPlanilha(ss);
    if (!validacao.seguro) {
      throw new Error('CONFIG_INSEGURA: ' + validacao.motivo);
    }

    const sheet = ss.getSheetByName(TrackingFTR.Config.PLANILHA_ABA);
    if (!sheet) {
      const nomes = ss.getSheets().map(function (s) { return s.getName(); }).join(', ');
      throw new Error('Aba "' + TrackingFTR.Config.PLANILHA_ABA + '" não encontrada. Disponíveis: ' + nomes);
    }
    return { spreadsheet: ss, sheet: sheet };
  };

  P.abrirOuCriarAbaLog = function (spreadsheet) {
    let aba = spreadsheet.getSheetByName(TrackingFTR.Config.ABA_LOG);
    const cabecalho = [
      'DATA_HORA', 'EXECUCAO_ID', 'FTR_MASCARADO', 'CAMPO', 'VALOR_ANTERIOR_MASCARADO',
      'VALOR_NOVO_MASCARADO', 'TIPO_DOCUMENTO', 'ARQUIVO_MASCARADO', 'MSG_ID_MASCARADO',
      'THREAD_ID_MASCARADO', 'EVIDENCIA_MINIMA', 'CONFIANCA', 'RESULTADO', 'MOTIVO',
      'HASH_ANEXO', 'ERRO_TECNICO', 'VERSAO_DOCUMENTO', 'REGRA_EXTRACAO', 'SENSIBILIDADE',
      'RETENCAO_ATE',
    ];
    if (!aba) {
      aba = spreadsheet.insertSheet(TrackingFTR.Config.ABA_LOG);
      aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
      aba.setFrozenRows(1);
      TrackingFTR.Security.logInfo('Persistence: aba ' + TrackingFTR.Config.ABA_LOG + ' criada. Restrinja o acesso a administradores/revisores autorizados.');
    }
    return aba;
  };

  // ==========================================================
  // ÍNDICE DE FTRs / BOOKING / BL JÁ GRAVADOS
  // ==========================================================

  P.construirIndice = function (sheet, colMap) {
    const indice = { porFtr: new Map(), porBooking: new Map(), porBl: new Map() };
    const ultimaLinha = sheet.getLastRow();
    if (ultimaLinha < TrackingFTR.Config.LINHA_INICIAL) return indice;

    const nCols = Math.max.apply(null, Object.values(colMap).filter(Boolean).concat([1]));
    const valores = sheet.getRange(TrackingFTR.Config.LINHA_INICIAL, 1, ultimaLinha - TrackingFTR.Config.LINHA_INICIAL + 1, nCols).getValues();

    valores.forEach(function (linha, i) {
      const numeroLinha = TrackingFTR.Config.LINHA_INICIAL + i;
      const ftrCel = colMap.FTR ? (linha[colMap.FTR - 1] || '').toString().trim() : '';
      if (ftrCel) {
        const ftrNorm = TrackingFTR.Extract.normalizarFTR(ftrCel);
        if (ftrNorm) indice.porFtr.set(ftrNorm, numeroLinha);
      }
      if (colMap.BOOKING) {
        const v = (linha[colMap.BOOKING - 1] || '').toString().trim().toUpperCase();
        if (v) indice.porBooking.set(v, { linha: numeroLinha, ftr: ftrCel });
      }
      if (colMap.BL) {
        const v = (linha[colMap.BL - 1] || '').toString().trim().toUpperCase();
        if (v) indice.porBl.set(v, { linha: numeroLinha, ftr: ftrCel });
      }
    });

    return indice;
  };

  // ==========================================================
  // LOCK (item 17: impede execução concorrente sobre os mesmos dados)
  // ==========================================================

  P.comBloqueio = function (fn) {
    const lock = LockService.getScriptLock();
    const obtido = lock.tryLock(TrackingFTR.Config.LOCK_TIMEOUT_MS);
    if (!obtido) {
      throw new Error('LOCK_OCUPADO: outra execução do TrackingFTR está em andamento. Esta execução foi abortada com segurança sem gravar nada.');
    }
    try {
      return fn();
    } finally {
      lock.releaseLock();
    }
  };

  // ==========================================================
  // POLÍTICA DE GRAVAÇÃO POR CAMPO
  // ==========================================================

  /**
   * Decide se um campo resolvido deve ser gravado por cima do valor
   * atual da célula. Nunca apaga valor existente com vazio; nunca
   * troca ALTA/confirmado por BAIXA; só substitui valor já preenchido
   * quando o novo candidato é de confiança ALTA ou representa uma
   * versão documental mais nova e explícita (amendment/revised/final)
   * de uma mensagem mais recente.
   */
  function decidirGravacao_(valorAtualCelula, campoResolvido) {
    if (!campoResolvido || !campoResolvido.vencedor) return { gravar: false, motivo: 'sem_candidato' };
    if (campoResolvido.conflito) return { gravar: false, motivo: 'conflito' };

    const v = campoResolvido.vencedor;
    if (v.confianca === 'BAIXA') return { gravar: false, motivo: 'confianca_baixa' };

    const atualVazio = valorAtualCelula === '' || valorAtualCelula === null || valorAtualCelula === undefined;
    if (atualVazio) return { gravar: true, motivo: 'celula_vazia' };

    if (v.confianca === 'ALTA') return { gravar: true, motivo: 'confianca_alta' };

    if (v.indicadorVersao && v.indicadorVersao !== 'ORIGINAL') {
      return { gravar: true, motivo: 'nova_versao:' + v.indicadorVersao };
    }

    return { gravar: false, motivo: 'mantido_valor_existente' };
  }

  /** Colisão transversal (item 15): mesmo booking/BL já associado a outro FTR. */
  function detectarColisaoTransversal_(indice, chave, valorNormalizado, ftrAtual) {
    const mapa = chave === 'BOOKING' ? indice.porBooking : (chave === 'BL' ? indice.porBl : null);
    if (!mapa || !valorNormalizado) return null;
    const existente = mapa.get(valorNormalizado.toUpperCase());
    if (existente && existente.ftr && TrackingFTR.Extract.normalizarFTR(existente.ftr) !== ftrAtual) {
      return existente;
    }
    return null;
  }

  // ==========================================================
  // MONTAGEM DA LINHA A PARTIR DO RESULTADO DO RESOLVER
  // ==========================================================

  /**
   * `resultado` é o objeto produzido em Pipeline.gs a partir de
   * Resolver.gs: { ftr, camposResolvidos: {chave: resultadoResolverCampo}, dataObj, ... }
   * Retorna { valoresPorColuna: {coluna: valor}, logEntradas: [...], statusExtracao, temConflito }
   */
  P.montarAtualizacao = function (resultado, colMap, indice, valoresAtuais, execucaoId) {
    const valoresPorColuna = {};
    const logEntradas = [];
    let temConflito = false;
    let algumaGravacao = false;

    const CAMPOS_SIMPLES = [
      ['INVOICE', 'invoice'], ['EXPORTADOR', 'exportador'], ['IMPORTADOR', 'importador'],
      ['PRODUTO', 'produto'], ['PORTO_ORIGEM', 'portoOrigem'], ['POD', 'portoDestino'],
      ['INCOTERM', 'incoterm'], ['SAFRA', 'safra'], ['TERMO_PAGAMENTO', 'termoPagamento'],
      ['VALOR_UNIT', 'valorUnitario'], ['VALOR_TOTAL', 'valorTotal'], ['DATA_EMBARQUE', 'dataEmbarque'],
      ['BOOKING', 'booking'], ['BL', 'bl'], ['ETD', 'etd'], ['ETA', 'eta'], ['NAVIO', 'vessel'],
      ['VOYAGE', 'voyage'], ['ARMADOR', 'armador'], ['PLACE_OF_RECEIPT', 'placeOfReceipt'],
      ['PLACE_OF_DELIVERY', 'placeOfDelivery'],
    ];

    CAMPOS_SIMPLES.forEach(function (par) {
      const chaveColuna = par[0], chaveResultado = par[1];
      const coluna = colMap[chaveColuna];
      if (!coluna) return; // coluna não existe na planilha — não criamos além de PORTO ORIGEM/BL
      const campoResolvido = resultado.campos[chaveResultado];
      if (!campoResolvido) return;

      if (campoResolvido.conflito) {
        temConflito = true;
        logEntradas.push(montarLogEntrada_(execucaoId, resultado.ftr, chaveColuna, valoresAtuais[coluna - 1], '(conflito — não gravado)', campoResolvido.candidatos, 'CONFLITO', 'valores_conflitantes'));
        return;
      }
      if (!campoResolvido.vencedor) return;

      if ((chaveColuna === 'BOOKING' || chaveColuna === 'BL') && indice) {
        const colisao = detectarColisaoTransversal_(indice, chaveColuna, campoResolvido.vencedor.valorNormalizado, resultado.ftr);
        if (colisao) {
          temConflito = true;
          logEntradas.push(montarLogEntrada_(execucaoId, resultado.ftr, chaveColuna, valoresAtuais[coluna - 1], TrackingFTR.Security.mascarar(campoResolvido.vencedor.valorNormalizado), [campoResolvido.vencedor], 'CONFLITO', 'colisao_transversal_outro_ftr:' + TrackingFTR.Security.mascarar(colisao.ftr, 3, 2)));
          return;
        }
      }

      const decisao = decidirGravacao_(valoresAtuais[coluna - 1], campoResolvido);
      const entradaLog = montarLogEntrada_(
        execucaoId, resultado.ftr, chaveColuna, valoresAtuais[coluna - 1],
        decisao.gravar ? campoResolvido.vencedor.valorNormalizado : '(não gravado)',
        [campoResolvido.vencedor], decisao.gravar ? 'GRAVADO' : 'REJEITADO', decisao.motivo
      );
      logEntradas.push(entradaLog);

      if (decisao.gravar) {
        valoresPorColuna[coluna] = { valor: campoResolvido.vencedor.valorNormalizado, forcarTexto: (chaveColuna === 'BOOKING' || chaveColuna === 'BL') };
        algumaGravacao = true;
      }
    });

    if (colMap.MT && resultado.campos.mt) {
      const campoMt = resultado.campos.mt;
      if (campoMt.conflito) {
        temConflito = true;
        logEntradas.push(montarLogEntrada_(execucaoId, resultado.ftr, 'MT', valoresAtuais[colMap.MT - 1], '(conflito — não gravado)', campoMt.candidatos, 'CONFLITO', 'valores_conflitantes'));
      } else if (campoMt.vencedor) {
        const decisao = decidirGravacao_(valoresAtuais[colMap.MT - 1], campoMt);
        logEntradas.push(montarLogEntrada_(execucaoId, resultado.ftr, 'MT', valoresAtuais[colMap.MT - 1], decisao.gravar ? campoMt.vencedor.valorNormalizado + ' MT' : '(não gravado)', [campoMt.vencedor], decisao.gravar ? 'GRAVADO' : 'REJEITADO', decisao.motivo));
        if (decisao.gravar) { valoresPorColuna[colMap.MT] = { valor: campoMt.vencedor.valorNormalizado }; algumaGravacao = true; }
      }
    }

    if (colMap.CONTAINERS_QTD && resultado.campos.containers && resultado.campos.containers.vencedor) {
      const v = resultado.campos.containers.vencedor;
      if (v.quantidade) { valoresPorColuna[colMap.CONTAINERS_QTD] = { valor: v.quantidade }; algumaGravacao = true; }
      if (colMap.CONTAINERS_NUMS && v.numeros && v.numeros.length) {
        valoresPorColuna[colMap.CONTAINERS_NUMS] = { valor: v.numeros.join(', '), forcarTexto: true };
        algumaGravacao = true;
      }
    }

    if (colMap.DATA && resultado.dataObj) {
      valoresPorColuna[colMap.DATA] = { valor: resultado.dataObj, ehData: true };
    }

    if (colMap.STATUS_EXTRACAO) {
      valoresPorColuna[colMap.STATUS_EXTRACAO] = { valor: temConflito ? TrackingFTR.Config.MARCADOR_REVISAR : 'OK' };
    }
    if (colMap.AUTO_SYNC && algumaGravacao) {
      valoresPorColuna[colMap.AUTO_SYNC] = { valor: TrackingFTR.Config.MARCADOR_AUTO_SYNC };
    }

    return { valoresPorColuna: valoresPorColuna, logEntradas: logEntradas, temConflito: temConflito, algumaGravacao: algumaGravacao };
  };

  function montarLogEntrada_(execucaoId, ftr, campo, valorAnterior, valorNovo, candidatosUsados, resultadoTxt, motivo) {
    const principal = candidatosUsados && candidatosUsados[0];
    return {
      execucaoId: execucaoId,
      ftrMascarado: TrackingFTR.Security.mascarar(ftr, 3, 2),
      campo: campo,
      valorAnteriorMascarado: TrackingFTR.Security.mascarar((valorAnterior || '').toString(), 2, 2),
      valorNovoMascarado: TrackingFTR.Security.mascarar((valorNovo || '').toString(), 2, 2),
      tipoDocumento: principal ? principal.tipoDoc : '',
      arquivoMascarado: principal ? (principal.nomeArquivo || '(fonte email)') : '',
      msgIdMascarado: principal ? principal.mensagemIdMascarado : '',
      threadIdMascarado: principal ? principal.threadIdMascarado : '',
      evidenciaMinima: principal ? principal.evidencia : '',
      confianca: principal ? (principal.confianca || '') : '',
      resultado: resultadoTxt,
      motivo: motivo,
      hashAnexo: principal && principal.hash ? principal.hash.substring(0, 16) : '',
      erroTecnico: '',
      versaoDocumento: principal ? principal.indicadorVersao : '',
      regraExtracao: principal ? principal.regraExtracao : '',
      sensibilidade: (campo === 'VALOR_UNIT' || campo === 'VALOR_TOTAL') ? 'COMERCIAL' : 'OPERACIONAL',
    };
  }

  // ==========================================================
  // ESCRITA EM LOTE
  // ==========================================================

  P.aplicarNaLinha = function (sheet, linha, ultimaColuna, valoresPorColuna) {
    if (!Object.keys(valoresPorColuna).length) return false;
    const range = sheet.getRange(linha, 1, 1, ultimaColuna);
    const atuais = range.getValues()[0];
    let mudou = false;

    Object.keys(valoresPorColuna).forEach(function (colStr) {
      const col = parseInt(colStr, 10);
      const info = valoresPorColuna[col];
      const idx = col - 1;
      const novo = info.ehData ? info.valor : TrackingFTR.SheetMap.escaparValorPerigoso(info.valor);
      if (atuais[idx] !== novo && !(info.ehData && atuais[idx] instanceof Date && Math.abs(atuais[idx].getTime() - info.valor.getTime()) < 60000)) {
        atuais[idx] = novo;
        mudou = true;
      }
    });

    if (!mudou) return false;
    range.setValues([atuais]);

    Object.keys(valoresPorColuna).forEach(function (colStr) {
      const col = parseInt(colStr, 10);
      const info = valoresPorColuna[col];
      if (info.forcarTexto) sheet.getRange(linha, col).setNumberFormat('@');
      if (info.ehData) sheet.getRange(linha, col).setNumberFormat('dd/mm/yyyy hh:mm');
    });
    return true;
  };

  P.adicionarNovaLinha = function (sheet, ultimaColuna, colMap, valoresPorColuna, ftrFormatado) {
    const linhaArr = new Array(ultimaColuna).fill('');
    if (colMap.FTR) linhaArr[colMap.FTR - 1] = ftrFormatado;

    Object.keys(valoresPorColuna).forEach(function (colStr) {
      const col = parseInt(colStr, 10);
      const info = valoresPorColuna[col];
      linhaArr[col - 1] = info.ehData ? info.valor : TrackingFTR.SheetMap.escaparValorPerigoso(info.valor);
    });

    const linhaDestino = sheet.getLastRow() + 1;
    sheet.getRange(linhaDestino, 1, 1, ultimaColuna).setValues([linhaArr]);

    Object.keys(valoresPorColuna).forEach(function (colStr) {
      const col = parseInt(colStr, 10);
      const info = valoresPorColuna[col];
      if (info.forcarTexto) sheet.getRange(linhaDestino, col).setNumberFormat('@');
      if (info.ehData) sheet.getRange(linhaDestino, col).setNumberFormat('dd/mm/yyyy hh:mm');
    });
    if (colMap.FTR) sheet.getRange(linhaDestino, colMap.FTR).setNumberFormat('@');

    return linhaDestino;
  };

  P.gravarLog = function (abaLog, entradas) {
    if (!entradas || !entradas.length) return;
    const linhas = entradas.map(function (e) {
      return [
        new Date(), e.execucaoId, e.ftrMascarado, e.campo, e.valorAnteriorMascarado, e.valorNovoMascarado,
        e.tipoDocumento, e.arquivoMascarado, e.msgIdMascarado, e.threadIdMascarado, e.evidenciaMinima,
        e.confianca, e.resultado, e.motivo, e.hashAnexo, e.erroTecnico, e.versaoDocumento, e.regraExtracao,
        e.sensibilidade, calcularDataRetencao_(),
      ];
    });
    const inicio = abaLog.getLastRow() + 1;
    abaLog.getRange(inicio, 1, linhas.length, linhas[0].length).setValues(linhas);
  };

  function calcularDataRetencao_() {
    return new Date(Date.now() + TrackingFTR.Config.RETENCAO_LOG_DIAS * 24 * 60 * 60 * 1000);
  }

  /** Remove linhas do log cuja data de retenção já passou (item 18). */
  P.aplicarRetencaoLog = function (abaLog) {
    const ultimaLinha = abaLog.getLastRow();
    if (ultimaLinha < 2) return 0;
    const dados = abaLog.getRange(2, 1, ultimaLinha - 1, 20).getValues();
    const agora = Date.now();
    let removidas = 0;
    for (let i = dados.length - 1; i >= 0; i--) {
      const retencaoAte = dados[i][19];
      if (retencaoAte instanceof Date && retencaoAte.getTime() < agora) {
        abaLog.deleteRow(2 + i);
        removidas++;
      }
    }
    return removidas;
  };

})(TrackingFTR.Persistence);
