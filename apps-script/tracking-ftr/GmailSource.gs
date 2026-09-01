/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: GmailSource.gs
 * ============================================================
 *
 * Busca de threads (com watermark), filtro de relevância e coleta das
 * fontes textuais de uma thread (assunto, corpo texto, corpo HTML,
 * tabelas HTML, anexos, labels, histórico da própria thread).
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Gmail = {};

(function (G, CFG, SEC) {

  // ==========================================================
  // WATERMARK
  // ==========================================================

  G.montarQueryComWatermark = function () {
    const props = PropertiesService.getScriptProperties();
    const salvo = props.getProperty(CFG.PROP_WATERMARK);
    const base = 'label:' + CFG.LABEL_PROCESSADO;

    if (!salvo) {
      SEC.logInfo('GmailSource: sem watermark salvo — janela padrão de ' + CFG.DIAS_BUSCA_PADRAO + ' dias.');
      return base + ' newer_than:' + CFG.DIAS_BUSCA_PADRAO + 'd';
    }

    const ts = parseInt(salvo, 10);
    if (isNaN(ts)) {
      SEC.logWarn('GmailSource: watermark inválido — caindo para janela padrão.');
      return base + ' newer_than:' + CFG.DIAS_BUSCA_PADRAO + 'd';
    }

    const comFolga = new Date(ts - CFG.FOLGA_WATERMARK_DIAS * 24 * 60 * 60 * 1000);
    return base + ' after:' + formatarDataGmail_(comFolga);
  };

  G.salvarWatermark = function (dataExecucao) {
    PropertiesService.getScriptProperties().setProperty(CFG.PROP_WATERMARK, dataExecucao.getTime().toString());
  };

  G.resetarWatermark = function () {
    PropertiesService.getScriptProperties().deleteProperty(CFG.PROP_WATERMARK);
  };

  G.obterWatermark = function () {
    const v = PropertiesService.getScriptProperties().getProperty(CFG.PROP_WATERMARK);
    return v ? new Date(parseInt(v, 10)) : null;
  };

  function formatarDataGmail_(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return yyyy + '/' + mm + '/' + dd;
  }

  // ==========================================================
  // RELEVÂNCIA DE THREAD
  // ==========================================================

  /**
   * Uma thread é relevante se tiver ao menos um anexo de tipo aceito
   * OU uma keyword de documento oficial no assunto. Anexos com nome
   * genérico ("scan.pdf", "document.pdf") NUNCA são descartados aqui —
   * o filtro olha só a extensão/MIME, a classificação por conteúdo
   * acontece depois, em Extraction.gs.
   */
  G.threadEhRelevante = function (thread, mensagens) {
    for (let i = 0; i < mensagens.length; i++) {
      const anexos = mensagens[i].getAttachments({ includeInlineImages: false });
      for (let j = 0; j < anexos.length; j++) {
        const nome = (anexos[j].getName() || '').toLowerCase();
        if (CFG.EXTENSOES_ANEXO.some(function (ext) { return nome.endsWith(ext); })) {
          return true;
        }
      }
    }

    const assunto = (thread.getFirstMessageSubject() || '').toUpperCase();
    for (let k = 0; k < CFG.KEYWORDS_DOC_OFICIAL.length; k++) {
      if (assunto.indexOf(CFG.KEYWORDS_DOC_OFICIAL[k].toUpperCase()) !== -1) return true;
    }
    return false;
  };

  // ==========================================================
  // COLETA DE FONTES POR MENSAGEM
  // ==========================================================

  /**
   * Monta os blocos de texto de UMA mensagem, cada um com sua origem
   * (SUBJECT, BODY_PLAIN, BODY_HTML, BODY_TABLE) — usado por
   * Extraction.gs para gerar candidatos com a rastreabilidade exigida
   * pelo item 6 (origem, evidência, regra, confiança).
   */
  G.coletarBlocosDeMensagem = function (msg) {
    const subject = limparPrefixosAssunto_(msg.getSubject() || '');
    const corpoPlain = msg.getPlainBody() || '';
    let corpoHtml = '';
    try { corpoHtml = msg.getBody() || ''; } catch (e) { corpoHtml = ''; }

    const blocos = [];
    if (subject) blocos.push({ origem: 'SUBJECT', texto: subject });
    if (corpoPlain) blocos.push({ origem: 'BODY_PLAIN', texto: corpoPlain });

    if (corpoHtml) {
      const tabelas = TrackingFTR.HtmlUtils.extrairTabelas(corpoHtml);
      tabelas.forEach(function (t) { blocos.push({ origem: 'BODY_TABLE', texto: t }); });

      const htmlTexto = TrackingFTR.HtmlUtils.paraTexto(corpoHtml);
      // Evita duplicar 100% o plain body quando o HTML linearizado é
      // essencialmente o mesmo texto (caso comum) — mas mantém se
      // houver conteúdo adicional relevante (>15% maior).
      if (!corpoPlain || htmlTexto.length > corpoPlain.length * 1.15) {
        blocos.push({ origem: 'BODY_HTML', texto: htmlTexto });
      }
    }

    return { subject: subject, blocos: blocos, dataObj: msg.getDate() };
  };

  function limparPrefixosAssunto_(subject) {
    if (!subject) return '';
    return subject
      .replace(/^(?:\s*(?:Re|Fw|Fwd|RES|ENC|FW|ENC\.?|RES\.?)\s*:\s*)+/gi, '')
      .trim();
  }

  /** Labels não-sistema da thread (usadas como fonte de FTR/cliente). */
  G.obterLabelsCliente = function (thread) {
    const labels = thread.getLabels().map(function (l) { return l.getName(); });
    return labels.filter(function (l) { return l.indexOf('/FTR ') !== -1 && l.indexOf('FTR/') !== 0; });
  };

  /**
   * Nome do cliente organizador da thread, extraído do prefixo da label
   * (ex.: "MINEKS/FTR 03062-26" → "MINEKS"). Se houver mais de uma label
   * de cliente na mesma thread, usa a primeira e registra aviso — não é
   * um erro fatal, mas é um sinal de organização inconsistente do Gmail.
   */
  G.extrairNomeClienteDeLabels = function (labelsCliente) {
    if (!labelsCliente || !labelsCliente.length) return '';
    if (labelsCliente.length > 1) {
      SEC.logWarn('GmailSource: thread com múltiplas labels de cliente (' + labelsCliente.length + '). Usando a primeira.');
    }
    const nomeRaw = labelsCliente[0].split('/')[0];
    return TrackingFTR.Extract.normalizarNomeCliente(nomeRaw);
  };

  G.obterTodasLabels = function (thread) {
    return thread.getLabels().map(function (l) { return l.getName(); });
  };

})(TrackingFTR.Gmail, TrackingFTR.Config, TrackingFTR.Security);
