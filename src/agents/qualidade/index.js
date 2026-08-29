const logger = require('../../utils/logger');
const { firestore, COLLECTIONS } = require('../../services/firestore');
const { parseLabReportFilename } = require('./filenameParser');
const { isAccreditedLab } = require('./accreditedLabs');
const { parseLabReportText } = require('./labReportParser');
const { getAflatoxinLimitPpb } = require('../compliance/marketRequirements');
const { isAflatoxinWithinLimit } = require('../compliance/aflatoxinCheck');
const { buildApprovalRecord } = require('./buyerApproval');

// QUALIDADE: Lab report parsing, aflatoxin/moisture/purity validation, buyer quality approval. SLA: 5 days.
async function process(context) {
	if (context.action === 'buyer_approval') {
		const approval = buildApprovalRecord(context);
		await firestore
			.collection(COLLECTIONS.SESSIONS)
			.doc(`quality-${context.ftrCode}-${Date.now()}`)
			.set({ ftr_code: context.ftrCode, type: 'quality_approval', ...approval });

		logger.info('Aprovação de qualidade do buyer registrada', { ftrCode: context.ftrCode, approved: approval.approved });
		return { agent: 'qualidade', ftr_code: context.ftrCode, approval };
	}

	const filenameInfo = context.filename ? parseLabReportFilename(context.filename) : null;
	const labAccredited = filenameInfo ? isAccreditedLab(filenameInfo.labName) : null;
	const parsedReport = context.reportText ? parseLabReportText(context.reportText) : {};

	const aflatoxinPpb = context.labResultPpb ?? parsedReport.aflatoxin_ppb ?? null;
	const limitPpb = getAflatoxinLimitPpb(context.market);
	const withinLimit = isAflatoxinWithinLimit(aflatoxinPpb, limitPpb);

	if (withinLimit === false) {
		logger.warn('Aflatoxina fora do limite — escalação para seller/buyer', {
			ftrCode: context.ftrCode,
			market: context.market,
			aflatoxinPpb,
			limitPpb,
		});
	}

	return {
		agent: 'qualidade',
		ftr_code: context.ftrCode,
		filename_info: filenameInfo,
		lab_accredited: labAccredited,
		aflatoxin_check: { result_ppb: aflatoxinPpb, limit_ppb: limitPpb, within_limit: withinLimit },
		moisture_pct: parsedReport.moisture_pct ?? null,
		purity_pct: parsedReport.purity_pct ?? null,
		needs_escalation: withinLimit === false,
	};
}

module.exports = { process };
