// Keyword sets checked against filename + extracted text (case-insensitive).
// This is the "cheap" classification pass — filename pattern + keywords —
// before ever considering a vision call; see docs plan section C.3.
const DOC_TYPE_KEYWORDS = {
	LabReport: ['aflatoxin', 'moisture', 'purity', 'laudo', 'lab report', 'analysis certificate'],
	BL: ['bill of lading', 'b/l', 'consignee', 'vessel', 'port of loading'],
	CO: ['certificate of origin', 'certificado de origem'],
	Phyto: ['phytosanitary', 'fitossanit'],
	Invoice: ['commercial invoice', 'invoice', 'fatura'],
	SWIFT: ['swift', 'mt103', 'ordering bank', 'beneficiary'],
	Contract: ['contract', 'contrato', 'agreement'],
	ACID: ['acid', 'cargox'],
	ImportPermit: ['import permit', 'licença de importação', 'licenca de importacao'],
};

function scoreDocType(haystack, keywords) {
	return keywords.filter((keyword) => haystack.includes(keyword)).length;
}

// If the caller already knows the doc type (docTypeHint), trust it — the
// heuristic below exists for when they don't. Otherwise pick the type with
// the most keyword matches; confidence grows with the number of matches but
// is capped below 1.0 since a keyword hit is still just a heuristic, not a
// verified fact.
function classifyDocument({ filename, text, docTypeHint }) {
	if (docTypeHint && DOC_TYPE_KEYWORDS[docTypeHint]) {
		return { docType: docTypeHint, confidence: 0.9, source: 'hint' };
	}

	const haystack = `${filename || ''}\n${text || ''}`.toLowerCase();
	let bestType = null;
	let bestScore = 0;
	for (const [docType, keywords] of Object.entries(DOC_TYPE_KEYWORDS)) {
		const score = scoreDocType(haystack, keywords);
		if (score > bestScore) {
			bestScore = score;
			bestType = docType;
		}
	}

	if (!bestType) {
		return { docType: null, confidence: 0, source: 'heuristic' };
	}

	return { docType: bestType, confidence: Math.min(0.95, 0.5 + bestScore * 0.25), source: 'heuristic' };
}

module.exports = { classifyDocument, DOC_TYPE_KEYWORDS };
