const logger = require('../../utils/logger');
const CONFIG = require('../../config');
const excecoes = require('../excecoes');
const { MAX_RETRIES } = require('../excecoes/backoff');
const { computeContentHash } = require('./contentHash');
const { isStructuredMimeType, extractStructuredFile } = require('./structuredFileExtractor');
const { detectTextLayer } = require('./textLayerDetector');
const { classifyDocument } = require('./docClassifier');
const { decideInitialTier } = require('./costTiering');
const { extractFields } = require('./extractors');
const { scoreConfidence } = require('./confidenceScoring');
const { validateExtraction } = require('./crossValidation');
const { resolveEntity } = require('./entityResolution');
const { pickErrorCode, buildErrorMessage } = require('./errorCodes');

// Informational only — DIGITALIZACAO never calls these agents itself (see
// docs/RDIA_PRD.md's reconciliation of §14 and the original deadlock
// analysis: withFtrLock is not reentrant). The caller uses this to decide
// the next master.route() call, once this one has returned and released
// its lock.
const ROUTED_TO_BY_DOC_TYPE = {
	LabReport: 'qualidade',
	BL: 'documentacao',
	CO: 'documentacao',
	Phyto: 'documentacao',
	Invoice: 'documentacao',
	SWIFT: 'financeiro',
	Contract: 'contratos',
	ACID: 'compliance',
	ImportPermit: 'compliance',
};

const CONFIDENCE_THRESHOLDS = {
	autoAccept: CONFIG.DIGITALIZACAO.CONFIDENCE_AUTO_ACCEPT,
	acceptFlagged: CONFIG.DIGITALIZACAO.CONFIDENCE_ACCEPT_FLAGGED,
	reviewRequired: CONFIG.DIGITALIZACAO.CONFIDENCE_REVIEW_REQUIRED,
};

// A DLQ/escalation-worthy condition here is never transient — re-running the
// same document through the same regex/classifier would produce the exact
// same result, so retrying is pointless. Passing MAX_RETRIES short-circuits
// EXCECOES straight to DLQ + escalation (see excecoes/backoff.js's
// shouldRetry) instead of scheduling a retry that can't help.
async function escalate({ ftrCode, code, detail }) {
	await excecoes.process({
		action: 'record_failure',
		ftrCode,
		agent: 'digitalizacao',
		errorMsg: buildErrorMessage(code, detail),
		retryCount: MAX_RETRIES,
	});
}

function buildUnresolvedResult({ ftrCode, contentHash, costTier }) {
	return {
		agent: 'digitalizacao',
		ftr_code: ftrCode,
		content_hash: contentHash,
		classified_doc_type: null,
		classification_confidence: 0,
		extraction_method: null,
		cost_tier_used: costTier,
		extracted_fields: {},
		field_confidence: {},
		overall_confidence: 0,
		confidence_band: 'candidate_only',
		cross_validation: [],
		relationship: null,
		needs_review: true,
		escalated_to_excecoes: false,
		routed_to: null,
	};
}

