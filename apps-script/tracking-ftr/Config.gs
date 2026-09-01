/**
 * ============================================================
 *  TRACKING FTR — Francfort  (v4.0.0 "Ingestão Documental")
 *  Arquivo: Config.gs
 * ============================================================
 *
 * Namespace: todo o projeto vive sob `var TrackingFTR = TrackingFTR || {}`
 * (nunca `const`/`let` no escopo global) para poder coexistir com
 * QUALQUER outro arquivo .gs no mesmo projeto Apps Script (ex.:
 * automacao.gs) sem risco de "Identifier has already been declared"
 * nem de sobrescrita silenciosa de função por ordem de concatenação.
 * Apenas os wrappers em Triggers.gs — com nomes prefixados
 * `trackingFtr...` — são expostos como função global de verdade,
 * porque é o único jeito de um trigger/menu do Apps Script encontrar
 * a função pelo nome.
 *
 * VERSÃO: mantida em UM único lugar (TrackingFTR.VERSION) e referenciada
 * em todo log/diagnóstico — evita o que aconteceu nas versões antigas,
 * em que o comentário do cabeçalho dizia v3.4 mas o texto de log dizia
 * v3.2 em funções diferentes.
 */

var TrackingFTR = TrackingFTR || {};

TrackingFTR.VERSION = '4.0.0';

