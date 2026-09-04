const XLSX = require('xlsx');
const mammoth = require('mammoth');

const SPREADSHEET_MIME_TYPES = new Set([
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.ms-excel',
]);

const WORD_MIME_TYPES = new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

// Legacy binary .doc (application/msword) has no reliable pure-JS parser
// without native/system dependencies, so it's accepted by the input
// allowlist but intentionally not handled here — it falls through to the
// OCR/manual-review path instead of a direct structured parse.
function isStructuredMimeType(mimeType) {
	return SPREADSHEET_MIME_TYPES.has(mimeType) || WORD_MIME_TYPES.has(mimeType);
}

function extractSpreadsheet(buffer) {
	const workbook = XLSX.read(buffer, { type: 'buffer' });
	const firstSheetName = workbook.SheetNames[0];
	const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
	if (!sheet) {
		return { text: null, tableRows: null };
	}
	return {
		text: XLSX.utils.sheet_to_csv(sheet),
		tableRows: XLSX.utils.sheet_to_json(sheet, { defval: null }),
	};
}

async function extractWordDocument(buffer) {
	const { value } = await mammoth.extractRawText({ buffer });
	return { text: value, tableRows: null };
}

async function extractStructuredFile({ fileBase64, mimeType }) {
	if (!fileBase64 || !isStructuredMimeType(mimeType)) {
		return null;
	}

	const buffer = Buffer.from(fileBase64, 'base64');
	try {
		if (SPREADSHEET_MIME_TYPES.has(mimeType)) {
			return extractSpreadsheet(buffer);
		}
		return await extractWordDocument(buffer);
	} catch (err) {
		return null;
	}
}

module.exports = { isStructuredMimeType, extractStructuredFile, SPREADSHEET_MIME_TYPES, WORD_MIME_TYPES };
