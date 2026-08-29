const { createDocumentPdf } = require('./pdfUtils');

// ROADMAP: "Validade Phyto (típicamente 30 dias)".
const PHYTO_VALIDITY_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function expiryDate(issueDate) {
	return new Date(new Date(issueDate).getTime() + PHYTO_VALIDITY_DAYS * DAY_MS);
}

function isPhytoValid(issueDate, now = new Date()) {
	return now <= expiryDate(issueDate);
}

function daysUntilExpiry(issueDate, now = new Date()) {
	return Math.ceil((expiryDate(issueDate).getTime() - now.getTime()) / DAY_MS);
}

async function generatePhytosanitaryPdf({ ftrCode, product, quantity, issueDate, labName }) {
	const lines = [
		`FTR: ${ftrCode}`,
		`Product: ${[product && product.type, product && product.grade].filter(Boolean).join(' ')}`,
		`Quantity: ${quantity && quantity.mt} MT`,
		`Issue Date: ${issueDate}`,
		`Lab: ${labName || ''}`,
		`Valid until: ${expiryDate(issueDate).toISOString().slice(0, 10)}`,
	];

	return createDocumentPdf('PHYTOSANITARY CERTIFICATE', lines);
}

module.exports = { generatePhytosanitaryPdf, isPhytoValid, daysUntilExpiry, PHYTO_VALIDITY_DAYS };
