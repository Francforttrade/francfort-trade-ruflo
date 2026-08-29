const { createDocumentPdf } = require('./pdfUtils');

const RUSSIA_BUYER_NAMES = ['Agrotrade Rus'];

// ROADMAP RULE RUSSIA: "Se buyer = Agrotrade Rus, bank_account ONLY (sem nome banco)".
function isRussiaBankRule(buyerName, market) {
	return market === 'Russia' || RUSSIA_BUYER_NAMES.some((name) => (buyerName || '').toLowerCase().includes(name.toLowerCase()));
}

function formatBankDetailsLines(bankDetails, { buyerName, market }) {
	if (!bankDetails) {
		return [];
	}

	if (isRussiaBankRule(buyerName, market)) {
		return [`Bank Account: ${bankDetails.bank_account_number}`];
	}

	return [
		`Bank Account: ${bankDetails.bank_account_number}`,
		`SWIFT: ${bankDetails.swift_code}`,
		`Beneficiary: ${bankDetails.beneficiary}`,
	];
}

async function generateInvoicePdf({
	invoiceNumber,
	ftrCode,
	seller,
	buyer,
	market,
	lineItems,
	totalAmountUsd,
	paymentTerms,
	bankDetails,
}) {
	const lines = [
		`Invoice Number: ${invoiceNumber}`,
		`FTR: ${ftrCode}`,
		`Seller: ${seller && seller.name}`,
		`Buyer: ${buyer && buyer.name}`,
		'',
		...(lineItems || []).map(
			(item) => `${item.description} — ${item.quantity_mt} MT x USD ${item.unit_price_usd} = USD ${item.total_usd}`
		),
		'',
		`Total: USD ${totalAmountUsd}`,
		`Payment Terms: ${paymentTerms || ''}`,
		'',
		...formatBankDetailsLines(bankDetails, { buyerName: buyer && buyer.name, market }),
	];

	return createDocumentPdf('COMMERCIAL INVOICE', lines);
}

module.exports = { generateInvoicePdf, isRussiaBankRule, formatBankDetailsLines };
