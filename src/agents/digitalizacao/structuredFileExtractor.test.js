const XLSX = require('xlsx');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_MIME = 'application/vnd.ms-excel';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';

function buildXlsxBase64(rows) {
	const worksheet = XLSX.utils.aoa_to_sheet(rows);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
	const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
	return buffer.toString('base64');
}

describe('digitalizacao structuredFileExtractor', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.dontMock('xlsx');
		jest.dontMock('mammoth');
	});

	describe('isStructuredMimeType', () => {
		test('accepts xlsx/xls and docx, rejects legacy doc and other types', () => {
			const { isStructuredMimeType } = require('./structuredFileExtractor');

			expect(isStructuredMimeType(XLSX_MIME)).toBe(true);
			expect(isStructuredMimeType(XLS_MIME)).toBe(true);
			expect(isStructuredMimeType(DOCX_MIME)).toBe(true);
			expect(isStructuredMimeType(DOC_MIME)).toBe(false);
			expect(isStructuredMimeType('application/pdf')).toBe(false);
			expect(isStructuredMimeType('image/jpeg')).toBe(false);
		});
	});

	describe('extractStructuredFile — spreadsheets', () => {
		test('parses a packing-list-style xlsx into text and table_rows', async () => {
			const { extractStructuredFile } = require('./structuredFileExtractor');
			const fileBase64 = buildXlsxBase64([
				['container_number', 'quantity_mt', 'seal_number'],
				['MAEU1234567', 25, 'SL-001'],
				['MAEU1234568', 25, 'SL-002'],
			]);

			const result = await extractStructuredFile({ fileBase64, mimeType: XLSX_MIME });

			expect(result.tableRows).toEqual([
				{ container_number: 'MAEU1234567', quantity_mt: 25, seal_number: 'SL-001' },
				{ container_number: 'MAEU1234568', quantity_mt: 25, seal_number: 'SL-002' },
			]);
			expect(result.text).toEqual(expect.stringContaining('MAEU1234567'));
		});

		// SheetJS is very permissive — it will happily read arbitrary bytes as
		// some workbook rather than throw, so the only reliable way to exercise
		// the try/catch here is a genuinely broken parse from the library.
		test('returns null instead of throwing when XLSX.read itself fails', async () => {
			jest.doMock('xlsx', () => ({
				read: jest.fn(() => {
					throw new Error('corrupt workbook');
				}),
				utils: XLSX.utils,
				write: XLSX.write,
			}));
			const { extractStructuredFile } = require('./structuredFileExtractor');

			const result = await extractStructuredFile({
				fileBase64: Buffer.from('anything').toString('base64'),
				mimeType: XLSX_MIME,
			});

			expect(result).toBeNull();
		});
	});

	describe('extractStructuredFile — word documents', () => {
		test('parses docx raw text via mammoth', async () => {
			jest.doMock('mammoth', () => ({
				extractRawText: jest.fn().mockResolvedValue({ value: 'Contract Number: CT-2026-001' }),
			}));
			const { extractStructuredFile } = require('./structuredFileExtractor');

			const result = await extractStructuredFile({
				fileBase64: Buffer.from('fake docx bytes').toString('base64'),
				mimeType: DOCX_MIME,
			});

			expect(result).toEqual({ text: 'Contract Number: CT-2026-001', tableRows: null });
		});

		test('returns null instead of throwing when mammoth fails to parse', async () => {
			jest.doMock('mammoth', () => ({
				extractRawText: jest.fn().mockRejectedValue(new Error('not a valid docx')),
			}));
			const { extractStructuredFile } = require('./structuredFileExtractor');

			const result = await extractStructuredFile({
				fileBase64: Buffer.from('not a real docx').toString('base64'),
				mimeType: DOCX_MIME,
			});

			expect(result).toBeNull();
		});
	});

	describe('extractStructuredFile — unsupported/missing input', () => {
		test('returns null for legacy .doc (application/msword)', async () => {
			const { extractStructuredFile } = require('./structuredFileExtractor');

			const result = await extractStructuredFile({
				fileBase64: Buffer.from('legacy doc bytes').toString('base64'),
				mimeType: DOC_MIME,
			});

			expect(result).toBeNull();
		});

		test('returns null when there is no file', async () => {
			const { extractStructuredFile } = require('./structuredFileExtractor');

			expect(await extractStructuredFile({ fileBase64: null, mimeType: XLSX_MIME })).toBeNull();
		});
	});
});