TrackingFTR.Config = {

  // ----------------------------------------------------------
  // Planilha
  // ----------------------------------------------------------
  PLANILHA_ID: '1mpioj911veJtqs0Xx2umDx42o5q9iv-b_-8vdhNrLio',
  PLANILHA_ABA: 'TRACKING 2026',
  ABA_LOG: 'LOG_EXTRAÇÃO',
  LINHA_INICIAL: 2,
  LINHA_CABECALHO: 1,

  // ----------------------------------------------------------
  // Busca de threads
  // ----------------------------------------------------------
  LABEL_PROCESSADO: 'FTR/_processado',
  DIAS_BUSCA_PADRAO: 90,
  FOLGA_WATERMARK_DIAS: 1,
  MAX_THREADS_POR_EXECUCAO: 60,
  MAX_MSGS_HISTORICO_THREAD: 25, // limite de mensagens antigas revisitadas por thread

  // ----------------------------------------------------------
  // Orçamento de tempo / lote (Apps Script mata a execução ~6 min)
  // ----------------------------------------------------------
  LIMITE_SEGUNDOS_EXECUCAO: 300,
  MARGEM_SEGURANCA_SEGUNDOS: 20,
  MAX_OPERACOES_OCR_POR_EXECUCAO: 15,
  MAX_ANEXOS_POR_THREAD: 12,
  MAX_ANEXO_BYTES: 25 * 1024 * 1024, // 25MB — acima disso, anexo é ignorado com log de rejeição

  // ----------------------------------------------------------
  // Propriedades persistentes (chaves)
  // ----------------------------------------------------------
  PROP_WATERMARK: 'TRACKING_FTR_LAST_RUN_TS',
  PROP_CHECKPOINT: 'TRACKING_FTR_CHECKPOINT_V1',
  PROP_TEMP_FOLDER_ID: 'TRACKING_FTR_TEMP_FOLDER_ID',
  PROP_HASHES_PROCESSADOS: 'TRACKING_FTR_ATTACHMENT_HASHES', // fallback; uso principal é CacheService
  CACHE_PREFIX_HASH: 'tftr_h_',
  CACHE_TTL_HASH_SEGUNDOS: 6 * 60 * 60, // 6h — deduplicação de anexos idênticos entre execuções próximas

  // ----------------------------------------------------------
  // Pasta temporária controlada (OCR / conversões)
  // ----------------------------------------------------------
  PASTA_TEMP_NOME: 'TrackingFTR_TMP_DO_NOT_SHARE',
  RETENCAO_TEMP_HORAS: 2, // qualquer temporário órfão com mais que isso é elegível a limpeza

  // ----------------------------------------------------------
  // OCR
  // ----------------------------------------------------------
  OCR_IDIOMAS_PRIORIDADE: ['pt', 'en', 'es', 'fr'],
  OCR_MAX_TENTATIVAS_IDIOMA: 2, // limite de custo: só tenta os N primeiros idiomas da lista acima
  OCR_MIN_CARACTERES_TEXTO_VALIDO: 40,

  // ----------------------------------------------------------
  // Tipos de anexo aceitos (MIME é a fonte de verdade; extensão é só apoio)
  // ----------------------------------------------------------
  MIME_ACEITOS: {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/vnd.ms-excel': 'XLS',
    'text/csv': 'CSV',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/msword': 'DOC',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/tiff': 'TIFF',
  },

  // ----------------------------------------------------------
  // Retenção / auditoria
  // ----------------------------------------------------------
  RETENCAO_LOG_DIAS: 180,
  EVIDENCIA_MAX_CHARS: 90,

  // ----------------------------------------------------------
  // Execução concorrente
  // ----------------------------------------------------------
  LOCK_TIMEOUT_MS: 30 * 1000,

  // ----------------------------------------------------------
  // Intermediários (não podem virar IMPORTADOR)
  // ----------------------------------------------------------
  INTERMEDIARIOS: [
    'EXXTRADE', 'CAMAP', 'GM OLEOS', 'GM ÓLEOS', 'AVR TRADING', 'AVR',
    'FRANCFORT', 'CALIXTO FOODS', 'CALIXTO', 'AMENDOGRÃOS', 'AMENDOGRAOS',
    'TEKNOFERT', 'GRÃOS UNIÃO', 'GRAOS UNIAO', 'POMPEIA',
  ],

  // ----------------------------------------------------------
  // Canonicalização de nomes (grafias variantes do mesmo cliente)
  // ----------------------------------------------------------
  MAPA_CANONICO: {
    'MINEK': 'MINEKS',
    'MINEKS': 'MINEKS',
    'BEST FOOD': 'BEST FOODS',
    'BEST FOODS': 'BEST FOODS',
    'BEST FOO': 'BEST FOODS',
  },

  KEYWORDS_DOC_OFICIAL: [
    'INVOICE', 'BOOKING', 'DOCS PARA APROVAÇÃO', 'DOCS PARA APROVACAO',
    'BL', 'BILL OF LADING', 'PACKING LIST', 'CERTIFICATE', 'CERTIFICADO',
    'INSURANCE', 'SEGURO', 'CONFIRMAÇÃO', 'CONFIRMACAO', 'CONFIRMATION',
    'SHIPPING INSTRUCTION', 'DRAFT BL',
  ],
  EXTENSOES_ANEXO: ['.pdf', '.xlsx', '.xls', '.csv', '.docx', '.doc', '.png', '.jpg', '.jpeg', '.tif', '.tiff'],

  // ----------------------------------------------------------
  // Mapa de colunas dinâmicas (aliases de cabeçalho -> chave lógica)
  // Chaves cujo valor é `criarSeAusente: true` são criadas automaticamente
  // ao final da planilha se nenhum alias for encontrado; as demais são
  // simplesmente ignoradas na gravação (não criamos colunas fora do
  // estritamente pedido pelo item 16 do briefing: apenas PORTO ORIGEM e BL).
  // ----------------------------------------------------------
  CAMPOS_PLANILHA: {
    FTR:                { aliases: ['FTR'], criarSeAusente: false },
    INVOICE:            { aliases: ['INVOICE', 'NUMERO INVOICE', 'NUMERO DA INVOICE'], criarSeAusente: false },
    DATA:               { aliases: ['DATA'], criarSeAusente: false },
    EXPORTADOR:         { aliases: ['EXPORTADOR'], criarSeAusente: false },
    IMPORTADOR:         { aliases: ['IMPORTADOR'], criarSeAusente: false },
    DESTINO:            { aliases: ['DESTINO'], criarSeAusente: false },
    PORTO_ORIGEM:       { aliases: ['PORTO ORIGEM', 'PORTO DE ORIGEM', 'PORT OF LOADING', 'POL'], criarSeAusente: true, headerCriacao: 'PORTO ORIGEM' },
    POD:                { aliases: ['POD', 'PORT OF DISCHARGE', 'PORTO DESTINO', 'PORTO DE DESTINO'], criarSeAusente: false },
    INCOTERM:           { aliases: ['INCOTERM'], criarSeAusente: false },
    PRODUTO:            { aliases: ['PRODUTO'], criarSeAusente: false },
    SAFRA:              { aliases: ['SAFRA'], criarSeAusente: false },
    MT:                 { aliases: ['MT', 'TONELADAS', 'QUANTIDADE MT'], criarSeAusente: false },
    TERMO_PAGAMENTO:    { aliases: ['TERMO PAGAMENTO', 'TERMO DE PAGAMENTO'], criarSeAusente: false },
    VALOR_UNIT:         { aliases: ['VALOR UNITARIO', 'VALOR UNITÁRIO'], criarSeAusente: false },
    VALOR_TOTAL:        { aliases: ['VALOR TOTAL'], criarSeAusente: false },
    DATA_EMBARQUE:      { aliases: ['DATA EMBARQUE', 'DATA DE EMBARQUE'], criarSeAusente: false },
    BOOKING:            { aliases: ['BOOKING', 'BOOKING NO', 'BOOKING NUMBER'], criarSeAusente: false },
    BL:                 { aliases: ['BL', 'B/L', 'BL NUMBER', 'BILL OF LADING', 'NUMERO BL', 'NÚMERO BL'], criarSeAusente: true, headerCriacao: 'BL' },
    ETD:                { aliases: ['ETD'], criarSeAusente: false },
    ETA:                { aliases: ['ETA'], criarSeAusente: false },
    NAVIO:              { aliases: ['NAVIO', 'VESSEL'], criarSeAusente: false },
    VOYAGE:             { aliases: ['VOYAGE', 'VIAGEM'], criarSeAusente: false },
    ARMADOR:            { aliases: ['ARMADOR', 'CARRIER'], criarSeAusente: false },
    CONTAINERS_QTD:     { aliases: ['QTD CONTAINERS', 'QUANTIDADE CONTEINERES', 'CONTAINERS QTD'], criarSeAusente: false },
    CONTAINERS_NUMS:    { aliases: ['NUMEROS CONTAINERS', 'NÚMEROS CONTAINERS'], criarSeAusente: false },
    PLACE_OF_RECEIPT:   { aliases: ['PLACE OF RECEIPT'], criarSeAusente: false },
    PLACE_OF_DELIVERY:  { aliases: ['PLACE OF DELIVERY'], criarSeAusente: false },
    AUTO_SYNC:          { aliases: ['AUTO_SYNC'], criarSeAusente: false },
    STATUS_EXTRACAO:    { aliases: ['STATUS EXTRACAO', 'STATUS EXTRAÇÃO'], criarSeAusente: false },
    FONTE_EXTRACAO:     { aliases: ['FONTE EXTRACAO', 'FONTE EXTRAÇÃO'], criarSeAusente: false },
    CONFIANCA:          { aliases: ['CONFIANCA', 'CONFIANÇA'], criarSeAusente: false },
    OBSERVACAO:         { aliases: ['OBSERVACAO', 'OBSERVAÇÃO'], criarSeAusente: false },
  },

  // Fallback de índice fixo (1-indexed) — só usado se a coluna não for
  // localizada por cabeçalho E o campo for um dos 6 historicamente
  // preenchidos pelo indexador antigo. Preserva compatibilidade com a
  // planilha em produção enquanto o cabeçalho real não for confirmado.
  INDICE_LEGADO_FALLBACK: {
    FTR: 1, INVOICE: 2, DATA: 3, EXPORTADOR: 4, IMPORTADOR: 5, PRODUTO: 9, AUTO_SYNC: 40,
  },

  MARCADOR_REVISAR: 'REVISAR',
  MARCADOR_AUTO_SYNC: 'AUTO_SYNC',
};

