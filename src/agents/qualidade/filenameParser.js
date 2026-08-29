// ROADMAP: "filename padrão: FTR_03075-26_EUROFINS_2026-08-15.pdf".
const FILENAME_REGEX = /^FTR_(\d{5}-\d{2}(?:-\d)?)_([A-Za-z]+)_(\d{4}-\d{2}-\d{2})\.pdf$/i;

function parseLabReportFilename(filename) {
	const match = typeof filename === 'string' && filename.match(FILENAME_REGEX);
	if (!match) {
		return null;
	}
	const [, ftrCode, labName, date] = match;
	return { ftrCode, labName, date };
}

module.exports = { parseLabReportFilename };
