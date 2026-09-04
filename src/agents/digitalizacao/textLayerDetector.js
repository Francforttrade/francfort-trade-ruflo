const { PDFParse } = require('pdf-parse');

// Below this many characters, treat the "text layer" as noise (stray
// metadata pdf-parse picks up from an otherwise scanned page) rather than
// real content worth regex-extracting from.
const MIN_TEXT_LENGTH = 20;

// pdfjs-dist (which pdf-parse wraps) throws PasswordException for an
// encrypted PDF and InvalidPDFException for a malformed one — worth telling
// apart from a plain scanned image (which parses fine, just with little/no
// text) so index.js can escalate with PASSWORD_PROTECTED/CORRUPTED_FILE
// instead of the generic "no OCR worker yet" code for those two cases.
function classifyPdfParseError(err) {
	if (err && err.name === 'PasswordException') {
		return 'password_protected';
	}
	// Any other parse-time exception (invalid structure, unexpected worker
	// failure, ...) is treated as a corrupted file rather than folded into
	// "no text layer" — those mean very different things to a reviewer.
	return 'corrupted';
}

async function detectTextLayer(fileBase64) {
	if (!fileBase64) {
		return { hasTextLayer: false, extractedText: null, failureReason: null };
	}

	let parser;
	try {
		const buffer = Buffer.from(fileBase64, 'base64');
		parser = new PDFParse({ data: buffer });
		const { text } = await parser.getText();
		const trimmed = (text || '').trim();
		const hasTextLayer = trimmed.length >= MIN_TEXT_LENGTH;
		return {
			hasTextLayer,
			extractedText: hasTextLayer ? trimmed : null,
			failureReason: null,
		};
	} catch (err) {
		return { hasTextLayer: false, extractedText: null, failureReason: classifyPdfParseError(err) };
	} finally {
		if (parser) {
			await parser.destroy();
		}
	}
}

module.exports = { detectTextLayer, classifyPdfParseError, MIN_TEXT_LENGTH };
