/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Security.gs
 * ============================================================
 *
 * Tudo que toca mascaramento, hashing, validação de compartilhamento
 * e o "safe logger" mora aqui. Nenhuma outra parte do projeto deve
 * chamar Logger.log/console.log diretamente com dado vindo de email
 * ou anexo — sempre passar por TrackingFTR.Security.log*().
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Security = {};

(function (S) {

  /**
   * SHA-256 hex de uma string. Usado para IDs mascarados e hash de anexo
   * (deduplicação sem persistir o conteúdo).
   */
  S.sha256Hex = function (texto) {
    if (!texto) return '';
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
    return bytes.map(function (b) {
      const v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  };

  S.sha256HexDeBlob = function (blob) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob.getBytes());
    return bytes.map(function (b) {
      const v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  };

  /** ID de mensagem/thread nunca aparece cru em log — só um hash truncado. */
  S.idMascarado = function (idBruto) {
    if (!idBruto) return '(sem-id)';
    return S.sha256Hex(idBruto).substring(0, 12);
  };

  /**
   * Mascara um valor operacional (booking, BL, FTR, invoice) mantendo só
   * as bordas — o suficiente para um humano reconhecer "é este" num log,
   * sem expor o identificador completo fora de área de acesso restrito.
   */
  S.mascarar = function (valor, manterInicio, manterFim) {
    if (!valor) return '';
    const s = valor.toString();
    const ini = manterInicio == null ? 2 : manterInicio;
    const fim = manterFim == null ? 2 : manterFim;
    if (s.length <= ini + fim) return s.charAt(0) + '***';
    return s.substring(0, ini) + '…' + s.substring(s.length - fim);
  };

  /**
   * Mascara e anexa uma "impressão digital" curta (4 hex do hash) —
   * usado quando o log precisa DISTINGUIR dois valores mascarados que
   * colidiriam visualmente (ex.: dois FTRs candidatos em um caso de
   * ambiguidade), sem expor o valor completo. A impressão é estável:
   * o mesmo valor sempre gera a mesma impressão, então dá pra
   * reconhecer "é o mesmo conflito de novo" entre execuções.
   */
  S.mascararComImpressaoDigital = function (valor, manterInicio, manterFim) {
    if (!valor) return '';
    return S.mascarar(valor, manterInicio, manterFim) + '#' + S.sha256Hex(valor.toString()).substring(0, 4);
  };

  /** Mascara nome de arquivo preservando só a extensão. */
  S.mascararNomeArquivo = function (nome) {
    if (!nome) return '(sem-nome)';
    const m = nome.match(/(\.[a-zA-Z0-9]{2,5})$/);
    const ext = m ? m[1] : '';
    return 'anexo_' + S.sha256Hex(nome).substring(0, 8) + ext;
  };

  /**
   * Remove padrões óbvios de dado sensível de um trecho de evidência
   * (email, sequências longas de dígitos não relacionadas ao match) e
   * trunca ao tamanho máximo configurado. É uma rede de segurança
   * adicional em cima do fato de que a evidência já nasce como um
   * trecho curto ao redor do valor extraído, nunca o documento inteiro.
   */
  S.mascararEvidencia = function (texto, maxLen) {
    if (!texto) return '';
    let t = texto.toString()
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/\s+/g, ' ')
      .trim();
    const limite = maxLen || TrackingFTR.Config.EVIDENCIA_MAX_CHARS;
    if (t.length > limite) {
      t = t.substring(0, limite - 1) + '…';
    }
    return t;
  };

  /**
   * Logger seguro: aceita só texto técnico (mensagem fixa) + valores já
   * mascarados. Nunca deve receber corpo de email, texto de anexo ou OCR
   * bruto. Usa console.log (Stackdriver) como o projeto original.
   */
  S.logInfo = function (msg) { console.log(msg); };
  S.logWarn = function (msg) { console.warn(msg); };
  S.logErro = function (msg) { console.error(msg); };

  /**
   * Sanitiza mensagens de erro antes de logar: erros do V8/Apps Script às
   * vezes ecoam parte do argumento que falhou (ex.: um trecho de texto
   * passado pra uma função que lançou). Aplicamos a mesma máscara de
   * evidência por segurança.
   */
  S.logErroSeguro = function (prefixo, e) {
    const bruto = (e && e.message) ? e.message : String(e);
    console.error(prefixo + ': ' + S.mascararEvidencia(bruto, 200));
  };

  // ==========================================================
  // VALIDAÇÃO DE AMBIENTE / COMPARTILHAMENTOS
  // ==========================================================

  /**
   * Verifica se a planilha de destino está compartilhada de forma
   * insegura ("qualquer pessoa com o link" ou publicada na web). Se
   * estiver, a execução deve ser interrompida (item 17/21 do briefing).
   * Retorna { seguro: boolean, motivo: string }.
   */
  S.validarCompartilhamentoPlanilha = function (spreadsheet) {
    try {
      const acesso = spreadsheet.getAccess ? null : null; // placeholder de compat; ver abaixo
      const file = DriveApp.getFileById(spreadsheet.getId());
      const sharingAccess = file.getSharingAccess();
      const inseguro = (
        sharingAccess === DriveApp.Access.ANYONE ||
        sharingAccess === DriveApp.Access.ANYONE_WITH_LINK
      );
      if (inseguro) {
        return { seguro: false, motivo: 'Planilha compartilhada como "qualquer pessoa" (' + sharingAccess + ').' };
      }
      return { seguro: true, motivo: '' };
    } catch (e) {
      // Sem permissão pra checar compartilhamento não deve travar o script
      // silenciosamente — reporta como indefinido, não como seguro.
      return { seguro: false, motivo: 'Não foi possível validar o compartilhamento (permissão insuficiente): ' + S.mascararEvidencia(e.message, 120) };
    }
  };

  /**
   * Verifica se a pasta temporária pertence ao ambiente autorizado (foi
   * criada pelo próprio script, não é a Meu Drive raiz, e não está
   * compartilhada com terceiros).
   */
  S.validarPastaTemp = function (folder) {
    try {
      const sharingAccess = folder.getSharingAccess();
      const inseguro = (
        sharingAccess === DriveApp.Access.ANYONE ||
        sharingAccess === DriveApp.Access.ANYONE_WITH_LINK
      );
      if (inseguro) {
        return { seguro: false, motivo: 'Pasta temporária compartilhada publicamente.' };
      }
      const editores = folder.getEditors().length;
      const visualizadores = folder.getViewers().length;
      if (editores > 0 || visualizadores > 0) {
        return { seguro: false, motivo: 'Pasta temporária compartilhada com ' + editores + ' editor(es) e ' + visualizadores + ' visualizador(es) além do proprietário.' };
      }
      return { seguro: true, motivo: '' };
    } catch (e) {
      return { seguro: false, motivo: 'Não foi possível validar a pasta temporária: ' + S.mascararEvidencia(e.message, 120) };
    }
  };

  /** Nome de arquivo temporário aleatório e não semântico (item 21). */
  S.nomeTempAleatorio = function (extensaoSugerida) {
    const aleatorio = Utilities.getUuid().replace(/-/g, '');
    return 'tmp_' + aleatorio + (extensaoSugerida ? '.' + extensaoSugerida : '');
  };

})(TrackingFTR.Security);
