// Normalizes whatever produced table rows (today: structuredFileExtractor's
// xlsx parse; chunk 2a+: PaddleOCR's PP-Structure, Document AI's form
// parser) into the same `table_rows: [{...}]` shape for the output contract.
function normalizeTableRows(rawRows) {
	if (!Array.isArray(rawRows) || rawRows.length === 0) {
		return null;
	}
	const rows = rawRows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
	return rows.length > 0 ? rows : null;
}

module.exports = { normalizeTableRows };
