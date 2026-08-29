const { createDocumentPdf } = require('./pdfUtils');

// ROADMAP: "Validação: consignee address matches buyer address? ✓"
function isConsigneeAddressMatching(consigneeAddress, buyerAddress) {
	if (!consigneeAddress || !buyerAddress) {
		return null;
	}
	return consigneeAddress.trim().toLowerCase() === buyerAddress.trim().toLowerCase();
}

async function generateBillOfLadingPdf({
	blNumber,
	blType,
	ftrCode,
	shipper,
	consignee,
	vessel,
	portOfLoading,
	portOfDischarge,
	containerNumbers,
	descriptionGoods,
	weightKg,
}) {
	const lines = [
		`BL Number: ${blNumber}`,
		`Type: ${blType}`,
		`FTR: ${ftrCode}`,
		`Shipper: ${shipper && shipper.name}`,
		`Consignee: ${consignee && consignee.name}`,
		`Vessel: ${vessel && vessel.name} / Voyage: ${vessel && vessel.voyage}`,
		`Port of Loading: ${portOfLoading}`,
		`Port of Discharge: ${portOfDischarge}`,
		`Containers: ${(containerNumbers || []).join(', ')}`,
		`Description of Goods: ${descriptionGoods}`,
		`Weight: ${weightKg} kg`,
	];

	return createDocumentPdf('BILL OF LADING', lines);
}

module.exports = { generateBillOfLadingPdf, isConsigneeAddressMatching };
