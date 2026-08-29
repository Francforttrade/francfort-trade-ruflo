const { PDFDocument, StandardFonts } = require('pdf-lib');

const PAGE_SIZE_A4 = [595.28, 841.89];
const MARGIN_X = 50;
const TITLE_SIZE = 16;
const BODY_SIZE = 11;
const LINE_HEIGHT = 18;
const BOTTOM_MARGIN = 50;

async function createDocumentPdf(title, lines) {
	const pdfDoc = await PDFDocument.create();
	const page = pdfDoc.addPage(PAGE_SIZE_A4);
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	let y = PAGE_SIZE_A4[1] - 40;
	page.drawText(title, { x: MARGIN_X, y, size: TITLE_SIZE, font: boldFont });
	y -= 30;

	for (const line of lines) {
		if (y < BOTTOM_MARGIN) {
			page.drawText('(continua...)', { x: MARGIN_X, y, size: 10, font });
			break;
		}
		page.drawText(String(line ?? ''), { x: MARGIN_X, y, size: BODY_SIZE, font });
		y -= LINE_HEIGHT;
	}

	return pdfDoc.save();
}

module.exports = { createDocumentPdf };
