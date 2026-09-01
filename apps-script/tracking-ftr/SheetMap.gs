/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: SheetMap.gs
 * ============================================================
 *
 * Leitura dinâmica do cabeçalho da aba "TRACKING 2026", criação
 * controlada das colunas PORTO ORIGEM e BL quando ausentes, e
 * helpers de escrita segura (texto forçado, sem fórmula injetada).
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.SheetMap = {};

(function (M, CFG, SEC) {

  function normalizarCabecalho_(texto) {
    if (!texto) return '';
    return texto.toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[.\-_/]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Lê a linha de cabeçalho e monta { chaveLogica -> colunaIndex(1-based) }.
   * Cria PORTO ORIGEM e BL ao final da planilha se nenhum alias bater.
   * NUNCA desloca, apaga ou reordena colunas existentes.
   */
  M.mapearColunas = function (sheet) {
    const ultimaCol = Math.max(sheet.getLastColumn(), 1);
    const cabecalhoRange = sheet.getRange(CFG.LINHA_CABECALHO, 1, 1, ultimaCol);
    const cabecalho = cabecalhoRange.getValues()[0];

    const porTextoNormalizado = new Map();
    cabecalho.forEach(function (titulo, i) {
      const norm = normalizarCabecalho_(titulo);
      if (norm && !porTextoNormalizado.has(norm)) {
        porTextoNormalizado.set(norm, i + 1);
      }
    });

    const mapa = {};
    const criadas = [];
    let proximaColunaLivre = ultimaCol;

    Object.keys(CFG.CAMPOS_PLANILHA).forEach(function (chave) {
      const def = CFG.CAMPOS_PLANILHA[chave];
      let coluna = null;

      for (let i = 0; i < def.aliases.length; i++) {
        const alvo = normalizarCabecalho_(def.aliases[i]);
        if (porTextoNormalizado.has(alvo)) {
          coluna = porTextoNormalizado.get(alvo);
          break;
        }
      }

      if (!coluna && def.criarSeAusente) {
        proximaColunaLivre += 1;
        coluna = proximaColunaLivre;
        sheet.getRange(CFG.LINHA_CABECALHO, coluna).setValue(def.headerCriacao || chave);
        criadas.push(def.headerCriacao || chave);
        SEC.logInfo('SheetMap: coluna "' + (def.headerCriacao || chave) + '" criada na posição ' + coluna + ' (não existia).');
      }

      if (!coluna && CFG.INDICE_LEGADO_FALLBACK[chave]) {
        coluna = CFG.INDICE_LEGADO_FALLBACK[chave];
        SEC.logWarn('SheetMap: coluna "' + chave + '" não encontrada por cabeçalho — usando índice legado ' + coluna + ' como fallback. Confirme o cabeçalho real da planilha.');
      }

      mapa[chave] = coluna || null;
    });

    return {
      mapa: mapa,
      ultimaColunaAposCriacao: Math.max(ultimaCol, proximaColunaLivre),
      colunasCriadas: criadas,
    };
  };

  /**
   * Grava um valor "forçando texto" quando necessário (BL, booking, FTR,
   * containers) para impedir conversão automática do Sheets pra número
   * ou data (item 7.7 do briefing). Usa setNumberFormat('@') na célula
   * antes do setValue — é a forma suportada pelo SpreadsheetApp de
   * garantir que o conteúdo permaneça texto puro.
   */
  M.gravarComoTexto = function (range, valor) {
    range.setNumberFormat('@');
    range.setValue(M.escaparValorPerigoso(valor));
  };

  /**
   * Evita fórmula injetada por conteúdo de email/anexo: se o valor
   * começar com =, +, -, @ (gatilhos de fórmula no Sheets), prefixa com
   * apóstrofo para forçar interpretação literal.
   */
  M.escaparValorPerigoso = function (valor) {
    if (valor === null || valor === undefined) return valor;
    const s = valor.toString();
    if (/^[=+\-@]/.test(s)) {
      return "'" + s;
    }
    return valor;
  };

})(TrackingFTR.SheetMap, TrackingFTR.Config, TrackingFTR.Security);
