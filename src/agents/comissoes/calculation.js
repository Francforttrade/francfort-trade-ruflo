// ROADMAP: "Calculate commission (% or USD/MT)" — matches the `commissions`
// table's commission_type: Percentage, Per MT, Flat Fee.
function calculateCommission({ commissionType, commissionRate, baseUsd, quantityMt }) {
	switch (commissionType) {
		case 'Percentage':
			return (baseUsd * commissionRate) / 100;
		case 'Per MT':
			return commissionRate * quantityMt;
		case 'Flat Fee':
			return commissionRate;
		default:
			throw new Error(`Tipo de comissão desconhecido: ${commissionType}`);
	}
}

module.exports = { calculateCommission };
