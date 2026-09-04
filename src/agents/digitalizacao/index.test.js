const { PDFDocument, StandardFonts } = require('pdf-lib');
const XLSX = require('xlsx');
const CONFIG = require('../../config');

const FTR_MATCH_CHECK = [{ check: 'ftr_code_exists_in_supabase', result: 'match', detail: {} }];

jest.mock('../excecoes', () => ({ process: jest.fn().mockResolvedValue({ agent: 'excecoes' }) }));
jest.mock('./crossValidation', () => ({ validateExtraction: jest.fn() }));
jest.mock('./entityResolution', () => ({ resolveEntity: jest.fn() }));
jest.mock('./dedupCache', () => ({ getCached: jest.fn(), setCached: jest.fn() }));
jest.mock('./rateLimiter', () => ({ isUnderPaidCallCap: jest.fn(), recordPaidCall: jest.fn() }));
jest.mock('./ocrClient', () => ({ runOcr: jest.fn() }));
jest.mock('./documentAiClient', () => ({ runDocumentAi: jest.fn() }));

const excecoes = require('../excecoes');
const { validateExtraction } = require('./crossValidation');
const { resolveEntity } = require('./entityResolution');
const { getCached, setCached } = require('./dedupCache');
const { isUnderPaidCallCap, recordPaidCall } = require('./rateLimiter');
const { runOcr } = require('./ocrClient');
const { runDocumentAi } = require('./documentAiClient');
const { process } = require('./index');

async function buildInvoicePdfBase64() {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	page.drawText('COMMERCIAL INVOICE', { x: 50, y: 750, size: 14, font });
	page.drawText('Invoice Number: INV-2026-0099', { x: 50, y: 720, size: 12, font });
	page.drawText('Buyer: Tassali Trading SPA', { x: 50, y: 700, size: 12, font });
	page.drawText('Total: USD 88000.00', { x: 50, y: 680, size: 12, font });
	page.drawText('Incoterm: CFR', { x: 50, y: 660, size: 12, font });
	const bytes = await pdfDoc.save();
	return Buffer.from(bytes).toString('base64');
}

async function buildBlankPdfBase64() {
	const pdfDoc = await PDFDocument.create();
	pdfDoc.addPage();
	const bytes = await pdfDoc.save();
	return Buffer.from(bytes).toString('base64');
}

function buildPackingListXlsxBase64() {
	const worksheet = XLSX.utils.aoa_to_sheet([
		['container_number', 'quantity_mt'],
		['MAEU1234567', 25],
	]);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
	return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');
}

const ORIGINAL_DOCUMENT_AI_PROCESSOR_ID = CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID;

