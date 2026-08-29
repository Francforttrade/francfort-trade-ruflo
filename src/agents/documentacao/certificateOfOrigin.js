const { createDocumentPdf } = require('./pdfUtils');

const SIGNATORY = 'Rodrigo Francfort';

async function generateCertificateOfOriginPdf({ ftrCode, seller, buyer, product, quantity, origin = 'Brazil' }) {
	const lines = [
		`FTR: ${ftrCode}`,
		`Exporter: ${seller && seller.name}`,
		`Consignee: ${buyer && buyer.name}`,
		`Product: ${[product && product.type, product && product.grade].filter(Boolean).join(' ')}`,
		`Quantity: ${quantity && quantity.mt} MT`,
		`Country of Origin: ${origin}`,
		'',
		`Signed: ${SIGNATORY} – Francfort Trade`,
	];

	return createDocumentPdf('CERTIFICATE OF ORIGIN', lines);
}

module.exports = { generateCertificateOfOriginPdf, SIGNATORY };
