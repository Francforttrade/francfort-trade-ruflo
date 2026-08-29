const logger = require('../../utils/logger');
const { generateBillOfLadingPdf, isConsigneeAddressMatching } = require('./billOfLading');
const { generateInvoicePdf } = require('./invoice');
const { generateCertificateOfOriginPdf } = require('./certificateOfOrigin');
const { generatePhytosanitaryPdf, isPhytoValid } = require('./phytosanitary');
const { buildDocumentChecklist, isWithinDocumentationSla } = require('./checklist');

const GENERATORS = {
	BL: async (context) => {
		const pdfBytes = await generateBillOfLadingPdf(context);
		return {
			doc_type: 'BL',
			pdf_base64: Buffer.from(pdfBytes).toString('base64'),
			consignee_address_matches_buyer: isConsigneeAddressMatching(
				context.consignee && context.consignee.address,
				context.buyer && context.buyer.address
			),
		};
	},
	Invoice: async (context) => ({
		doc_type: 'Invoice',
		pdf_base64: Buffer.from(await generateInvoicePdf(context)).toString('base64'),
	}),
	CO: async (context) => ({
		doc_type: 'CO',
		pdf_base64: Buffer.from(await generateCertificateOfOriginPdf(context)).toString('base64'),
	}),
	Phyto: async (context) => ({
		doc_type: 'Phyto',
		pdf_base64: Buffer.from(await generatePhytosanitaryPdf(context)).toString('base64'),
		is_valid: context.issueDate ? isPhytoValid(context.issueDate) : null,
	}),
};

// DOCUMENTACAO: Assemble BL/CO/Phyto/fumigation, generate invoice, validate document set. SLA: 48h pre-ETD.
async function process(context) {
	if (context.docType) {
		const generator = GENERATORS[context.docType];
		if (!generator) {
			throw new Error(`Tipo de documento desconhecido: ${context.docType}`);
		}

		const result = await generator(context);
		logger.info('Documento gerado', { ftrCode: context.ftrCode, docType: context.docType });
		return { agent: 'documentacao', ftr_code: context.ftrCode, ...result };
	}

	const checklist = buildDocumentChecklist(context.presentDocuments);
	const withinSla = context.etd ? isWithinDocumentationSla(context.etd) : null;

	if (!checklist.complete && withinSla === false) {
		logger.warn('Checklist de documentos incompleto e fora do SLA de 48h pré-ETD', { ftrCode: context.ftrCode });
	}

	return {
		agent: 'documentacao',
		ftr_code: context.ftrCode,
		checklist,
		within_sla: withinSla,
	};
}

module.exports = { process };
