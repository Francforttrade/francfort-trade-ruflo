const logger = require('../../utils/logger');
const CONFIG = require('../../config');
const excecoes = require('../excecoes');
const { MAX_RETRIES } = require('../excecoes/backoff');
const { computeContentHash } = require('./contentHash');
const { isStructuredMimeType, extractStructuredFile } = require('./structuredFileExtractor');
const { detectTextLayer } = require('./textLayerDetector');
const { classifyDocument } = require('./docClassifier');
const { decideInitialTier, isOcrEligibleMimeType } = require('./costTiering');
const { extractFields } = require('./extractors');
const { scoreConfidence } = require('./confidenceScoring');
const { validateExtraction } = require('./crossValidation');
const { resolveEntity } = require('./entityResolution');
const { pickErrorCode, buildErrorMessage } = require('./errorCodes');
const { getCached, setCached } = require('./dedupCache');
const { isUnderPaidCallCap, recordPaidCall } = require('./rateLimiter');
const { runOcr } = require('./ocrClient');
const { runDocumentAi } = require('./documentAiClient');

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

// Tries PaddleOCR (chunk 2a) for a scanned image or a PDF with no usable
// text layer: dedup cache first (skip paying for OCR on a re-sent
// attachment), then the per-FTR/per-day call cap, then the worker itself.
// Mutates nothing — returns {extractedText, tableRows, extractionMethod,
// failureReason, costTier} so the caller decides what to do next.
// costTier reflects what was actually incurred: 'free' whenever the worker
// was never actually called (ineligible mimeType, cache hit, capped), and
// 'cheap' whenever it was, whether or not the call itself succeeded.
async function tryOcr({ ftrCode, contentHash, mimeType, fileBase64 }) {
	if (!isOcrEligibleMimeType(mimeType)) {
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: null, costTier: 'free' };
	}

	const cached = await getCached(contentHash);
	if (cached) {
		return {
			extractedText: cached.extractedText,
			tableRows: cached.tableRows,
			extractionMethod: 'cache_hit',
			failureReason: null,
			costTier: 'free',
		};
	}

	if (!(await isUnderPaidCallCap('paddle', ftrCode))) {
		logger.warn('DIGITALIZACAO: teto de chamadas de OCR atingido, degradando para revisão manual', { ftrCode });
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: null, costTier: 'free' };
	}

	const ocrResult = await runOcr({ fileBase64, mimeType });
	if (ocrResult === undefined) {
		// PADDLE_OCR_SERVICE_URL isn't configured — never attempted, so no
		// paid-call slot was spent and no cost was incurred.
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: null, costTier: 'free' };
	}
	await recordPaidCall('paddle', ftrCode);

	if (!ocrResult || !ocrResult.text) {
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: 'ocr_failed', costTier: 'cheap' };
	}
	if (ocrResult.confidence != null && ocrResult.confidence < CONFIG.DIGITALIZACAO.OCR_MIN_CONFIDENCE) {
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: 'ocr_low_confidence', costTier: 'cheap' };
	}

	await setCached(contentHash, { extractedText: ocrResult.text, tableRows: null }, ftrCode);
	return { extractedText: ocrResult.text, tableRows: null, extractionMethod: 'vision_ocr', failureReason: null, costTier: 'cheap' };
}

// Chunk 2b — Document AI, the "expensive" tier. Only ever called when
// tryOcr() above genuinely attempted PaddleOCR and it didn't pan out
// (fileFailureReason is 'ocr_failed'/'ocr_low_confidence') — never when
// Paddle was merely skipped (ineligible mimeType, cache hit, rate-capped),
// since falling through to the pricier tier just because the cheaper one
// was throttled would defeat the point of the cap. Mirrors tryOcr()'s
// return shape so index.js's caller doesn't need to know which tier ran.
async function tryDocumentAi({ ftrCode, contentHash, mimeType, fileBase64 }) {
	if (!CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID) {
		// Not provisioned (docs/DEPLOY.md item 8's documented default state) —
		// skip the two Firestore reads a cap check would cost on every single
		// Paddle failure for a tier that will never be attempted anyway.
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: null, costTier: 'cheap' };
	}

	if (!(await isUnderPaidCallCap('document_ai', ftrCode))) {
		logger.warn('DIGITALIZACAO: teto de chamadas de Document AI atingido, degradando para revisão manual', { ftrCode });
		// Paddle was already attempted to get here, so some cost was
		// incurred even though Document AI itself was skipped.
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: null, costTier: 'cheap' };
	}

	const result = await runDocumentAi({ fileBase64, mimeType });
	if (result === undefined) {
		// DOCUMENT_AI_PROCESSOR_ID/GCP_PROJECT_ID isn't configured — never
		// attempted. Paddle was already attempted to get here, so 'cheap' (not
		// 'free') is still the accurate cost tier for this call.
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: null, costTier: 'cheap' };
	}
	await recordPaidCall('document_ai', ftrCode);

	if (!result || !result.text) {
		return { extractedText: null, tableRows: null, extractionMethod: null, failureReason: 'document_ai_failed', costTier: 'expensive' };
	}
	if (result.confidence != null && result.confidence < CONFIG.DIGITALIZACAO.DOCUMENT_AI_MIN_CONFIDENCE) {
		return {
			extractedText: null,
			tableRows: null,
			extractionMethod: null,
			failureReason: 'document_ai_low_confidence',
			costTier: 'expensive',
		};
	}

	await setCached(contentHash, { extractedText: result.text, tableRows: null }, ftrCode);
	return { extractedText: result.text, tableRows: null, extractionMethod: 'document_ai', failureReason: null, costTier: 'expensive' };
}

