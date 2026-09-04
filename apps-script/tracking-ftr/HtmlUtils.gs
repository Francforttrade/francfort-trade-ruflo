/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: HtmlUtils.gs
 * ============================================================
 *
 * Apps Script não tem um parser de DOM no servidor. Em vez de tentar
 * simular um, tratamos o HTML do corpo do email como texto e:
 *   1. extraímos tabelas (<table>) separadamente, linearizando cada
 *      linha como "célula1 | célula2 | célula3" — isso preserva a
 *      adjacência rótulo→valor que é comum em bookings/invoices
 *      formatados em tabela HTML (ex.: "PORT OF LOADING | SANTOS");
 *   2. removemos o resto das tags e normalizamos espaços para obter
 *      um texto corrido equivalente ao "corpo HTML" sem markup.
 *
 * Nenhum HTML é executado; é tratado só como string.
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.HtmlUtils = {};

(function (H) {

  function decodificarEntidades_(s) {
    return s
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
      .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&atilde;/gi, 'ã')
      .replace(/&otilde;/gi, 'õ').replace(/&ccedil;/gi, 'ç');
  }

  /** Extrai tabelas HTML e retorna um array de blocos de texto (1 por tabela). */
  H.extrairTabelas = function (html) {
    if (!html) return [];
    const blocos = [];
    const tableRegex = /<table[\s\S]*?<\/table>/gi;
    let mTable;
    while ((mTable = tableRegex.exec(html)) !== null) {
      const tableHtml = mTable[0];
      const linhas = [];
      const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
      let mRow;
      while ((mRow = rowRegex.exec(tableHtml)) !== null) {
        const rowHtml = mRow[0];
        const celulas = [];
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let mCell;
        while ((mCell = cellRegex.exec(rowHtml)) !== null) {
          const texto = decodificarEntidades_(mCell[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim();
          if (texto) celulas.push(texto);
        }
        if (celulas.length) linhas.push(celulas.join(' | '));
      }
      if (linhas.length) blocos.push(linhas.join('\n'));
    }
    return blocos;
  };

  /** Remove tags e devolve texto corrido, preservando quebras de linha em blocos. */
  H.paraTexto = function (html) {
    if (!html) return '';
    let t = html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    t = decodificarEntidades_(t);
    return t.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
  };

})(TrackingFTR.HtmlUtils);
