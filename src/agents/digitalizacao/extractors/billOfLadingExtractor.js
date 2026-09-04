// [ \t]* (not \s*) so a label doesn't greedily cross a newline into the next
// line — see invoiceExtractor.js's comment for the failure mode this avoids.
const BL_NUMBER_REGEX = /B\/?L[ \t]*(?:No\.?|Number)?[ \t]*[:#]?[ \t]*([A-Z0-9\-/]+)/i;
// ISO 6346 container number: 4 letters (owner code + category) + 7 digits.
const CONTAINER_NUMBER_REGEX = /\b[A-Z]{4}\d{7}\b/g;
const VESSEL_REGEX = /Vessel[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const PORT_LOADING_REGEX = /Port of Loading[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const PORT_DISCHARGE_REGEX = /Port of Discharge[ \t]*[:#]?[ \t]*([^\n,;]+)/i;
const CONSIGNEE_REGEX = /Consignee[ \t]*[:#]?[ \t]*([^\n]+)/i;

function extractBillOfLadingFields({ text }) {
	if (!text) {
		return {
			bl_number: null,
			container_numbers: [],
			consignee_name: null,
			consignee_address: null,
			vessel: null,
			port_of_loading: null,
			port_of_discharge: null,
		};
	}

	const blMatch = text.match(BL_NUMBER_REGEX);
	const containerNumbers = [...new Set(text.match(CONTAINER_NUMBER_REGEX) || [])];
	const vesselMatch = text.match(VESSEL_REGEX);
	const loadingMatch = text.match(PORT_LOADING_REGEX);
	const dischargeMatch = text.match(PORT_DISCHARGE_REGEX);
	const consigneeMatch = text.match(CONSIGNEE_REGEX);

	return {
		bl_number: blMatch ? blMatch[1].trim() : null,
		container_numbers: containerNumbers,
		consignee_name: consigneeMatch ? consigneeMatch[1].trim() : null,
		// A full postal address rarely resolves reliably from one regex
		// capture — left for the structured OCR/Document AI path (chunk 2b+).
		consignee_address: null,
		vessel: vesselMatch ? vesselMatch[1].trim() : null,
		port_of_loading: loadingMatch ? loadingMatch[1].trim() : null,
		port_of_discharge: dischargeMatch ? dischargeMatch[1].trim() : null,
	};
}

module.exports = { extractBillOfLadingFields };