// DIGITALIZACAO: classify + extract structured fields from an incoming
// document, cheapest option first (structured-file parse > PDF text layer >
// PaddleOCR, chunk 2a > Document AI, chunk 2b), then cross-validate against
// known business rules/records and resolve it against any FTR entity it
// should link to (chunk 3), applying the 4-band confidence policy from
// docs/RDIA_PRD.md and escalating to EXCECOES with a specific error code
// whenever it needs human review.
async function process(context) {
	const { ftrCode, filename, mimeType, fileBase64, docTypeHint, market } = context;
	const contentHash = computeContentHash(fileBase64);

	let extractedText = null;
	let tableRows = null;
	let extractionMethod = null;
	let costTierUsed = null;
	let fileFailureReason = null;
	// Only set once tryOcr() actually runs — stays null for a
	// corrupted/password-protected file, since those are diagnosed before
	// OCR is ever attempted and never incur its cost either way.
	let ocrCostTier = null;

	if (isStructuredMimeType(mimeType)) {
		const structured = await extractStructuredFile({ fileBase64, mimeType });
		if (structured) {
			extractedText = structured.text;
			tableRows = structured.tableRows;
			extractionMethod = 'structured_file';
			costTierUsed = 'free';
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
			costTierUsed = 'free';
		} else {
			fileFailureReason = textLayer.failureReason;
		}
	}

	if (!extractionMethod && !fileFailureReason) {
		const ocr = await tryOcr({ ftrCode, contentHash, mimeType, fileBase64 });
		ocrCostTier = ocr.costTier;
		if (ocr.extractionMethod) {
			extractedText = ocr.extractedText;
			tableRows = ocr.tableRows;
			extractionMethod = ocr.extractionMethod;
			costTierUsed = ocr.costTier;
		} else {
			fileFailureReason = ocr.failureReason;
		}
	}

	// Escalate to Document AI only when Paddle was genuinely attempted and
	// didn't work out — not when it was merely skipped (see tryDocumentAi's
	// comment for why that distinction matters for cost control).
	if (!extractionMethod && (fileFailureReason === 'ocr_failed' || fileFailureReason === 'ocr_low_confidence')) {
		const documentAi = await tryDocumentAi({ ftrCode, contentHash, mimeType, fileBase64 });
		ocrCostTier = documentAi.costTier;
		if (documentAi.extractionMethod) {
			extractedText = documentAi.extractedText;
			tableRows = documentAi.tableRows;
			extractionMethod = documentAi.extractionMethod;
			costTierUsed = documentAi.costTier;
			fileFailureReason = null;
		} else if (documentAi.failureReason) {
			fileFailureReason = documentAi.failureReason;
		}
		// else: Document AI was never actually attempted (not configured, or
		// rate-capped) — keep Paddle's own ocr_failed/ocr_low_confidence
		// reason instead of wiping it out with a null that would misreport
		// as the generic OCR_NOT_AVAILABLE.
	}

	if (!extractionMethod) {
		// costTierUsed is only ever set alongside extractionMethod in the
		// branches above, so reaching here means it's still null. Report
		// whatever the last tier actually attempted incurred — 'free' if
		// nothing paid was ever called (ineligible mimeType, cache hit,
		// capped, or a corrupted/password-protected file diagnosed before
		// any OCR attempt), 'cheap'/'expensive' if Paddle/Document AI ran
		// but didn't pan out.
		const costTier = ocrCostTier || 'free';
		const code = pickErrorCode({ extractionMethod: null, fileFailureReason });
		logger.warn('DIGITALIZACAO: sem camada de texto/estrutura utilizável — marcando para revisão', {
			ftrCode,
			mimeType,
			costTier,
			code,
		});
		await escalate({ ftrCode, code, detail: `mimeType=${mimeType}, reason=${fileFailureReason || 'none'}` });
		return { ...buildUnresolvedResult({ ftrCode, contentHash, costTier }), escalated_to_excecoes: true };
	}

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
		cost_tier_used: costTierUsed,
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
