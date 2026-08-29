const logger = require('../../utils/logger');
const { getAflatoxinLimitPpb } = require('./marketRequirements');
const { isAflatoxinWithinLimit } = require('./aflatoxinCheck');
const { needsExpiryAlert, daysUntilExpiry } = require('./alerts');
const { buildComplianceChecklist } = require('./checklist');

// COMPLIANCE: ACID calendar mgmt, import permit tracking, aflatoxin spec validation, phyto renewal alerts. SLA: Daily 06:00.
async function process(context) {
	const { ftrCode, market, labResultPpb, presentDocuments, expiryDates } = context;

	const aflatoxinLimitPpb = getAflatoxinLimitPpb(market);
	const aflatoxinCheck = {
		limit_ppb: aflatoxinLimitPpb,
		result_ppb: labResultPpb ?? null,
		within_limit: isAflatoxinWithinLimit(labResultPpb, aflatoxinLimitPpb),
	};

	const checklist = buildComplianceChecklist(market, presentDocuments);

	const alerts = Object.entries(expiryDates || {}).map(([document, expiryDateIso]) => ({
		document,
		days_until_expiry: daysUntilExpiry(expiryDateIso),
		needs_alert: needsExpiryAlert(expiryDateIso),
	}));

	if (!checklist.complete) {
		logger.warn('Documento de compliance faltando', {
			ftrCode,
			market,
			missing: checklist.items.filter((item) => !item.present).map((item) => item.document),
		});
	}

	if (aflatoxinCheck.within_limit === false) {
		logger.warn('Resultado de aflatoxina acima do limite', { ftrCode, market, ...aflatoxinCheck });
	}

	const alertsNeeded = alerts.filter((alert) => alert.needs_alert);
	if (alertsNeeded.length > 0) {
		logger.warn('Documentos de compliance próximos do vencimento', { ftrCode, alerts: alertsNeeded });
	}

	return {
		agent: 'compliance',
		ftr_code: ftrCode,
		market,
		aflatoxin_check: aflatoxinCheck,
		checklist,
		alerts,
	};
}

module.exports = { process };
