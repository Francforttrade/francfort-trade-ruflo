const AFLATOXIN_REGEX = /aflatoxin[^\d]*(\d+(?:[.,]\d+)?)\s*ppb/i;
const MOISTURE_REGEX = /moisture[^\d]*(\d+(?:[.,]\d+)?)\s*%/i;
const PURITY_REGEX = /purity[^\d]*(\d+(?:[.,]\d+)?)\s*%/i;

function extractNumber(regex, text) {
	const match = text.match(regex);
	return match ? parseFloat(match[1].replace(',', '.')) : null;
}

// ROADMAP: "OCR/extract: aflatoxin PPB, moisture, purity".
function parseLabReportText(text) {
	return {
		aflatoxin_ppb: extractNumber(AFLATOXIN_REGEX, text),
		moisture_pct: extractNumber(MOISTURE_REGEX, text),
		purity_pct: extractNumber(PURITY_REGEX, text),
	};
}

module.exports = { parseLabReportText };