/**
 * Regras de confiança por campo (item 13 do briefing). Cada entrada é a
 * ordem de prioridade de TIPO DOCUMENTAL para aquele campo — usada por
 * Resolver.gs para decidir qual candidato vence quando há mais de um.
 */
TrackingFTR.Config.HIERARQUIA_CONFIANCA = {
  BOOKING: ['BOOKING_CONFIRMATION', 'BOOKING_AMENDMENT', 'BILL_OF_LADING', 'EMAIL'],
  BL: ['BILL_OF_LADING', 'DRAFT_BL', 'SHIPPING_INSTRUCTION', 'EMAIL'],
  PORTO_ORIGEM: ['BILL_OF_LADING', 'BOOKING_CONFIRMATION', 'BOOKING_AMENDMENT', 'DRAFT_BL', 'SHIPPING_INSTRUCTION', 'COMMERCIAL_INVOICE', 'PROFORMA_INVOICE', 'EMAIL'],
  POD: ['BILL_OF_LADING', 'BOOKING_CONFIRMATION', 'BOOKING_AMENDMENT', 'DRAFT_BL', 'SHIPPING_INSTRUCTION', 'COMMERCIAL_INVOICE', 'PROFORMA_INVOICE', 'EMAIL'],
  MT: ['PACKING_LIST', 'COMMERCIAL_INVOICE', 'BILL_OF_LADING', 'BOOKING_CONFIRMATION', 'BOOKING_AMENDMENT', 'EMAIL'],
  INVOICE: ['COMMERCIAL_INVOICE', 'PROFORMA_INVOICE', 'EMAIL'],
};

/** Indicadores textuais de nova versão de documento (item 14). */
TrackingFTR.Config.INDICADORES_VERSAO = [
  'AMENDMENT', 'AMENDED', 'REVISED', 'REVISION', 'UPDATED', 'UPDATE',
  'ALTERAÇÃO', 'ALTERACAO', 'CORREÇÃO', 'CORRECAO', 'V2', 'V3', 'FINAL',
  'NEW BOOKING', 'SPLIT', 'ROLLOVER',
];
