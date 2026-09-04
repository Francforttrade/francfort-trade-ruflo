const { PDFDocument, StandardFonts } = require('pdf-lib');
const XLSX = require('xlsx');

const FTR_MATCH_CHECK = [{ check: 'ftr_code_exists_in_supabase', result: 'match', detail: {} }];

jest.mock('../excecoes', () => ({ process: jest.fn().mockResolvedValue({ agent: 'excecoes' }) }));
jest.mock('./crossValidation', () => ({ validateExtraction: jest.fn() }));
jest.mock('./entityResolution', () => ({ resolveEntity: jest.fn() }));

const excecoes = require('../excecoes');
const { validateExtraction } = require('./crossValidation');
const { resolveEntity } = require('./entityResolution');
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

describe('digitalizacao agent', () => {
	beforeEach(() => {
		validateExtraction.mockReset().mockResolvedValue(FTR_MATCH_CHECK);
		resolveEntity.mockReset().mockResolvedValue(null);
		excecoes.process.mockClear();
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

	test('marks a scanned PDF (no text layer) for review and escalates OCR_NOT_AVAILABLE', async () => {
		const fileBase64 = await buildBlankPdfBase64();

		const result = await process({
			ftrCode: '03075-26',
			mimeType: 'application/pdf',
			filename: 'scan.pdf',
			fileBase64,
		});

		expect(result.extraction_method).toBeNull();
		expect(result.cost_tier_used).toBe('cheap');
		expect(result.classified_doc_type).toBeNull();
		expect(result.extracted_fields).toEqual({});
		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
		expect(validateExtraction).not.toHaveBeenCalled();
		expect(excecoes.process).toHaveBeenCalledWith(
			expect.objectContaining({ ftrCode: '03075-26', agent: 'digitalizacao', errorMsg: expect.stringContaining('OCR_NOT_AVAILABLE') })
		);
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
