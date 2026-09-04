// [ \t]* (not \s*) so a label doesn't greedily cross a newline into the next
// line — see invoiceExtractor.js's comment for the failure mode this avoids.
const EXPORTER_REGEX = /Exporter[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const CONSIGNEE_REGEX = /Consignee[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const PRODUCT_REGEX = /Product[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const QUANTITY_REGEX = /Quantity[ \t]*[:#]?[ \t]*([\d.,]+)[ \t]*MT/i;
const ORIGIN_REGEX = /Country of Origin[ \t]*[:#]?[ \t]*([^\n,;]+)/i;

// Field names mirror documentacao/certificateOfOrigin.js's own generation
// template, so a CO that Rúflo itself issued round-trips cleanly.
function extractCertificateOfOriginFields({ text }) {
	if (!text) {
		return {
			exporter_name: null,
			consignee_name: null,
			product_description: null,
			quantity_mt: null,
			country_of_origin: null,
		};
	}

	const exporterMatch = text.match(EXPORTER_REGEX);
	const consigneeMatch = text.match(CONSIGNEE_REGEX);
	const productMatch = text.match(PRODUCT_REGEX);
	const quantityMatch = text.match(QUANTITY_REGEX);
	const originMatch = text.match(ORIGIN_REGEX);

	return {
		exporter_name: exporterMatch ? exporterMatch[1].trim() : null,
		consignee_name: consigneeMatch ? consigneeMatch[1].trim() : null,
		product_description: productMatch ? productMatch[1].trim() : null,
		quantity_mt: quantityMatch ? parseFloat(quantityMatch[1].replace(',', '.')) : null,
		country_of_origin: originMatch ? originMatch[1].trim() : null,
	};
}

module.exports = { extractCertificateOfOriginFields };
