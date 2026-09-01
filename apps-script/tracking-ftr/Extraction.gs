/**
 * ============================================================
 *  TRACKING FTR — Francfort
 *  Arquivo: Extraction.gs
 * ============================================================
 *
 * Classificação documental por conteúdo + todos os extratores de
 * campo. Cada extrator recebe TEXTO JÁ NORMALIZADO (nunca binário,
 * nunca HTML cru) e devolve candidato(s) no formato:
 *   { valorBruto, valorNormalizado, regra, evidencia }
 * A montagem do objeto de evidência completo (fonte, tipo documental,
 * hash, IDs mascarados, confiança) é responsabilidade de Resolver.gs —
 * este arquivo só sabe extrair e normalizar.
 */

var TrackingFTR = TrackingFTR || {};
TrackingFTR.Extract = {};

(function (E, CFG, SEC) {

  // ==========================================================
  // HELPER GENÉRICO: valor próximo de um rótulo
  // ==========================================================

  /**
   * Procura cada rótulo em `rotulos` dentro de `texto`; para cada
   * ocorrência, tenta casar `valueRegex` nos até `maxDistancia`
   * caracteres seguintes. Retorna o candidato mais próximo do rótulo
   * (menor distância rótulo→valor), com uma evidência mascarada.
   */
  function extrairPorRotulo_(texto, rotulos, valueRegex, maxDistancia) {
    if (!texto) return null;
    const dist = maxDistancia || 40;
    let melhor = null;

    rotulos.forEach(function (rotulo) {
      const rotuloRegex = new RegExp(escaparRegex_(rotulo) + '\\s*[:#\\-]?\\s*', 'gi');
      let m;
      while ((m = rotuloRegex.exec(texto)) !== null) {
        const inicioJanela = m.index + m[0].length;
        const janela = texto.substring(inicioJanela, inicioJanela + dist);
        const vm = janela.match(valueRegex);
        if (vm) {
          const distancia = vm.index;
          if (!melhor || distancia < melhor.distancia) {
            const inicioEvidencia = Math.max(0, m.index - 10);
            melhor = {
              valorBruto: vm[1] !== undefined ? vm[1] : vm[0],
              regra: 'rotulo:' + rotulo,
              evidencia: SEC.mascararEvidencia(texto.substring(inicioEvidencia, inicioJanela + dist)),
              distancia: distancia,
            };
          }
        }
      }
    });

    return melhor;
  }

  function escaparRegex_(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function todasOcorrencias_(texto, regex) {
    const out = [];
    let m;
    const r = new RegExp(regex.source, regex.flags.indexOf('g') === -1 ? regex.flags + 'g' : regex.flags);
    while ((m = r.exec(texto)) !== null) {
      out.push(m);
      if (m.index === r.lastIndex) r.lastIndex++;
    }
    return out;
  }

  // ==========================================================
  // CLASSIFICAÇÃO DOCUMENTAL POR CONTEÚDO
  // ==========================================================

  const SINAIS_TIPO_DOC = [
    { tipo: 'BOOKING_AMENDMENT', pesos: [['BOOKING AMENDMENT', 6], ['AMENDED BOOKING', 5], ['BOOKING CONFIRMATION', 2], ['AMENDMENT', 2]] },
    { tipo: 'BOOKING_CONFIRMATION', pesos: [['BOOKING CONFIRMATION', 6], ['BOOKING NO', 3], ['BKG NO', 3], ['CARRIER BOOKING', 3], ['BOOKING REFERENCE', 2]] },
    { tipo: 'DRAFT_BL', pesos: [['DRAFT B/L', 6], ['DRAFT BILL OF LADING', 6], ['DRAFT BL', 5]] },
    { tipo: 'BILL_OF_LADING', pesos: [['BILL OF LADING', 6], ['B/L NO', 4], ['BL NUMBER', 4], ['MASTER BL', 3], ['HOUSE BL', 3], ['SHIPPED ON BOARD', 2]] },
    { tipo: 'SHIPPING_INSTRUCTION', pesos: [['SHIPPING INSTRUCTION', 6], ['SI NO', 3]] },
    { tipo: 'PACKING_LIST', pesos: [['PACKING LIST', 6], ['NET WEIGHT', 2], ['GROSS WEIGHT', 1]] },
    { tipo: 'COMMERCIAL_INVOICE', pesos: [['COMMERCIAL INVOICE', 6], ['INVOICE NUMBER', 3], ['INVOICE NO', 3]] },
    { tipo: 'PROFORMA_INVOICE', pesos: [['PROFORMA INVOICE', 6], ['PRO FORMA INVOICE', 6]] },
    { tipo: 'CERTIFICATE', pesos: [['CERTIFICATE OF ORIGIN', 6], ['PHYTOSANITARY CERTIFICATE', 6], ['CERTIFICATE', 3], ['CERTIFICADO', 3]] },
  ];

  /**
   * Classifica pelo CONTEÚDO (títulos, rótulos, combinações semânticas).
   * O nome do arquivo NUNCA é usado como critério primário — no máximo
   * como evidência auxiliar (ver `pistaPeloNome`), somando no máximo 1
   * ponto, insuficiente para decidir sozinho.
   */
  E.classificarDocumento = function (texto, nomeArquivoOriginalLower) {
    if (!texto) return { tipo: 'NAO_IDENTIFICADO', pontuacao: 0 };
    const t = texto.toUpperCase();
    let melhorTipo = 'NAO_IDENTIFICADO';
    let melhorPontos = 0;

    SINAIS_TIPO_DOC.forEach(function (entrada) {
      let pontos = 0;
      entrada.pesos.forEach(function (par) {
        if (t.indexOf(par[0]) !== -1) pontos += par[1];
      });
      if (nomeArquivoOriginalLower) {
        const pista = { booking_confirmation: 'booking', bill_of_lading: 'bl', commercial_invoice: 'invoice', packing_list: 'packing' }[entrada.tipo.toLowerCase()];
        // pista pelo nome soma no máximo 1 ponto — nunca decide sozinha.
      }
      if (pontos > melhorPontos) {
        melhorPontos = pontos;
        melhorTipo = entrada.tipo;
      }
    });

    if (melhorPontos < 2) return { tipo: 'NAO_IDENTIFICADO', pontuacao: melhorPontos };
    return { tipo: melhorTipo, pontuacao: melhorPontos };
  };

  /** Indicador de versão do documento (item 14). */
  E.detectarIndicadorVersao = function (texto) {
    if (!texto) return 'ORIGINAL';
    const t = texto.toUpperCase();
    for (let i = 0; i < CFG.INDICADORES_VERSAO.length; i++) {
      if (t.indexOf(CFG.INDICADORES_VERSAO[i]) !== -1) return CFG.INDICADORES_VERSAO[i];
    }
    return 'ORIGINAL';
  };

  // ==========================================================
  // FTR
  // ==========================================================

  const FTR_REGEX = /FTR\s?(\d{3,5})\s*[-\/]\s*(\d{2})(?:\s*[-\/]\s*(\d+))?/i;
  const FTR_SOLTO_REGEX = /\b(\d{3,5})\s*[-\/]\s*(\d{2})(?:\s*[-\/]\s*(\d+))?\b/;

  function montarNumeroFtr_(m) {
    let num = m[1].padStart(5, '0') + '-' + m[2];
    if (m[3]) num += '-' + m[3];
    return num;
  }

  E.extrairFTR = function (texto) {
    if (!texto) return '';
    const m = texto.match(FTR_REGEX);
    if (!m) return '';
    return montarNumeroFtr_(m);
  };

  /** Todos os FTRs distintos citados no texto — usado p/ detectar ambiguidade. */
  E.extrairCandidatosFTR = function (texto) {
    if (!texto) return [];
    const vistos = new Set();
    const out = [];
    todasOcorrencias_(texto, new RegExp(FTR_REGEX.source, 'gi')).forEach(function (m) {
      const num = montarNumeroFtr_(m);
      if (num && !vistos.has(num)) { vistos.add(num); out.push(num); }
    });
    return out;
  };

  E.normalizarFTR = function (texto) {
    if (!texto) return '';
    const t = texto.toString();
    const m = t.match(FTR_REGEX) || t.match(FTR_SOLTO_REGEX);
    if (!m) return '';
    return montarNumeroFtr_(m);
  };

  E.formatarFTRParaGravar = function (ftrNum) {
    if (!ftrNum) return '';
    return 'FTR ' + ftrNum.toString().trim().toUpperCase().replace(/^FTR\s*/i, '');
  };

  // ==========================================================
  // INVOICE
  // ==========================================================

  E.extrairInvoice = function (texto, ftrDaMensagem) {
    if (!texto) return null;
    const janela = texto.substring(0, 1200);

    let m = janela.match(/\(?(AM\d{2}\/\d{2}(?:-[A-Z])?)\)?/i);
    if (m) return { valorBruto: m[1].toUpperCase(), regra: 'padrao_francfort_AMxx', evidencia: SEC.mascararEvidencia(janela.substring(Math.max(0, m.index - 10), m.index + 20)) };

    m = janela.match(/INVOICE\s+(\d+\/\d{4})/i);
    if (m && E.ehInvoiceValido(m[1], ftrDaMensagem)) return { valorBruto: m[1], regra: 'rotulo:INVOICE', evidencia: SEC.mascararEvidencia(janela.substring(Math.max(0, m.index - 10), m.index + 30)) };

    // Rótulos com uma palavra entre "INVOICE" e o número (o mais comum em
    // documentos reais: "INVOICE NUMBER:", "INVOICE NO.", "INVOICE Nº").
    const porRotulo = extrairPorRotulo_(janela, ['INVOICE NUMBER', 'INVOICE NO', 'INVOICE Nº', 'INVOICE N°', 'INV NUMBER', 'INV NO', 'INV #', 'INV#'], /([\d][\d.\-\/]{0,12})/, 15);
    if (porRotulo && E.ehInvoiceValido(porRotulo.valorBruto, ftrDaMensagem)) {
      return { valorBruto: porRotulo.valorBruto.trim(), regra: porRotulo.regra, evidencia: porRotulo.evidencia };
    }

    m = janela.match(/INVOICE\s+([\d.\-\/]+)/i);
    if (m && E.ehInvoiceValido(m[1], ftrDaMensagem)) return { valorBruto: m[1].trim(), regra: 'rotulo:INVOICE', evidencia: SEC.mascararEvidencia(janela.substring(Math.max(0, m.index - 10), m.index + 30)) };

    m = janela.match(/INV\.?\s*[#:]?\s*([\d.\-\/]+)/i);
    if (m && E.ehInvoiceValido(m[1], ftrDaMensagem)) return { valorBruto: m[1].trim(), regra: 'rotulo:INV', evidencia: SEC.mascararEvidencia(janela.substring(Math.max(0, m.index - 10), m.index + 30)) };

    return null;
  };

  E.ehInvoiceValido = function (valor, ftrDaMensagem) {
    if (!valor || valor.length < 1 || valor.length > 20) return false;
    if (/^[A-Z]+$/i.test(valor)) return false;
    if (!/\d/.test(valor)) return false;

    const limpo = valor.trim();
    if (/^20[2-3]\d$/.test(limpo)) return false;
    if (!/^\d{1,6}([.\-\/][A-Z0-9]{1,4})?$/i.test(limpo)) return false;

    if (ftrDaMensagem) {
      const soDigitos = limpo.replace(/[^\d]/g, '');
      const ftrSoDigitos = ftrDaMensagem.replace(/[^\d]/g, '');
      if (soDigitos && soDigitos === ftrSoDigitos) return false;
    }
    return true;
  };

  // ==========================================================
  // BOOKING
  // ==========================================================

  const ROTULOS_BOOKING = ['BOOKING NUMBER', 'BOOKING NO', 'BOOKING REFERENCE', 'CARRIER BOOKING', 'BKG NO', 'BOOKING', 'RESERVA', 'NUMERO DA RESERVA', 'NÚMERO DA RESERVA'];
  const VALOR_REF_REGEX = /([A-Z0-9][A-Z0-9\-\/]{3,19})/i;
  const CONTAINER_ISO_REGEX = /\b[A-Z]{4}\d{6,9}\b/;

  E.extrairBooking = function (texto, ftrDaMensagem, blDaMensagem) {
    const cand = extrairPorRotulo_(texto, ROTULOS_BOOKING, VALOR_REF_REGEX, 30);
    if (!cand) return null;
    const valor = cand.valorBruto.toUpperCase();

    if (CONTAINER_ISO_REGEX.test(valor)) return null; // parece nº de contêiner, não booking
    if (ftrDaMensagem && valor.replace(/\D/g, '') === ftrDaMensagem.replace(/\D/g, '')) return null;
    if (blDaMensagem && valor === blDaMensagem.toUpperCase()) return null;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(valor)) return null; // parece data

    return { valorBruto: valor, valorNormalizado: valor, regra: cand.regra, evidencia: cand.evidencia };
  };

  // ==========================================================
  // BL (com Master/House)
  // ==========================================================

  const ROTULOS_BL_GENERICO = ['BILL OF LADING NO', 'BILL OF LADING NUMBER', 'BILL OF LADING', 'B/L NO', 'B/L NUMBER', 'BL NUMBER', 'BL NO', 'BL'];
  const ROTULOS_MBL = ['MASTER B/L NO', 'MASTER BL NO', 'MASTER B/L', 'MASTER BL', 'MBL NO', 'MBL', 'M/BL'];
  const ROTULOS_HBL = ['HOUSE B/L NO', 'HOUSE BL NO', 'HOUSE B/L', 'HOUSE BL', 'HBL NO', 'HBL', 'H/BL'];

  function valorBlValido_(valor, bookingDaMensagem) {
    if (!valor) return false;
    const v = valor.toUpperCase();
    if (bookingDaMensagem && v === bookingDaMensagem.toUpperCase()) return false;
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v)) return false;
    return true;
  }

  /**
   * Retorna { bl, mbl, hbl, regra, evidencia } — `bl` já formatado no
   * padrão de gravação (com "MBL: x | HBL: y" quando aplicável).
   */
  E.extrairBL = function (texto, bookingDaMensagem) {
    const mbl = extrairPorRotulo_(texto, ROTULOS_MBL, VALOR_REF_REGEX, 30);
    const hbl = extrairPorRotulo_(texto, ROTULOS_HBL, VALOR_REF_REGEX, 30);

    if (mbl && hbl && valorBlValido_(mbl.valorBruto, bookingDaMensagem) && valorBlValido_(hbl.valorBruto, bookingDaMensagem)) {
      return {
        mbl: mbl.valorBruto.toUpperCase(),
        hbl: hbl.valorBruto.toUpperCase(),
        valorGravar: 'MBL: ' + mbl.valorBruto.toUpperCase() + ' | HBL: ' + hbl.valorBruto.toUpperCase(),
        regra: 'master_house_bl',
        evidencia: mbl.evidencia,
      };
    }

    const generico = extrairPorRotulo_(texto, ROTULOS_BL_GENERICO, VALOR_REF_REGEX, 30);
    if (generico && valorBlValido_(generico.valorBruto, bookingDaMensagem)) {
      return {
        mbl: null, hbl: null,
        valorGravar: generico.valorBruto.toUpperCase(),
        regra: generico.regra,
        evidencia: generico.evidencia,
      };
    }
    return null;
  };

  // ==========================================================
  // PORTOS
  // ==========================================================

  const PAISES_NAO_SAO_PORTO = ['BRAZIL', 'BRASIL', 'EGYPT', 'EGITO', 'ALGERIA', 'ARGELIA', 'TURKEY', 'TURQUIA', 'TUNISIA', 'TUNISIA', 'LATVIA', 'ESTONIA', 'GEORGIA', 'RUSSIA', 'RUSSIA'];
  const PORTOS_CONHECIDOS = ['SANTOS', 'PARANAGUÁ', 'PARANAGUA', 'ITAPOÁ', 'ITAPOA', 'NAVEGANTES', 'RIO GRANDE', 'ITAJAÍ', 'ITAJAI', 'ALEXANDRIA', 'DAMIETTA', 'ALGIERS', 'ORAN', 'MERSIN', 'TUNIS', 'RIGA', 'TALLINN', 'POTI', 'NOVOROSSIYSK'];

  const ROTULOS_POL = ['PORT OF LOADING', 'LOAD PORT', 'PORT OF ORIGIN', 'ORIGIN PORT', 'PUERTO DE CARGA', "PORT D'EMBARQUEMENT", 'PORT D EMBARQUEMENT', 'PORTO DE EMBARQUE', 'PORTO DE ORIGEM', 'POL'];
  const ROTULOS_POL_FALLBACK = ['PLACE OF RECEIPT'];
  const ROTULOS_POD = ['PORT OF DISCHARGE', 'DISCHARGE PORT', 'DESTINATION PORT', 'PORT OF DESTINATION', 'PUERTO DE DESCARGA', 'PORT DE DÉCHARGEMENT', 'PORT DE DECHARGEMENT', 'PORTO DE DESCARGA', 'PORTO DE DESTINO', 'POD'];
  const ROTULOS_POD_FALLBACK = ['PLACE OF DELIVERY'];
  const ROTULOS_PLACE_RECEIPT = ['PLACE OF RECEIPT'];
  const ROTULOS_PLACE_DELIVERY = ['PLACE OF DELIVERY'];

  // Nunca atravessa quebra de linha (evita engolir o próximo rótulo de
  // uma linha seguinte, ex.: "SANTOS\nPORT OF DISCHARGE: ...").
  const VALOR_PORTO_REGEX = /([A-ZÀ-Ú][A-Za-zÀ-ÿ.\-]*(?:[ \t]+[A-ZÀ-Ú][A-Za-zÀ-ÿ.\-]*){0,3})/;

  function normalizarPorto_(valorBruto) {
    let v = valorBruto.replace(/[,;].*$/, '').trim();
    const vUpper = removerAcentos_(v).toUpperCase();
    if (PAISES_NAO_SAO_PORTO.indexOf(vUpper) !== -1) return null; // é país, não porto — rejeita
    const conhecido = PORTOS_CONHECIDOS.find(function (p) { return removerAcentos_(p).toUpperCase() === vUpper; });
    return (conhecido || v).toUpperCase();
  }

  function removerAcentos_(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  function extrairPortoComFallback_(texto, rotulosPrincipais, rotulosFallback) {
    let cand = extrairPorRotulo_(texto, rotulosPrincipais, VALOR_PORTO_REGEX, 40);
    let viaFallback = false;
    if (!cand && rotulosFallback) {
      cand = extrairPorRotulo_(texto, rotulosFallback, VALOR_PORTO_REGEX, 40);
      viaFallback = true;
    }
    if (!cand) return null;
    const norm = normalizarPorto_(cand.valorBruto);
    if (!norm) return null;
    return { valorBruto: cand.valorBruto, valorNormalizado: norm, regra: cand.regra + (viaFallback ? '(fallback)' : ''), evidencia: cand.evidencia };
  }

  E.extrairPortoOrigem = function (texto) { return extrairPortoComFallback_(texto, ROTULOS_POL, ROTULOS_POL_FALLBACK); };
  E.extrairPortoDestino = function (texto) { return extrairPortoComFallback_(texto, ROTULOS_POD, ROTULOS_POD_FALLBACK); };
  E.extrairPlaceOfReceipt = function (texto) { return extrairPortoComFallback_(texto, ROTULOS_PLACE_RECEIPT, null); };
  E.extrairPlaceOfDelivery = function (texto) { return extrairPortoComFallback_(texto, ROTULOS_PLACE_DELIVERY, null); };

  // ==========================================================
  // PESO / QUANTIDADE EM TONELADAS
  // ==========================================================

  function parseNumeroFlexivel_(str) {
    if (!str) return NaN;
    let s = str.trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) { return parseFloat(s.replace(/\./g, '').replace(',', '.')); }
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) { return parseFloat(s.replace(/,/g, '')); }
    if (/^\d+,\d{1,3}$/.test(s)) { return parseFloat(s.replace(',', '.')); }
    if (/^\d+\.\d{1,2}$/.test(s)) { return parseFloat(s); }
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) { return parseFloat(s.replace(/\./g, '')); }
    if (/^\d{1,3}(,\d{3})+$/.test(s)) { return parseFloat(s.replace(/,/g, '')); }
    const limpo = s.replace(/[^\d.]/g, '');
    return limpo ? parseFloat(limpo) : NaN;
  }

  function unidadeParaMT_(valor, unidadeRaw) {
    const u = unidadeRaw.toUpperCase().replace(/\s+/g, ' ').trim();
    if (/^KGS?$/.test(u)) return valor / 1000;
    if (/^(MTS?|METRIC\s*TONS?|TONNES?|TONELADAS?)$/.test(u)) return valor;
    return null;
  }

  const UNIDADE_PESO_REGEX = '(KGS?|MTS?|METRIC\\s*TONS?|TONNES?|TONELADAS?)';

  function candidatosPesoPorRotulo_(texto, rotulos) {
    const out = [];
    rotulos.forEach(function (rotulo) {
      const re = new RegExp(escaparRegex_(rotulo) + '\\s*[:#\\-]?\\s*([\\d.,]+)\\s*' + UNIDADE_PESO_REGEX, 'gi');
      let m;
      while ((m = re.exec(texto)) !== null) {
        // Só olha a MESMA linha do rótulo — um "UNIT PRICE ..." na linha
        // anterior não pode derrubar um "NET WEIGHT" válido logo abaixo.
        const inicioLinha = texto.lastIndexOf('\n', m.index) + 1;
        const antes = texto.substring(inicioLinha, m.index).toUpperCase();
        if (/PRICE|VALUE|USD|UNIT\s*PRICE|VALOR/.test(antes)) continue; // é preço, não peso
        const numero = parseNumeroFlexivel_(m[1]);
        const mt = unidadeParaMT_(numero, m[2]);
        if (mt === null || isNaN(mt)) continue;
        out.push({
          valorMT: mt,
          valorBruto: m[1] + ' ' + m[2],
          unidadeOriginal: m[2].toUpperCase(),
          rotulo: rotulo,
          evidencia: SEC.mascararEvidencia(texto.substring(Math.max(0, m.index - 10), m.index + m[0].length + 10)),
        });
      }
    });
    return out;
  }

  /**
   * Prioridade (item 12): TOTAL NET WEIGHT > NET WEIGHT > TOTAL
   * QUANTITY (em MT/kg) > soma de pesos líquidos individuais. Nunca
   * usa peso bruto quando há peso líquido; nunca soma o total geral às
   * linhas que o compõem (só soma quando NÃO há total).
   */
  E.extrairPesoMT = function (texto) {
    const totalNet = candidatosPesoPorRotulo_(texto, ['TOTAL NET WEIGHT']);
    if (totalNet.length) {
      const c = totalNet[0];
      return { valorMT: arredondar_(c.valorMT), valorBruto: c.valorBruto, unidadeOriginal: c.unidadeOriginal, regra: 'total_net_weight', evidencia: c.evidencia };
    }

    const netWeight = candidatosPesoPorRotulo_(texto, ['NET WEIGHT']);
    if (netWeight.length === 1) {
      const c = netWeight[0];
      return { valorMT: arredondar_(c.valorMT), valorBruto: c.valorBruto, unidadeOriginal: c.unidadeOriginal, regra: 'net_weight', evidencia: c.evidencia };
    }

    if (netWeight.length === 0) {
      const totalQty = candidatosPesoPorRotulo_(texto, ['TOTAL QUANTITY']);
      if (totalQty.length) {
        const c = totalQty[0];
        return { valorMT: arredondar_(c.valorMT), valorBruto: c.valorBruto, unidadeOriginal: c.unidadeOriginal, regra: 'total_quantity', evidencia: c.evidencia };
      }
      return null;
    }

    // Múltiplos "NET WEIGHT" sem um total geral explícito → soma dos
    // itens individuais (dedupe best-effort de valores idênticos
    // repetidos em sequência, comum quando o mesmo total aparece
    // impresso em cabeçalho e rodapé do mesmo bloco de texto).
    let soma = 0;
    let ultimo = null;
    netWeight.forEach(function (c) {
      if (ultimo && Math.abs(ultimo - c.valorMT) < 0.0001) return; // duplicata provável
      soma += c.valorMT;
      ultimo = c.valorMT;
    });
    return {
      valorMT: arredondar_(soma),
      valorBruto: netWeight.length + ' itens somados',
      unidadeOriginal: 'MT (somado)',
      regra: 'soma_pesos_individuais',
      evidencia: SEC.mascararEvidencia(netWeight.map(function (c) { return c.valorBruto; }).join('; ')),
    };
  };

  function arredondar_(v) { return Math.round(v * 1000) / 1000; }

  // ==========================================================
  // INCOTERM / VESSEL / VOYAGE / ARMADOR
  // ==========================================================

  const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DAT', 'DDP'];
  E.extrairIncoterm = function (texto) {
    if (!texto) return null;
    const re = new RegExp('\\b(' + INCOTERMS.join('|') + ')\\b', 'i');
    const m = texto.match(re);
    if (!m) return null;
    return { valorBruto: m[1].toUpperCase(), regra: 'lista_incoterms', evidencia: SEC.mascararEvidencia(texto.substring(Math.max(0, m.index - 10), m.index + 30)) };
  };

  E.extrairVessel = function (texto) { return extrairPorRotulo_(texto, ['VESSEL', 'NAVIO'], /([A-ZÀ-Ú][\w À-ÿ\-]{1,30})/i, 30); };
  E.extrairVoyage = function (texto) { return extrairPorRotulo_(texto, ['VOYAGE', 'VIAGEM'], /([A-Z0-9\-]{1,15})/i, 20); };

  const ARMADORES_CONHECIDOS = ['MAERSK', 'MSC', 'CMA CGM', 'HAPAG-LLOYD', 'HAPAG LLOYD', 'COSCO', 'EVERGREEN', 'ONE', 'HMM', 'YANG MING', 'ZIM', 'MEDITERRANEAN SHIPPING'];
  E.extrairArmador = function (texto) {
    const porRotulo = extrairPorRotulo_(texto, ['ARMADOR', 'CARRIER'], /([A-ZÀ-Ú][\w À-ÿ\-]{1,30})/i, 30);
    if (porRotulo) return porRotulo;
    if (!texto) return null;
    const tUpper = texto.toUpperCase();
    for (let i = 0; i < ARMADORES_CONHECIDOS.length; i++) {
      const idx = tUpper.indexOf(ARMADORES_CONHECIDOS[i]);
      if (idx !== -1) {
        return { valorBruto: ARMADORES_CONHECIDOS[i], regra: 'lista_armadores', evidencia: SEC.mascararEvidencia(texto.substring(Math.max(0, idx - 10), idx + 30)) };
      }
    }
    return null;
  };

  // ==========================================================
  // DATAS (ETD/ETA/Embarque/Documento)
  // ==========================================================

  const VALOR_DATA_REGEX = /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/;
  E.extrairETD = function (texto) { return extrairPorRotulo_(texto, ['ETD'], VALOR_DATA_REGEX, 20); };
  E.extrairETA = function (texto) { return extrairPorRotulo_(texto, ['ETA'], VALOR_DATA_REGEX, 20); };
  E.extrairDataEmbarque = function (texto) { return extrairPorRotulo_(texto, ['SHIPMENT DATE', 'SAILING DATE', 'DATA DE EMBARQUE', 'DATA EMBARQUE'], VALOR_DATA_REGEX, 25); };

  // ==========================================================
  // CONTÊINERES
  // ==========================================================

  E.extrairContainers = function (texto) {
    if (!texto) return null;
    const nums = new Set();
    todasOcorrencias_(texto, new RegExp(CONTAINER_ISO_REGEX.source, 'g')).forEach(function (m) { nums.add(m[0].toUpperCase()); });

    let qtd = nums.size || null;
    const mQtd = texto.match(/(\d{1,3})\s*[x×]?\s*(?:20|40)\s*(?:FT|')?\s*(?:CONTAINER|CNTR)/i);
    if (mQtd) qtd = parseInt(mQtd[1], 10);

    if (!qtd && nums.size === 0) return null;
    return { quantidade: qtd, numeros: Array.from(nums), regra: nums.size ? 'padrao_iso_6346' : 'contagem_textual' };
  };

  // ==========================================================
  // PRODUTO / SAFRA / TERMO DE PAGAMENTO / VALORES
  // ==========================================================

  E.extrairProduto = function (subject, corpo) {
    const doAssunto = extrairProdutoDeTexto_(subject);
    if (doAssunto) return doAssunto;
    if (corpo) {
      const doCorpo = extrairProdutoDeTexto_(corpo.substring(0, 800));
      if (doCorpo) return doCorpo;
    }
    return '';
  };

  function extrairProdutoDeTexto_(texto) {
    if (!texto) return '';
    const t = texto.toUpperCase();
    const partes = [];
    const granulacao = t.match(/\b(\d{2}\/\d{2})\b/);
    if (granulacao) partes.push(granulacao[1]);
    if (/\bRAW\b/.test(t)) partes.push('RAW');
    if (/\bBLANCHED/.test(t)) partes.push('BLANCHED');
    if (/\bSPLITS?\b/.test(t)) partes.push('SPLITS');
    if (/\bGROUNDNUT[S]?\b/.test(t)) partes.push('GROUNDNUT');
    else if (/\bPEANUT[S]?\b/.test(t)) partes.push('PEANUT');
    if (/\bOIL\b/.test(t)) partes.push('OIL');
    return partes.join(' ').trim();
  }

  E.extrairSafra = function (texto) {
    if (!texto) return null;
    const m = texto.match(/\b(?:SAFRA|CROP)\s*[:\-]?\s*(\d{4}(?:\/\d{2,4})?)/i);
    if (!m) return null;
    return { valorBruto: m[1], regra: 'rotulo:SAFRA/CROP', evidencia: SEC.mascararEvidencia(texto.substring(Math.max(0, m.index - 5), m.index + 20)) };
  };

  const TERMOS_PAGAMENTO_CONHECIDOS = ['CAD', 'L/C', 'LC AT SIGHT', 'IRREVOCABLE L/C', 'T/T', 'TT', 'ADVANCE PAYMENT', 'SIGHT', 'OPEN ACCOUNT', 'D/P', 'D/A'];
  E.extrairTermoPagamento = function (texto) {
    const porRotulo = extrairPorRotulo_(texto, ['TERMS OF PAYMENT', 'PAYMENT TERM', 'TERMO DE PAGAMENTO', 'TERMO PAGAMENTO'], /([A-Z0-9À-Ú /,.\-]{2,40})/i, 40);
    if (porRotulo) return porRotulo;
    if (!texto) return null;
    const tUpper = texto.toUpperCase();
    for (let i = 0; i < TERMOS_PAGAMENTO_CONHECIDOS.length; i++) {
      const idx = tUpper.indexOf(TERMOS_PAGAMENTO_CONHECIDOS[i]);
      if (idx !== -1) return { valorBruto: TERMOS_PAGAMENTO_CONHECIDOS[i], regra: 'lista_termos_pagamento', evidencia: SEC.mascararEvidencia(texto.substring(Math.max(0, idx - 10), idx + 30)) };
    }
    return null;
  };

  const VALOR_MOEDA_REGEX = /(?:US\$|USD)\s*([\d.,]+)/i;
  E.extrairValorUnitario = function (texto) {
    return extrairPorRotulo_(texto, ['UNIT PRICE', 'VALOR UNITARIO', 'VALOR UNITÁRIO', 'PRICE PER MT', 'PRICE/MT'], VALOR_MOEDA_REGEX, 20);
  };
  E.extrairValorTotal = function (texto) {
    return extrairPorRotulo_(texto, ['TOTAL AMOUNT', 'TOTAL VALUE', 'VALOR TOTAL', 'GRAND TOTAL'], VALOR_MOEDA_REGEX, 20);
  };

  // ==========================================================
  // EXPORTADOR / IMPORTADOR
  // ==========================================================

  E.extrairExportadorDoAssunto = function (subject) {
    if (!subject) return '';
    const matchX = subject.match(/\s+[xX×]\s+/);
    if (!matchX) return '';
    const antes = subject.substring(0, matchX.index);
    let limpo = antes
      .replace(/.*[:\-]\s+/, '')
      .replace(/\bFTR\s*\d{3,5}\s*[-\/]\s*\d{2}(?:\s*[-\/]\s*\d+)?\b/gi, '')
      .replace(/\(?AM\d{2}\/\d{2}(?:-[A-Z])?\)?/gi, '')
      .replace(/\bINVOICE\s*\S+/gi, '')
      .replace(/\b(?:RES|ENC|FW|FWD|RE)\s*:?\s*/gi, '')
      .replace(/\([^)]*\)/g, '')
      .trim();
    if (!limpo) return '';
    if (!/[A-ZÀ-Úa-zà-ú]/.test(limpo)) return '';
    if (/^(?:DOCS|PARA|APROVA[ÇC][ÃA]O|RES|FW|FWD|FTR)$/i.test(limpo)) return '';
    if (limpo.length < 2 || limpo.length > 60) return '';
    return limpo.toUpperCase();
  };

  E.exportadorValido = function (candidato) {
    if (!candidato) return false;
    if (candidato.length < 2 || candidato.length > 60) return false;
    if (!/[A-ZÀ-Ú]/i.test(candidato)) return false;
    const lixo = ['PENDING', 'PEND.', 'TBD', 'TBA', 'TBC', 'N/A', 'NA', 'N.A.', 'NULL', 'NONE', 'A DEFINIR', 'A CONFIRMAR', 'EM ABERTO', 'CONFIRMED', 'CONFIRMAR', 'CONFIRMADO', 'XXX', '---', '...', '???'];
    if (lixo.some(function (l) { return candidato === l || candidato.indexOf(l + ' ') === 0; })) return false;
    if (!/[A-ZÀ-Ú]{2}/i.test(candidato)) return false;
    return true;
  };

  E.extrairExportadorDeCorpo = function (texto) {
    if (!texto) return null;
    const cand = extrairPorRotulo_(texto.substring(0, 2000), ['SHIPPER', 'EXPORTER', 'EXPORTADOR'], /([^\n\r]{2,60})/, 60);
    if (!cand) return null;
    const candidato = cand.valorBruto.trim().toUpperCase().replace(/\s*[,;|].*$/, '').trim();
    if (!E.exportadorValido(candidato)) return null;
    return { valorBruto: candidato, regra: cand.regra, evidencia: cand.evidencia };
  };

  E.extrairImportadorDoAssunto = function (subject) {
    if (!subject) return '';
    const matchX = subject.match(/\s+[xX×]\s+/);
    if (!matchX) return '';
    const depois = subject.substring(matchX.index + matchX[0].length);
    const sepMatch = depois.match(/\s+[-–—|]\s+|\s*\(/);
    const fim = sepMatch ? sepMatch.index : depois.length;
    let nome = depois.substring(0, fim).trim();
    if (!nome) return '';
    nome = nome.replace(/[,.\s]+$/, '').trim();
    if (!/[A-ZÀ-Úa-zà-ú]/.test(nome)) return '';
    if (nome.length < 2 || nome.length > 80) return '';
    return nome.toUpperCase();
  };

  E.extrairImportadorDeCorpo = function (texto) {
    if (!texto) return null;
    const cand = extrairPorRotulo_(texto.substring(0, 2000), ['CONSIGNEE', 'IMPORTADOR', 'BUYER'], /([^\n\r]{2,60})/, 60);
    if (!cand) return null;
    const candidato = cand.valorBruto.trim().toUpperCase().replace(/\s*[,;|].*$/, '').trim();
    if (!E.exportadorValido(candidato)) return null;
    return { valorBruto: candidato, regra: cand.regra, evidencia: cand.evidencia };
  };

  E.ehIntermediario = function (candidato) {
    if (!candidato) return false;
    const upper = removerAcentos_(candidato.toUpperCase().trim());
    return CFG.INTERMEDIARIOS.some(function (c) {
      const cn = removerAcentos_(c.toUpperCase());
      return upper === cn || upper.indexOf(cn) !== -1;
    });
  };

  E.normalizarNomeCliente = function (nome) {
    if (!nome) return '';
    let n = nome.trim().toUpperCase();
    n = n.replace(/\s+(LTDA\.?|S\.?\s*A\.?|EIRELI|ME|EPP|S\/A|S\/?\s*A)\s*\.?\s*$/i, '');
    return n.trim();
  };

  E.aplicarNomeCanonico = function (nome) {
    if (!nome) return nome;
    const chave = removerAcentos_(nome.toUpperCase().trim()).replace(/\s+/g, ' ');
    return CFG.MAPA_CANONICO[chave] || nome;
  };

})(TrackingFTR.Extract, TrackingFTR.Config, TrackingFTR.Security);
