const logger = require('../../utils/logger');
const { calculateCommission } = require('./calculation');
const { isAccrualDay } = require('./accrualSchedule');
const { buildCommissionId } = require('./invoiceNumbering');
const { isPaymentReconciled } = require('./reconciliation');

// COMISSOES: % calculation, invoice generation, payment reconciliation. SLA: Monthly accrual on days 10/25.
async function process(context) {
	const { ftrCode, commissionType, commissionRate, baseUsd, quantityMt, sequence, paidAmountUsd } = context;

	const commissionAmountUsd = calculateCommission({ commissionType, commissionRate, baseUsd, quantityMt });
	const commissionId = sequence != null ? buildCommissionId(sequence) : null;
	const reconciled = isPaymentReconciled(paidAmountUsd, commissionAmountUsd);

	if (paidAmountUsd != null && !reconciled) {
		logger.warn('Comissão paga não bate com o valor calculado', { ftrCode, commissionAmountUsd, paidAmountUsd });
	}

	return {
		agent: 'comissoes',
		ftr_code: ftrCode,
		commission_id: commissionId,
		commission_amount_usd: commissionAmountUsd,
		is_accrual_day: isAccrualDay(),
		reconciled,
	};
}

module.exports = { process };