describe('digitalizacao agent', () => {
	beforeEach(() => {
		validateExtraction.mockReset().mockResolvedValue(FTR_MATCH_CHECK);
		resolveEntity.mockReset().mockResolvedValue(null);
		excecoes.process.mockClear();
		getCached.mockReset().mockResolvedValue(null);
		setCached.mockReset().mockResolvedValue(undefined);
		isUnderPaidCallCap.mockReset().mockResolvedValue(true);
		recordPaidCall.mockReset().mockResolvedValue(undefined);
		runOcr.mockReset().mockResolvedValue(null);
		runDocumentAi.mockReset().mockResolvedValue(undefined);
		// Most tests here only care about the Paddle tier, but index.js now
		// short-circuits tryDocumentAi entirely (skipping the rate-cap check
		// and runDocumentAi) when DOCUMENT_AI_PROCESSOR_ID isn't set, so it
		// has to be "configured" here for the Document AI-specific tests
		// below to actually exercise that call path.
		CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID = 'test-processor';
	});

	afterAll(() => {
		CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID = ORIGINAL_DOCUMENT_AI_PROCESSOR_ID;
	});

	test('extracts an invoice from a text-layer PDF at the free tier, routed to documentacao', async () => {
		const fileBase64 = await buildInvoicePdfBase64();

		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/pdf',
			filename: 'invoice.pdf',
			fileBase64,
		});

		expect(result.agent).toBe('digitalizacao');
		expect(result.ftr_code).toBe('03075-26');
		expect(result.extraction_method).toBe('text_layer');
		expect(result.cost_tier_used).toBe('free');
		expect(result.classified_doc_type).toBe('Invoice');
		expect(result.extracted_fields.invoice_number).toBe('INV-2026-0099');
		expect(result.extracted_fields.buyer_name).toBe('Tassali Trading SPA');
		expect(result.confidence_band).toBe('accept_flagged');
		expect(result.needs_review).toBe(false);
		expect(result.escalated_to_excecoes).toBe(false);
		expect(result.routed_to).toBe('documentacao');
		expect(result.content_hash).toMatch(/^[a-f0-9]{64}$/);
		expect(result.cross_validation).toEqual(FTR_MATCH_CHECK);
		expect(result.relationship).toBeNull();
		expect(excecoes.process).not.toHaveBeenCalled();
	});

	test('extracts a packing list from XLSX at the free tier via structured parse', async () => {
		const fileBase64 = buildPackingListXlsxBase64();

		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			filename: 'packing_list.xlsx',
			docTypeHint: 'BL',
			fileBase64,
		});

		expect(result.extraction_method).toBe('structured_file');
		expect(result.cost_tier_used).toBe('free');
		expect(result.classified_doc_type).toBe('BL');
		expect(result.extracted_fields.table_rows).toEqual([{ container_number: 'MAEU1234567', quantity_mt: 25 }]);
		expect(result.extracted_fields.container_numbers).toEqual(['MAEU1234567']);
	});

	test('a scanned PDF (no text layer) attempts PaddleOCR, and a failed OCR call escalates OCR_FAILED', async () => {
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/pdf',
			filename: 'scan.pdf',
			fileBase64,
		});

		expect(runOcr).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'application/pdf' }));
		expect(recordPaidCall).toHaveBeenCalledWith('paddle', '03075-26');
		// Paddle failed, so Document AI is attempted as a fallback (and left
		// unconfigured by the shared beforeEach default), which must not
		// clobber the OCR_FAILED reason Paddle already established.
		expect(runDocumentAi).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'application/pdf' }));
		expect(recordPaidCall).not.toHaveBeenCalledWith('document_ai', '03075-26');
		expect(result.extraction_method).toBeNull();
		expect(result.cost_tier_used).toBe('cheap');
		expect(result.classified_doc_type).toBeNull();
		expect(result.extracted_fields).toEqual({});
		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
		expect(validateExtraction).not.toHaveBeenCalled();
		expect(excecoes.process).toHaveBeenCalledWith(
			expect.objectContaining({ ftrCode: '03075-26', agent: 'digitalizacao', errorMsg: expect.stringContaining('OCR_FAILED') })
		);
	});

	test('a low-confidence PaddleOCR result escalates OCR_LOW_CONFIDENCE instead of extracting from unreliable text', async () => {
		runOcr.mockResolvedValue({ text: 'garbled nonsense', confidence: 0.1, pages: 1 });
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'application/pdf', filename: 'scan.pdf', fileBase64 });

		expect(result.extraction_method).toBeNull();
		expect(setCached).not.toHaveBeenCalled();
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_LOW_CONFIDENCE') }));
	});

	test('a successful PaddleOCR result extracts at the cheap tier and caches the text', async () => {
		runOcr.mockResolvedValue({
			text: 'Invoice Number: INV-2026-0100\nBuyer: Agrotrade Rus\nTotal: USD 50000.00',
			confidence: 0.93,
			pages: 1,
		});
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'image/jpeg', filename: 'scan.jpg', fileBase64 });

		expect(result.extraction_method).toBe('vision_ocr');
		expect(result.cost_tier_used).toBe('cheap');
		expect(result.classified_doc_type).toBe('Invoice');
		expect(result.extracted_fields.invoice_number).toBe('INV-2026-0100');
		expect(setCached).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ extractedText: expect.stringContaining('INV-2026-0100') }),
			'03075-26'
		);
	});

	test('Document AI resolves an invoice after PaddleOCR fails, at the expensive tier', async () => {
		runOcr.mockResolvedValue(null);
		runDocumentAi.mockResolvedValue({
			text: 'Invoice Number: INV-2026-0200\nBuyer: Agrotrade Rus\nTotal: USD 61000.00',
			confidence: 0.88,
		});
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'application/pdf', filename: 'scan.pdf', fileBase64 });

		expect(recordPaidCall).toHaveBeenCalledWith('paddle', '03075-26');
		expect(recordPaidCall).toHaveBeenCalledWith('document_ai', '03075-26');
		expect(result.extraction_method).toBe('document_ai');
		expect(result.cost_tier_used).toBe('expensive');
		expect(result.classified_doc_type).toBe('Invoice');
		expect(result.extracted_fields.invoice_number).toBe('INV-2026-0200');
		expect(setCached).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ extractedText: expect.stringContaining('INV-2026-0200') }),
			'03075-26'
		);
	});

	test('a Document AI call failure (after Paddle also failed) escalates OCR_FAILED at the expensive tier', async () => {
		runOcr.mockResolvedValue(null);
		runDocumentAi.mockResolvedValue(null);
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'application/pdf', filename: 'scan.pdf', fileBase64 });

		expect(result.extraction_method).toBeNull();
		expect(result.cost_tier_used).toBe('expensive');
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_FAILED') }));
	});

	test('a low-confidence Document AI result escalates OCR_LOW_CONFIDENCE at the expensive tier', async () => {
		runOcr.mockResolvedValue(null);
		runDocumentAi.mockResolvedValue({ text: 'garbled nonsense', confidence: 0.1 });
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'application/pdf', filename: 'scan.pdf', fileBase64 });

		expect(result.extraction_method).toBeNull();
		expect(result.cost_tier_used).toBe('expensive');
		expect(setCached).not.toHaveBeenCalled();
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_LOW_CONFIDENCE') }));
	});

	test('hitting the Document AI call cap (after Paddle failed) skips it and keeps OCR_FAILED at the cheap tier', async () => {
		runOcr.mockResolvedValue(null);
		isUnderPaidCallCap.mockImplementation(async (kind) => kind !== 'document_ai');
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'application/pdf', filename: 'scan.pdf', fileBase64 });

		expect(runDocumentAi).not.toHaveBeenCalled();
		expect(result.extraction_method).toBeNull();
		// Document AI was never actually called (rate-capped), so its own
		// cost tier is 'cheap' — the same as what Paddle already incurred —
		// not 'expensive'.
		expect(result.cost_tier_used).toBe('cheap');
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_FAILED') }));
	});

	test('Document AI not provisioned (no DOCUMENT_AI_PROCESSOR_ID) skips the rate-cap check entirely and keeps OCR_FAILED', async () => {
		CONFIG.DIGITALIZACAO.DOCUMENT_AI_PROCESSOR_ID = null;
		runOcr.mockResolvedValue(null);
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'application/pdf', filename: 'scan.pdf', fileBase64 });

		expect(isUnderPaidCallCap).not.toHaveBeenCalledWith('document_ai', expect.anything());
		expect(runDocumentAi).not.toHaveBeenCalled();
		expect(result.extraction_method).toBeNull();
		expect(result.cost_tier_used).toBe('cheap');
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_FAILED') }));
	});

	test('a dedup cache hit skips PaddleOCR entirely but still runs the rest of the pipeline', async () => {
		getCached.mockResolvedValue({ extractedText: 'Invoice Number: INV-2026-0101\nBuyer: Acme', tableRows: null });
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'image/jpeg', filename: 'scan.jpg', fileBase64 });

		expect(runOcr).not.toHaveBeenCalled();
		expect(result.extraction_method).toBe('cache_hit');
		expect(result.cost_tier_used).toBe('free');
		expect(result.extracted_fields.invoice_number).toBe('INV-2026-0101');
	});

	test('hitting the per-FTR/per-day OCR call cap skips the worker and escalates OCR_NOT_AVAILABLE', async () => {
		isUnderPaidCallCap.mockResolvedValue(false);
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({ ftrCode: '03075-26', mimeType: 'image/jpeg', filename: 'scan.jpg', fileBase64 });

		expect(runOcr).not.toHaveBeenCalled();
		expect(result.extraction_method).toBeNull();
		// Never actually called the worker (capped before that), so no cost
		// was incurred — reported as 'free', not 'cheap'.
		expect(result.cost_tier_used).toBe('free');
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_NOT_AVAILABLE') }));
	});

	test('a mimeType OCR cannot read (legacy .doc) never touches the cache/rate-limiter/OCR worker', async () => {
		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/msword',
			filename: 'legacy.doc',
			fileBase64: Buffer.from('legacy doc bytes').toString('base64'),
		});

		expect(getCached).not.toHaveBeenCalled();
		expect(isUnderPaidCallCap).not.toHaveBeenCalled();
		expect(runOcr).not.toHaveBeenCalled();
		expect(result.extraction_method).toBeNull();
		expect(result.cost_tier_used).toBe('free');
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('OCR_NOT_AVAILABLE') }));
	});

	test('an unparseable PDF escalates CORRUPTED_FILE, not the generic OCR_NOT_AVAILABLE', async () => {
		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/pdf',
			filename: 'broken.pdf',
			fileBase64: Buffer.from('not a real pdf').toString('base64'),
		});

		expect(result.extraction_method).toBeNull();
		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
		expect(runOcr).not.toHaveBeenCalled();
		// Diagnosed as corrupted before OCR would even have been attempted —
		// no cost incurred, so 'free', not 'cheap'.
		expect(result.cost_tier_used).toBe('free');
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('CORRUPTED_FILE') }));
	});

	test('flags unclassifiable content for review and escalates LOW_EXTRACTION_CONFIDENCE', async () => {
		const worksheet = XLSX.utils.aoa_to_sheet([['unrelated', 'content']]);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
		const xlsxBase64 = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }).toString('base64');

		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			filename: 'mystery.xlsx',
			fileBase64: xlsxBase64,
		});

		expect(result.extraction_method).toBe('structured_file');
		expect(result.classified_doc_type).toBeNull();
		expect(result.confidence_band).toBe('candidate_only');
		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
		expect(excecoes.process).toHaveBeenCalledWith(
			expect.objectContaining({ errorMsg: expect.stringContaining('LOW_EXTRACTION_CONFIDENCE') })
		);
	});

	test('a cross-validation mismatch escalates FIELD_CONFLICT even with confident extraction', async () => {
		validateExtraction.mockResolvedValue([
			...FTR_MATCH_CHECK,
			{ check: 'aflatoxin_within_market_limit', result: 'mismatch', detail: { aflatoxin_ppb: 5, limit_ppb: 2 } },
		]);
		const fileBase64 = await buildInvoicePdfBase64();

		const result = await process({
			ftrCode: '03080-26',
			mimeType: 'application/pdf',
			filename: 'invoice.pdf',
			fileBase64,
		});

		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('FIELD_CONFLICT') }));
	});

	test('an ambiguous entity match escalates ENTITY_AMBIGUOUS', async () => {
		resolveEntity.mockResolvedValue({
			relationship_id: 'rel-1',
			source_entity: { type: 'invoice', id: 'INV-2026-0099' },
			relationship: 'BELONGS_TO',
			target_entity: { type: 'ftr', id: '03075-26' },
			confidence: 0,
			status: 'ambiguous',
		});
		const fileBase64 = await buildInvoicePdfBase64();

		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/pdf',
			filename: 'invoice.pdf',
			fileBase64,
		});

		expect(result.relationship.status).toBe('ambiguous');
		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
		expect(excecoes.process).toHaveBeenCalledWith(expect.objectContaining({ errorMsg: expect.stringContaining('ENTITY_AMBIGUOUS') }));
	});

	test('passes ftrCode, classifiedDocType, extractedFields and market through to validateExtraction/resolveEntity', async () => {
		const fileBase64 = await buildInvoicePdfBase64();

		await process({
			ftrCode: '03075-26',
			mimeType: 'application/pdf',
			filename: 'invoice.pdf',
			fileBase64,
			market: 'Russia',
		});

		expect(validateExtraction).toHaveBeenCalledWith(
			expect.objectContaining({ ftrCode: '03075-26', classifiedDocType: 'Invoice', market: 'Russia' })
		);
		expect(resolveEntity).toHaveBeenCalledWith(
			expect.objectContaining({ ftrCode: '03075-26', classifiedDocType: 'Invoice' })
		);
	});
});
