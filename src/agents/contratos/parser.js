const { extractQuantityMt, extractGrade } = require('../comunicacao/parser');

const INCOTERMS = ['FOB Santos', 'CFR', 'CIF'];
const AMENDMENT_REGEX = /altera[cç][aã]o para\s+(\d+(?:[.,]\d+)?)\s*mt/i;
const UNIT_PRICE_REGEX = /usd\s*([\d,.]+)\s*\/\s*mt/i;
const DELIVERY_DATE_REGEX = /(?:delivery date|data de entrega)\s*:\s*(\d{4}-\d{2}-\d{2})/i;
const PAYMENT_TERMS_REGEX = /(?:payment terms|condi[cç][oõ]es de pagamento)\s*:\s*([^\n]+)/i;

const PARTY_PATTERNS = {
	seller: /(?:seller|vendedor)\s*:\s*([^\n,;]+)/i,
	buyer: /(?:buyer|comprador)\s*:\s*([^\n,;]+)/i,
};

function extractParty(text, role) {
	const match = text.match(PARTY_PATTERNS[role]);
	return match ? match[1].trim() : null;
}

function extractIncoterm(text) {
	return INCOTERMS.find((term) => text.toLowerCase().includes(term.toLowerCase())) || null;
}

function extractUnitPriceUsd(text) {
	const match = text.match(UNIT_PRICE_REGEX);
	return match ? parseFloat(match[1].replace(',', '')) : null;
}

function extractDeliveryDate(text) {
	const match = text.match(DELIVERY_DATE_REGEX);
	return match ? match[1] : null;
}

function extractPaymentTerms(text) {
	const match = text.match(PAYMENT_TERMS_REGEX);
	return match ? match[1].trim() : null;
}

// ROADMAP: "detectar amendments: 'alteração para 550 MT' → new version".
function detectAmendment(text) {
	const match = text.match(AMENDMENT_REGEX);
	return match
		? { is_amendment: true, amended_quantity_mt: parseFloat(match[1].replace(',', '.')) }
		: { is_amendment: false, amended_quantity_mt: null };
}

function parseContract(text) {
	return {
		seller: extractParty(text, 'seller'),
		buyer: extractParty(text, 'buyer'),
		quantity_mt: extractQuantityMt(text),
		grade: extractGrade(text),
		unit_price_usd: extractUnitPriceUsd(text),
		incoterm: extractIncoterm(text),
		payment_terms: extractPaymentTerms(text),
		delivery_date: extractDeliveryDate(text),
		...detectAmendment(text),
	};
}

module.exports = {
	parseContract,
	extractParty,
	extractIncoterm,
	extractUnitPriceUsd,
	extractDeliveryDate,
	extractPaymentTerms,
	detectAmendment,
};
