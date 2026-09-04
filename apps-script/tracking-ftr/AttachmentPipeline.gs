/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: AttachmentPipeline.gs
 * ============================================================
 *
 * Ingestão de anexos: validação, conversão/OCR via o Serviço Avançado
 * do Drive ("Drive API", ver appsscript.json) e extração de texto por
 * tipo. Todo arquivo temporário criado aqui:
 *   - vive só dentro da pasta controlada TrackingFTR (nunca na raiz do
 *     Drive, nunca compartilhado);
 *   - tem nome aleatório não semântico (Security.nomeTempAleatorio);
 *   - tem seu ID registrado ANTES de qualquer processamento, para que
 *     a limpeza (finally) sempre consiga localizá-lo;
 *   - é movido pra lixeira (nunca DriveApp.removeFile permanente, nunca
 *     exclusão de anexo original ou de mensagem).
 *
 * Requer o Serviço Avançado "Drive API" habilitado no projeto (ver
 * appsscript.json → enabledAdvancedServices). Sem ele, o pipeline
 * degrada de forma segura: PDFs/imagens escaneados não são OCRizados
 * (ficam com texto vazio e a linha correspondente cai em REVISAR por
 * ausência de evidência, nunca em erro silencioso).
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Attach = {};

(function (A) {

  // ==========================================================
  // DISPONIBILIDADE DO SERVIÇO AVANÇADO
  // ==========================================================

  A.driveAvancadoDisponivel = function () {
    try {
      return typeof Drive !== 'undefined' && !!Drive.Files;
    } catch (e) {
      return false;
    }
  };

  // ==========================================================
  // PASTA TEMPORÁRIA CONTROLADA
  // ==========================================================

  /**
   * Obtém (ou cria) a pasta temporária dedicada. O ID é guardado em
   * PropertiesService pra reuso entre execuções, mas a pasta em si
   * SEMPRE é revalidada quanto a compartilhamento antes de ser usada —
   * se alguém a compartilhou externamente entre uma execução e outra,
   * o processamento é interrompido (item 17: "Interrompa o
   * processamento se detectar configuração insegura").
   */
  A.obterPastaTemp = function () {
    const props = PropertiesService.getScriptProperties();
    let folderId = props.getProperty(TrackingFTR.Config.PROP_TEMP_FOLDER_ID);
    let folder = null;

    if (folderId) {
      try {
        folder = DriveApp.getFolderById(folderId);
        if (folder.isTrashed()) folder = null;
      } catch (e) {
        folder = null;
      }
    }

    if (!folder) {
      folder = DriveApp.createFolder(TrackingFTR.Config.PASTA_TEMP_NOME);
      props.setProperty(TrackingFTR.Config.PROP_TEMP_FOLDER_ID, folder.getId());
      TrackingFTR.Security.logInfo('AttachmentPipeline: pasta temporária criada.');
    }

    const validacao = TrackingFTR.Security.validarPastaTemp(folder);
    if (!validacao.seguro) {
      throw new Error('CONFIG_INSEGURA: ' + validacao.motivo);
    }

    return folder;
  };

  // ==========================================================
  // VALIDAÇÃO DE ANEXO (MIME + tamanho) — nunca confia só na extensão
  // ==========================================================

  A.validarAnexo = function (attachment) {
    const contentType = (attachment.getContentType() || '').toLowerCase().split(';')[0].trim();
    const tamanho = attachment.getSize();

    if (!TrackingFTR.Config.MIME_ACEITOS[contentType]) {
      return { valido: false, motivo: 'mime_nao_suportado', tipoInterno: null, contentType: contentType };
    }
    if (tamanho <= 0) {
      return { valido: false, motivo: 'anexo_vazio', tipoInterno: null, contentType: contentType };
    }
    if (tamanho > TrackingFTR.Config.MAX_ANEXO_BYTES) {
      return { valido: false, motivo: 'excede_tamanho_maximo', tipoInterno: null, contentType: contentType };
    }
    return { valido: true, motivo: null, tipoInterno: TrackingFTR.Config.MIME_ACEITOS[contentType], contentType: contentType };
  };

  // ==========================================================
  // REGISTRO DE TEMPORÁRIOS DA EXECUÇÃO ATUAL
  // ==========================================================

  A.novoRegistroTemp = function () {
    return { ids: [] };
  };

  function registrar_(registro, fileId) {
    if (fileId) registro.ids.push(fileId);
  }

  /**
   * Move para a lixeira SOMENTE arquivos cujo ID está no registro desta
   * execução (ou seja, criados por este próprio script neste processo).
   * Nunca apaga por nome, nunca apaga anexos originais.
   */
  A.limparRegistroTemp = function (registro) {
    let removidos = 0;
    (registro.ids || []).forEach(function (id) {
      try {
        const file = DriveApp.getFileById(id);
        file.setTrashed(true);
        removidos++;
      } catch (e) {
        // Já removido ou inacessível — não é um erro crítico de execução.
        TrackingFTR.Security.logWarn('AttachmentPipeline: falha ao mover temporário ' + TrackingFTR.Security.mascarar(id, 4, 4) + ' para lixeira.');
      }
    });
    registro.ids = [];
    return removidos;
  };

  // ==========================================================
  // CONVERSÃO / OCR VIA DRIVE API (Serviço Avançado)
  // ==========================================================

  /**
   * Sobe um blob pra dentro da pasta temporária convertendo para o
   * formato Google equivalente. `ocr` força reconhecimento óptico
   * (necessário para PDF/imagem escaneados); `ocrLanguage` é UM hint de
   * idioma por chamada — a Drive API não aceita lista de idiomas, por
   * isso o chamador pode repetir a chamada com idiomas diferentes (ver
   * `ocrComFallbackIdioma_`).
   */
  function converterViaDrive_(blob, folderId, ocr, ocrLanguage, registro) {
    const resource = {
      title: TrackingFTR.Security.nomeTempAleatorio(),
      parents: [{ id: folderId }],
    };
    const params = { convert: true };
    if (!ocr) {
      const arquivo = Drive.Files.insert(resource, blob, params);
      registrar_(registro, arquivo.id);
      return arquivo;
    }

    params.ocr = true;
    if (ocrLanguage) params.ocrLanguage = ocrLanguage;

    // OCR tem cota de taxa própria e mais restrita na Drive API. Uma
    // pausa fixa antes de cada chamada evita rajadas; se mesmo assim
    // esbarrar no limite (erro transiente, não uma falha real de
    // conversão), tenta de novo com backoff antes de desistir.
    let ultimoErro = null;
    for (let tentativa = 1; tentativa <= TrackingFTR.Config.OCR_MAX_TENTATIVAS_RATE_LIMIT; tentativa++) {
      Utilities.sleep(TrackingFTR.Config.OCR_INTERVALO_MS);
      try {
        const arquivo = Drive.Files.insert(resource, blob, params);
        registrar_(registro, arquivo.id);
        return arquivo;
      } catch (e) {
        ultimoErro = e;
        const msg = (e && e.message ? e.message : '').toLowerCase();
        const ehRateLimit = msg.indexOf('rate limit') !== -1 || msg.indexOf('quota') !== -1;
        if (!ehRateLimit || tentativa === TrackingFTR.Config.OCR_MAX_TENTATIVAS_RATE_LIMIT) {
          throw e;
        }
        TrackingFTR.Security.logWarn('AttachmentPipeline: rate limit de OCR — tentativa ' + tentativa + '/' + TrackingFTR.Config.OCR_MAX_TENTATIVAS_RATE_LIMIT + ', aguardando antes de repetir.');
        Utilities.sleep(TrackingFTR.Config.OCR_BACKOFF_BASE_MS * tentativa);
      }
    }
    throw ultimoErro;
  }

  function textoDoGoogleDoc_(fileId) {
    const doc = DocumentApp.openById(fileId);
    return doc.getBody().getText() || '';
  }

  function textoDaGoogleSheet_(fileId) {
    const ss = SpreadsheetApp.openById(fileId);
    const blocos = [];
    ss.getSheets().forEach(function (sheet) {
      const dados = sheet.getDataRange().getValues();
      dados.forEach(function (linha) {
        const celulas = linha.map(function (c) { return (c === null || c === undefined) ? '' : c.toString().trim(); }).filter(String);
        if (celulas.length) blocos.push(celulas.join(' | '));
      });
    });
    return blocos.join('\n');
  }

  function textoValido_(texto) {
    return !!(texto && texto.replace(/\s+/g, '').length >= TrackingFTR.Config.OCR_MIN_CARACTERES_TEXTO_VALIDO);
  }

  /**
   * PDF: primeiro tenta extrair a camada de texto pesquisável (convert
   * sem ocr — rápido, não força reconhecimento óptico). Se o resultado
   * vier vazio/curto, assume que é PDF escaneado e refaz com ocr:true,
   * tentando os idiomas configurados em ordem até achar um texto
   * plausível ou esgotar o limite de tentativas (custo de OCR por
   * execução é limitado por TrackingFTR.Config.MAX_OPERACOES_OCR_POR_EXECUCAO).
   */
  A.extrairTextoPdf = function (blob, folder, registro, orcamentoOcr) {
    let arquivo = converterViaDrive_(blob, folder.getId(), false, null, registro);
    let texto = textoDoGoogleDoc_(arquivo.id);
    if (textoValido_(texto)) {
      return { texto: texto, viaOcr: false, idioma: null };
    }

    if (orcamentoOcr.restantes <= 0) {
      return { texto: texto || '', viaOcr: false, idioma: null, ocrIndisponivelPorOrcamento: true };
    }

    const idiomas = TrackingFTR.Config.OCR_IDIOMAS_PRIORIDADE.slice(0, TrackingFTR.Config.OCR_MAX_TENTATIVAS_IDIOMA);
    for (let i = 0; i < idiomas.length; i++) {
      if (orcamentoOcr.restantes <= 0) break;
      orcamentoOcr.restantes--;
      const arquivoOcr = converterViaDrive_(blob, folder.getId(), true, idiomas[i], registro);
      const textoOcr = textoDoGoogleDoc_(arquivoOcr.id);
      if (textoValido_(textoOcr)) {
        return { texto: textoOcr, viaOcr: true, idioma: idiomas[i] };
      }
      texto = textoOcr; // guarda o melhor esforço mesmo se curto
    }

    return { texto: texto || '', viaOcr: true, idioma: idiomas[0] || null };
  };

  /** Imagem (PNG/JPEG/TIFF): sempre trata como escaneado — vai direto pro OCR. */
  A.extrairTextoImagem = function (blob, folder, registro, orcamentoOcr) {
    if (orcamentoOcr.restantes <= 0) {
      return { texto: '', viaOcr: false, idioma: null, ocrIndisponivelPorOrcamento: true };
    }
    const idiomas = TrackingFTR.Config.OCR_IDIOMAS_PRIORIDADE.slice(0, TrackingFTR.Config.OCR_MAX_TENTATIVAS_IDIOMA);
    let melhor = '';
    for (let i = 0; i < idiomas.length; i++) {
      if (orcamentoOcr.restantes <= 0) break;
      orcamentoOcr.restantes--;
      try {
        const arquivoOcr = converterViaDrive_(blob, folder.getId(), true, idiomas[i], registro);
        const textoOcr = textoDoGoogleDoc_(arquivoOcr.id);
        if (textoValido_(textoOcr)) return { texto: textoOcr, viaOcr: true, idioma: idiomas[i] };
        if (textoOcr && textoOcr.length > melhor.length) melhor = textoOcr;
      } catch (e) {
        // TIFF em particular tem suporte inconsistente no conversor do
        // Drive — falha aqui é tratada como "sem texto", não como erro
        // fatal do lote inteiro. A mensagem real do erro é logada (só
        // texto técnico da plataforma, nunca conteúdo do anexo) pra não
        // mascarar problemas reais (ex.: escopo insuficiente) atrás de
        // um "formato não suportado" genérico.
        TrackingFTR.Security.logErroSeguro('AttachmentPipeline: falha de OCR em imagem', e);
      }
    }
    return { texto: melhor, viaOcr: true, idioma: idiomas[0] || null };
  };

  A.extrairTextoXlsx = function (blob, folder, registro) {
    const arquivo = converterViaDrive_(blob, folder.getId(), false, null, registro);
    return { texto: textoDaGoogleSheet_(arquivo.id), viaOcr: false, idioma: null };
  };

  A.extrairTextoDocx = function (blob, folder, registro) {
    const arquivo = converterViaDrive_(blob, folder.getId(), false, null, registro);
    return { texto: textoDoGoogleDoc_(arquivo.id), viaOcr: false, idioma: null };
  };

  A.extrairTextoCsv = function (blob) {
    try {
      const linhas = Utilities.parseCsv(blob.getDataAsString());
      const texto = linhas.map(function (l) { return l.join(' | '); }).join('\n');
      return { texto: texto, viaOcr: false, idioma: null };
    } catch (e) {
      return { texto: blob.getDataAsString() || '', viaOcr: false, idioma: null };
    }
  };

  /**
   * Ponto de entrada único: recebe um GmailAttachment já validado e
   * devolve { ok, texto, viaOcr, idioma, tipoInterno, hash, motivoRejeicao }.
   * Nunca lança para o chamador em caso de falha de conversão — falha
   * de OCR/conversão é um resultado de negócio (documento sem
   * evidência extraível), não uma exceção fatal do lote.
   */
  A.processarAnexo = function (attachment, folder, registro, orcamentoOcr) {
    const validacao = A.validarAnexo(attachment);
    const blob = attachment.copyBlob();
    const hash = TrackingFTR.Security.sha256HexDeBlob(blob);

    if (!validacao.valido) {
      return { ok: false, motivoRejeicao: validacao.motivo, tipoInterno: null, hash: hash, texto: '', viaOcr: false, idioma: null };
    }

    if (!A.driveAvancadoDisponivel()) {
      if (validacao.tipoInterno === 'CSV') {
        const r = A.extrairTextoCsv(blob);
        return Object.assign({ ok: true, motivoRejeicao: null, tipoInterno: validacao.tipoInterno, hash: hash }, r);
      }
      return { ok: false, motivoRejeicao: 'servico_drive_avancado_indisponivel', tipoInterno: validacao.tipoInterno, hash: hash, texto: '', viaOcr: false, idioma: null };
    }

    try {
      let resultado;
      switch (validacao.tipoInterno) {
        case 'PDF':
          resultado = A.extrairTextoPdf(blob, folder, registro, orcamentoOcr);
          break;
        case 'PNG':
        case 'JPEG':
        case 'TIFF':
          resultado = A.extrairTextoImagem(blob, folder, registro, orcamentoOcr);
          break;
        case 'XLSX':
        case 'XLS':
          resultado = A.extrairTextoXlsx(blob, folder, registro);
          break;
        case 'DOCX':
        case 'DOC':
          resultado = A.extrairTextoDocx(blob, folder, registro);
          break;
        case 'CSV':
          resultado = A.extrairTextoCsv(blob);
          break;
        default:
          resultado = { texto: '', viaOcr: false, idioma: null };
      }
      return Object.assign({ ok: true, motivoRejeicao: null, tipoInterno: validacao.tipoInterno, hash: hash }, resultado);
    } catch (e) {
      TrackingFTR.Security.logErroSeguro('AttachmentPipeline: falha ao processar anexo (' + validacao.tipoInterno + ')', e);
      return { ok: false, motivoRejeicao: 'erro_conversao', tipoInterno: validacao.tipoInterno, hash: hash, texto: '', viaOcr: false, idioma: null };
    }
  };

  // ==========================================================
  // LIMPEZA DE ÓRFÃOS (função de manutenção, chamada por diagnóstico
  // ou por trigger periódico próprio — nunca automaticamente dentro do
  // processamento principal, pra não competir por tempo de execução)
  // ==========================================================

  /**
   * Remove (lixeira) arquivos temporários órfãos: precisam estar
   * DENTRO da pasta temporária controlada, ter o padrão de nome
   * `tmp_<hex>` gerado por Security.nomeTempAleatorio, e idade maior
   * que TrackingFTR.Config.RETENCAO_TEMP_HORAS. Nunca varre o Drive inteiro nem usa
   * DriveApp.searchFiles com critério amplo — só itera o conteúdo da
   * própria pasta controlada.
   */
  A.limparTemporariosOrfaos = function () {
    const folder = A.obterPastaTemp();
    const limiteMs = TrackingFTR.Config.RETENCAO_TEMP_HORAS * 60 * 60 * 1000;
    const agora = Date.now();
    let removidos = 0;
    let inspecionados = 0;

    const it = folder.getFiles();
    while (it.hasNext()) {
      const file = it.next();
      inspecionados++;
      const nome = file.getName();
      const padraoOk = /^tmp_[a-f0-9]+/i.test(nome);
      if (!padraoOk) continue; // nunca apaga por nome fora do padrão que o próprio script gera
      const idadeMs = agora - file.getDateCreated().getTime();
      if (idadeMs >= limiteMs) {
        file.setTrashed(true);
        removidos++;
      }
    }

    TrackingFTR.Security.logInfo('AttachmentPipeline: limpeza de órfãos — inspecionados=' + inspecionados + ', removidos=' + removidos + '.');
    return { inspecionados: inspecionados, removidos: removidos };
  };

})(TrackingFTR.Attach);
