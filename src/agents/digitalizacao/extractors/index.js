const { extractLabReportFields } = require('./labReportExtractor');
const { extractBillOfLadingFields } = require('./billOfLadingExtractor');
const { extractCertificateOfOriginFields } = require('./certificateOfOriginExtractor');
const { extractPhytosanitaryFields } = require('./phytosanitaryExtractor');
const { extractInvoiceFields } = require('./invoiceExtractor');
const { extractSwiftFields } = require('./swiftExtractor');
const { extractContractFields } = require('./contractExtractor');
const { extractComplianceDocFields } = require('./complianceDocExtractor');
const { normalizeTableRows } = require('./tableExtractor');

const EXTRACTORS_BY_DOC_TYPE = {
	LabReport: extractLabReportFields,
	BL: extractBillOfLadingFields,
	CO: extractCertificateOfOriginFields,
	Phyto: extractPhytosanitaryFields,
	Invoice: extractInvoiceFields,
	SWIFT: extractSwiftFields,
	Contract: extractContractFields,
	ACID: extractComplianceDocFields,
	ImportPermit: extractComplianceDocFields,
};

// docType is null when classification found nothing — extracted_fields is
// then just the table (if any), never thrown as an error, so the caller
// still gets a well-formed (if empty) result and can fall back to
// needs_review instead of failing outright.
function extractFields(docType, { text, filename, tableRows, market }) {
	const extractor = EXTRACTORS_BY_DOC_TYPE[docType];
	const fields = extractor ? extractor({ text, filename, market }) : {};

	const normalizedTableRows = normalizeTableRows(tableRows);
	if (normalizedTableRows) {
		fields.table_rows = normalizedTableRows;
	}

	return fields;
}

module.exports = { extractFields, EXTRACTORS_BY_DOC_TYPE };
