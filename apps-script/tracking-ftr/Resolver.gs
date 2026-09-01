/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Resolver.gs
 * ============================================================
 *
 * Junta as fontes de uma thread (anexos, corpo, assunto, tabelas,
 * labels, histórico) em "unidades de evidência" ordenadas por
 * prioridade (item 3 do briefing), roda os extratores de Extraction.gs
 * sobre cada uma, e decide o valor vencedor por campo aplicando a
 * hierarquia de confiança do item 13. Nunca escolhe silenciosamente
 * quando há conflito relevante — apenas marca e devolve os dois lados.
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Resolver = {};

(function (R, CFG, SEC, E) {

  const PRIORIDADE_FONTE = { ATTACHMENT: 1, BODY_PLAIN: 3, BODY_HTML: 4, BODY_TABLE: 4, SUBJECT: 5, LABEL: 6, HISTORICO: 7 };

  // ==========================================================
  // COLETA DE UNIDADES DE EVIDÊNCIA DE UMA THREAD
  // ==========================================================

  /**
   * `orcamentoOcr` é um objeto mutável { restantes: N } compartilhado
   * entre threads da mesma execução — controla o teto de operações de
   * OCR por execução (item 20).
   */
  R.coletarUnidades = function (thread, mensagens, folder, registroTemp, orcamentoOcr, cacheHashes) {
    const unidades = [];
    const anexosProcessados = [];
    const threadIdMascarado = SEC.idMascarado(thread.getId());

    const ordenadas = mensagens.slice().sort(function (a, b) { return b.getDate() - a.getDate(); });

    ordenadas.forEach(function (msg, idxMsg) {
      const info = TrackingFTR.Gmail.coletarBlocosDeMensagem(msg);
      const ehRecente = idxMsg === 0;
      const msgIdMascarado = SEC.idMascarado(msg.getId());

      info.blocos.forEach(function (bloco) {
        unidades.push({
          origem: bloco.origem,
          texto: bloco.texto,
          tipoDoc: 'EMAIL',
          dataMensagem: info.dataObj,
          mensagemIdMascarado: msgIdMascarado,
          threadIdMascarado: threadIdMascarado,
          nomeArquivo: null,
          hash: null,
          prioridadeFonte: ehRecente ? PRIORIDADE_FONTE[bloco.origem] : PRIORIDADE_FONTE.HISTORICO,
          indicadorVersao: E.detectarIndicadorVersao(bloco.texto),
        });
      });

      const anexos = msg.getAttachments({ includeInlineImages: false }).slice(0, CFG.MAX_ANEXOS_POR_THREAD);
      anexos.forEach(function (att) {
        const nomeMascarado = SEC.mascararNomeArquivo(att.getName());
        let resultado;
        try {
          resultado = TrackingFTR.Attach.processarAnexo(att, folder, registroTemp, orcamentoOcr);
        } catch (e) {
          SEC.logErroSeguro('Resolver: falha inesperada processando anexo', e);
          resultado = { ok: false, motivoRejeicao: 'erro_inesperado', tipoInterno: null, hash: null, texto: '', viaOcr: false, idioma: null };
        }

        const jaProcessado = resultado.hash && cacheHashes && cacheHashes.has(resultado.hash);
        anexosProcessados.push({
          nomeMascarado: nomeMascarado, ok: resultado.ok, motivoRejeicao: resultado.motivoRejeicao,
          tipoInterno: resultado.tipoInterno, hash: resultado.hash, viaOcr: resultado.viaOcr,
          idioma: resultado.idioma, duplicado: !!jaProcessado,
        });

        if (!resultado.ok || !resultado.texto || jaProcessado) return;
        if (cacheHashes && resultado.hash) cacheHashes.add(resultado.hash);

        const classif = E.classificarDocumento(resultado.texto, (att.getName() || '').toLowerCase());
        unidades.push({
          origem: 'ATTACHMENT',
          texto: resultado.texto,
          tipoDoc: classif.tipo,
          dataMensagem: info.dataObj,
          mensagemIdMascarado: msgIdMascarado,
          threadIdMascarado: threadIdMascarado,
          nomeArquivo: nomeMascarado,
          hash: resultado.hash,
          prioridadeFonte: ehRecente ? PRIORIDADE_FONTE.ATTACHMENT : PRIORIDADE_FONTE.HISTORICO,
          indicadorVersao: E.detectarIndicadorVersao(resultado.texto),
          viaOcr: resultado.viaOcr,
        });
      });
    });

    TrackingFTR.Gmail.obterLabelsCliente(thread).forEach(function (label) {
      unidades.push({
        origem: 'LABEL', texto: label, tipoDoc: 'LABEL', dataMensagem: ordenadas[0].getDate(),
        mensagemIdMascarado: null, threadIdMascarado: threadIdMascarado, nomeArquivo: null, hash: null,
        prioridadeFonte: PRIORIDADE_FONTE.LABEL, indicadorVersao: 'ORIGINAL',
      });
    });

    return { unidades: unidades, anexosProcessados: anexosProcessados };
  };

  // ==========================================================
  // RESOLUÇÃO DE FTR (item 8 — prioridade específica, não a genérica)
  // ==========================================================

  const ORDEM_PRIORIDADE_FTR = ['ATTACHMENT', 'SUBJECT', 'BODY_PLAIN', 'BODY_HTML', 'BODY_TABLE', 'LABEL'];

  R.resolverFTR = function (unidades) {
    for (let i = 0; i < ORDEM_PRIORIDADE_FTR.length; i++) {
      const origem = ORDEM_PRIORIDADE_FTR[i];
      const doOrigem = unidades.filter(function (u) { return u.origem === origem; });
      const vistos = new Map(); // ftr -> unidade
      doOrigem.forEach(function (u) {
        E.extrairCandidatosFTR(u.texto).forEach(function (ftr) {
          if (!vistos.has(ftr)) vistos.set(ftr, u);
        });
      });
      if (vistos.size === 1) {
        const ftr = Array.from(vistos.keys())[0];
        return { ftr: ftr, ambiguo: false, regra: 'origem:' + origem, evidencia: SEC.mascararEvidencia(vistos.get(ftr).texto.substring(0, 120)) };
      }
      if (vistos.size > 1) {
        return { ftr: null, ambiguo: true, motivo: 'Múltiplos FTRs candidatos em ' + origem + ': ' + Array.from(vistos.keys()).map(function (f) { return SEC.mascarar(f, 3, 2); }).join(', ') };
      }
    }
    return { ftr: null, ambiguo: false, motivo: 'nenhum_ftr_identificado' };
  };

  // ==========================================================
  // RESOLUÇÃO GENÉRICA DE CAMPO
  // ==========================================================

  function rankDocType_(tipoDoc, hierarquia) {
    if (!hierarquia) return null;
    const idx = hierarquia.indexOf(tipoDoc);
    if (idx !== -1) return idx;
    return hierarquia.length; // tipo não mapeado (ex.: NAO_IDENTIFICADO) fica atrás de EMAIL
  }

  function bucketConfianca_(rank, conflito, viaOcrDeBaixaQualidade) {
    if (conflito) return 'CONFLITO';
    if (rank === 0) return viaOcrDeBaixaQualidade ? 'MEDIA' : 'ALTA';
    if (rank <= 2) return 'MEDIA';
    return 'BAIXA';
  }

  /**
   * `extratorAdaptado(unidade)` deve devolver `{valorBruto, valorNormalizado,
   * regra, evidencia}` ou null. `hierarquia` é um array de tipos
   * documentais (CFG.HIERARQUIA_CONFIANCA[...]) ou null (usa
   * prioridadeFonte genérica).
   */
  function resolverCampo_(unidades, extratorAdaptado, hierarquia, igualdade) {
    const candidatos = [];
    unidades.forEach(function (u) {
      if (u.origem === 'LABEL') return; // labels não carregam esses campos
      let r;
      try { r = extratorAdaptado(u); } catch (e) { r = null; }
      if (!r || !r.valorNormalizado) return;
      const rank = hierarquia ? rankDocType_(u.tipoDoc, hierarquia) : u.prioridadeFonte;
      candidatos.push({
        valorBruto: r.valorBruto, valorNormalizado: r.valorNormalizado, regraExtracao: r.regra,
        evidencia: r.evidencia, rank: rank, origem: u.origem, tipoDoc: u.tipoDoc,
        dataMensagem: u.dataMensagem, mensagemIdMascarado: u.mensagemIdMascarado,
        threadIdMascarado: u.threadIdMascarado, nomeArquivo: u.nomeArquivo, hash: u.hash,
        indicadorVersao: u.indicadorVersao, viaOcr: u.viaOcr || false,
      });
    });

    if (!candidatos.length) return { vencedor: null, conflito: false, candidatos: [] };

    candidatos.sort(function (a, b) {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.dataMensagem - a.dataMensagem;
    });

    const igual = igualdade || function (a, b) { return a === b; };
    const melhorRank = candidatos[0].rank;
    const doTopo = candidatos.filter(function (c) { return c.rank === melhorRank; });
    const valoresDistintos = [];
    doTopo.forEach(function (c) {
      if (!valoresDistintos.some(function (v) { return igual(v, c.valorNormalizado); })) valoresDistintos.push(c.valorNormalizado);
    });

    const conflito = valoresDistintos.length > 1;
    const vencedor = candidatos[0];
    vencedor.confianca = bucketConfianca_(vencedor.rank, conflito, vencedor.viaOcr && !hierarquia);

    return { vencedor: vencedor, conflito: conflito, candidatos: conflito ? doTopo : [vencedor] };
  }

  // ==========================================================
  // ADAPTADORES POR CAMPO
  // ==========================================================

  function adaptador_(fn) {
    return function (u) {
      const r = fn(u.texto);
      if (!r) return null;
      return { valorBruto: r.valorBruto, valorNormalizado: (r.valorNormalizado || r.valorBruto || '').toString().toUpperCase().trim(), regra: r.regra, evidencia: r.evidencia };
    };
  }

  R.resolverBooking = function (unidades, ftr) {
    return resolverCampo_(unidades, function (u) { return adaptador_(function (t) { return E.extrairBooking(t, ftr); })(u); }, CFG.HIERARQUIA_CONFIANCA.BOOKING);
  };

  R.resolverBL = function (unidades, bookingResolvido) {
    const bookingValor = bookingResolvido && bookingResolvido.vencedor ? bookingResolvido.vencedor.valorNormalizado : null;
    return resolverCampo_(unidades, function (u) {
      const r = E.extrairBL(u.texto, bookingValor);
      if (!r) return null;
      return { valorBruto: r.valorGravar, valorNormalizado: r.valorGravar.toUpperCase(), regra: r.regra, evidencia: r.evidencia };
    }, CFG.HIERARQUIA_CONFIANCA.BL);
  };

  R.resolverPortoOrigem = function (unidades) {
    return resolverCampo_(unidades, adaptador_(E.extrairPortoOrigem), CFG.HIERARQUIA_CONFIANCA.PORTO_ORIGEM);
  };
  R.resolverPortoDestino = function (unidades) {
    return resolverCampo_(unidades, adaptador_(E.extrairPortoDestino), CFG.HIERARQUIA_CONFIANCA.POD);
  };
  R.resolverPlaceOfReceipt = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairPlaceOfReceipt), null); };
  R.resolverPlaceOfDelivery = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairPlaceOfDelivery), null); };

  R.resolverMT = function (unidades) {
    return resolverCampo_(unidades, function (u) {
      const r = E.extrairPesoMT(u.texto);
      if (!r) return null;
      return { valorBruto: r.valorBruto, valorNormalizado: r.valorMT, regra: r.regra, evidencia: r.evidencia };
    }, CFG.HIERARQUIA_CONFIANCA.MT, function (a, b) { return Math.abs(a - b) < 0.05; });
  };

  R.resolverInvoice = function (unidades, ftr) {
    return resolverCampo_(unidades, function (u) { return adaptador_(function (t) { return E.extrairInvoice(t, ftr); })(u); }, CFG.HIERARQUIA_CONFIANCA.INVOICE);
  };

  R.resolverIncoterm = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairIncoterm), null); };
  R.resolverVessel = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairVessel), null); };
  R.resolverVoyage = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairVoyage), null); };
  R.resolverArmador = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairArmador), null); };
  R.resolverETD = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairETD), null); };
  R.resolverETA = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairETA), null); };
  R.resolverDataEmbarque = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairDataEmbarque), null); };
  R.resolverSafra = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairSafra), null); };
  R.resolverTermoPagamento = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairTermoPagamento), null); };
  R.resolverValorUnitario = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairValorUnitario), null); };
  R.resolverValorTotal = function (unidades) { return resolverCampo_(unidades, adaptador_(E.extrairValorTotal), null); };

  R.resolverContainers = function (unidades) {
    return resolverCampo_(unidades, function (u) {
      const r = E.extrairContainers(u.texto);
      if (!r) return null;
      return { valorBruto: (r.quantidade || '') + ' / ' + r.numeros.join(','), valorNormalizado: r.numeros.join(','), regra: r.regra, evidencia: SEC.mascararEvidencia(r.numeros.join(', ')), quantidade: r.quantidade, numeros: r.numeros };
    }, null);
  };

  // Exportador / Importador têm regras próprias (label > assunto > corpo,
  // com filtro de intermediário só no importador) — não usam o resolver
  // genérico de hierarquia documental.
  R.resolverExportador = function (unidades) {
    const porAtaque = unidades.filter(function (u) { return u.origem === 'ATTACHMENT'; })
      .map(function (u) { return { u: u, r: E.extrairExportadorDeCorpo(u.texto) }; })
      .filter(function (x) { return x.r; })
      .sort(function (a, b) { return b.u.dataMensagem - a.u.dataMensagem; });
    if (porAtaque.length) return montarResultadoSimples_(porAtaque[0].u, porAtaque[0].r, 'ALTA');

    const subjectRecente = unidades.filter(function (u) { return u.origem === 'SUBJECT'; }).sort(function (a, b) { return b.dataMensagem - a.dataMensagem; })[0];
    if (subjectRecente) {
      const nome = E.extrairExportadorDoAssunto(subjectRecente.texto);
      if (nome) return montarResultadoSimples_(subjectRecente, { valorBruto: nome, regra: 'assunto_padrao_x', evidencia: SEC.mascararEvidencia(subjectRecente.texto) }, 'MEDIA');
    }

    const corpo = unidades.filter(function (u) { return u.origem === 'BODY_PLAIN'; })
      .map(function (u) { return { u: u, r: E.extrairExportadorDeCorpo(u.texto) }; })
      .filter(function (x) { return x.r; })
      .sort(function (a, b) { return b.u.dataMensagem - a.u.dataMensagem; });
    if (corpo.length) return montarResultadoSimples_(corpo[0].u, corpo[0].r, 'MEDIA');

    return { vencedor: null, conflito: false, candidatos: [] };
  };

  R.resolverImportador = function (unidades, clienteDaLabel) {
    if (clienteDaLabel) {
      const uLabel = unidades.find(function (u) { return u.origem === 'LABEL'; }) || unidades[0];
      return montarResultadoSimples_(uLabel, { valorBruto: clienteDaLabel, regra: 'label_organizador', evidencia: '(label da thread)' }, 'ALTA');
    }

    const porAtaque = unidades.filter(function (u) { return u.origem === 'ATTACHMENT'; })
      .map(function (u) { return { u: u, r: E.extrairImportadorDeCorpo(u.texto) }; })
      .filter(function (x) { return x.r && !E.ehIntermediario(x.r.valorBruto); })
      .sort(function (a, b) { return b.u.dataMensagem - a.u.dataMensagem; });
    if (porAtaque.length) return montarResultadoSimples_(porAtaque[0].u, porAtaque[0].r, 'ALTA');

    const subjectRecente = unidades.filter(function (u) { return u.origem === 'SUBJECT'; }).sort(function (a, b) { return b.dataMensagem - a.dataMensagem; })[0];
    if (subjectRecente) {
      const nome = E.extrairImportadorDoAssunto(subjectRecente.texto);
      if (nome && !E.ehIntermediario(nome)) return montarResultadoSimples_(subjectRecente, { valorBruto: nome, regra: 'assunto_padrao_x', evidencia: SEC.mascararEvidencia(subjectRecente.texto) }, 'MEDIA');
    }

    return { vencedor: null, conflito: false, candidatos: [] };
  };

  function montarResultadoSimples_(unidade, r, confianca) {
    const vencedor = {
      valorBruto: r.valorBruto, valorNormalizado: E.aplicarNomeCanonico(E.normalizarNomeCliente(r.valorBruto)),
      regraExtracao: r.regra, evidencia: r.evidencia, rank: 0, origem: unidade.origem, tipoDoc: unidade.tipoDoc,
      dataMensagem: unidade.dataMensagem, mensagemIdMascarado: unidade.mensagemIdMascarado,
      threadIdMascarado: unidade.threadIdMascarado, nomeArquivo: unidade.nomeArquivo, hash: unidade.hash,
      indicadorVersao: unidade.indicadorVersao, confianca: confianca,
    };
    return { vencedor: vencedor, conflito: false, candidatos: [vencedor] };
  }

  // Produto: mantém a lógica simples original (assunto > início do corpo),
  // olhando só a mensagem mais recente — é um campo descritivo, não
  // documental, e não participa da hierarquia de confiança do item 13.
  R.resolverProduto = function (unidades) {
    const subject = unidades.find(function (u) { return u.origem === 'SUBJECT'; });
    const corpo = unidades.find(function (u) { return u.origem === 'BODY_PLAIN'; });
    const valor = E.extrairProduto(subject ? subject.texto : '', corpo ? corpo.texto : '');
    if (!valor) return { vencedor: null, conflito: false, candidatos: [] };
    const base = subject || corpo || unidades[0];
    return montarResultadoSimplesGenerico_(base, valor, 'produto_heuristico', 'MEDIA');
  };

  function montarResultadoSimplesGenerico_(unidade, valor, regra, confianca) {
    const vencedor = {
      valorBruto: valor, valorNormalizado: valor, regraExtracao: regra, evidencia: '(heurística de palavras-chave)',
      rank: 0, origem: unidade.origem, tipoDoc: unidade.tipoDoc, dataMensagem: unidade.dataMensagem,
      mensagemIdMascarado: unidade.mensagemIdMascarado, threadIdMascarado: unidade.threadIdMascarado,
      nomeArquivo: unidade.nomeArquivo, hash: unidade.hash, indicadorVersao: unidade.indicadorVersao, confianca: confianca,
    };
    return { vencedor: vencedor, conflito: false, candidatos: [vencedor] };
  }

})(TrackingFTR.Resolver, TrackingFTR.Config, TrackingFTR.Security, TrackingFTR.Extract);