// DIGITALIZACAO: classify + extract structured fields from an incoming
// document, cheapest option first (structured-file parse > PDF text layer >
// OCR), then cross-validate against known business rules/records and
// resolve it against any FTR entity it should link to. Chunk 1 wired the
// zero-cost extraction paths; this chunk (3) adds cross-validation, entity
// resolution and the 4-band confidence policy from docs/RDIA_PRD.md.
// A scanned image or a PDF with no text layer is recognized but not yet
// extracted (OCR arrives in chunk 2a/2b) — it comes back with
// needs_review: true and an OCR_NOT_AVAILABLE escalation instead of failing.
async function process(context) {
	const { ftrCode, filename, mimeType, fileBase64, docTypeHint, market } = context;
	const contentHash = computeContentHash(fileBase64);

	let extractedText = null;
	let tableRows = null;
	let extractionMethod = null;
	let fileFailureReason = null;

	if (isStructuredMimeType(mimeType)) {
		const structured = await extractStructuredFile({ fileBase64, mimeType });
		if (structured) {
			extractedText = structured.text;
			tableRows = structured.tableRows;
			extractionMethod = 'structured_file';
		} else {
			// extractStructuredFile returns null only when XLSX.read/mammoth
			// itself failed to parse the bytes — a corrupted file, not a
			// missing OCR worker (OCR wouldn't help a broken spreadsheet
			// anyway).
			fileFailureReason = 'corrupted';
		}
	}

	if (!extractionMethod && mimeType === 'application/pdf') {
		const textLayer = await detectTextLayer(fileBase64);
		if (textLayer.hasTextLayer) {
			extractedText = textLayer.extractedText;
			extractionMethod = 'text_layer';
		} else {
			fileFailureReason = textLayer.failureReason;
		}
	}

	if (!extractionMethod) {
		const costTier = decideInitialTier({ hasStructuredData: false, hasTextLayer: false });
		const code = pickErrorCode({ extractionMethod: null, fileFailureReason });
		logger.warn('DIGITALIZACAO: sem camada de texto/estrutura utilizável — marcando para revisão', {
			ftrCode,
			mimeType,
			costTier,
			code,
		});
		await escalate({ ftrCode, code, detail: `mimeType=${mimeType}` });
		return { ...buildUnresolvedResult({ ftrCode, contentHash, costTier }), escalated_to_excecoes: true };
	}

	const costTier = decideInitialTier({ hasStructuredData: extractionMethod === 'structured_file', hasTextLayer: true });
	const classification = classifyDocument({ filename, text: extractedText, docTypeHint });
	const extractedFields = extractFields(classification.docType, {
		text: extractedText,
		filename,
		tableRows,
		market,
	});

	const crossValidation = await validateExtraction({
		ftrCode,
		classifiedDocType: classification.docType,
		extractedFields,
		market,
	});
	const relationship = await resolveEntity({ ftrCode, classifiedDocType: classification.docType, extractedFields });

	const {
		field_confidence: fieldConfidence,
		overall_confidence: overallConfidence,
		confidence_band: confidenceBand,
		needs_review: needsReview,
		has_field_conflict: hasFieldConflict,
		has_entity_ambiguous: hasEntityAmbiguous,
	} = scoreConfidence({
		classification,
		extractedFields,
		crossValidation,
		entityStatus: relationship && relationship.status,
		thresholds: CONFIDENCE_THRESHOLDS,
	});

	const result = {
		agent: 'digitalizacao',
		ftr_code: ftrCode,
		content_hash: contentHash,
		classified_doc_type: classification.docType,
		classification_confidence: classification.confidence,
		extraction_method: extractionMethod,
		cost_tier_used: costTier,
		extracted_fields: extractedFields,
		field_confidence: fieldConfidence,
		overall_confidence: overallConfidence,
		confidence_band: confidenceBand,
		cross_validation: crossValidation,
		relationship,
		needs_review: needsReview,
		escalated_to_excecoes: false,
		routed_to: classification.docType ? ROUTED_TO_BY_DOC_TYPE[classification.docType] || null : null,
	};

	if (needsReview) {
		const code = pickErrorCode({
			hasFieldConflict,
			hasEntityAmbiguous,
			extractionMethod,
			confidenceBand,
		});

		logger.warn('DIGITALIZACAO: revisão necessária, escalando para EXCECOES', {
			ftrCode,
			classifiedDocType: classification.docType,
			confidenceBand,
			code,
		});

		if (code) {
			await escalate({
				ftrCode,
				code,
				detail: JSON.stringify({ classifiedDocType: classification.docType, confidenceBand, crossValidation }),
			});
			result.escalated_to_excecoes = true;
		}
	}

	return result;
}

module.exports = { process, ROUTED_TO_BY_DOC_TYPE };
