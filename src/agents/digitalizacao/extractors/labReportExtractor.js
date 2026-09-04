const { parseLabReportText } = require('../../qualidade/labReportParser');
const { parseLabReportFilename } = require('../../qualidade/filenameParser');

function extractLabReportFields({ text, filename }) {
	const parsed = text ? parseLabReportText(text) : { aflatoxin_ppb: null, moisture_pct: null, purity_pct: null };
	const filenameInfo = filename ? parseLabReportFilename(filename) : null;

	return {
		aflatoxin_ppb: parsed.aflatoxin_ppb,
		moisture_pct: parsed.moisture_pct,
		purity_pct: parsed.purity_pct,
		lab_name: filenameInfo ? filenameInfo.labName : null,
		report_date: filenameInfo ? filenameInfo.date : null,
	};
}

module.exports = { extractLabReportFields };
