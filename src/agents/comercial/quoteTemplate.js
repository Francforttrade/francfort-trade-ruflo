function formatUsd(value) {
	return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateOfferText({ seller, buyer, product, quantity, incoterm, unitPriceUsd, totalValueUsd, paymentTerms }) {
	const lines = [
		'OFERTA COMERCIAL',
		'',
		`Vendedor: ${seller}`,
		`Comprador: ${buyer}`,
		`Produto: ${[product.type, product.grade].filter(Boolean).join(' ')}`,
		`Quantidade: ${quantity.mt} MT`,
		`Incoterm: ${incoterm}`,
		`Preço unitário: USD ${formatUsd(unitPriceUsd)}/MT`,
		`Valor total: USD ${formatUsd(totalValueUsd)}`,
	];

	if (paymentTerms) {
		lines.push(`Condições de pagamento: ${paymentTerms}`);
	}

	lines.push('', 'Rodrigo Francfort – Francfort Trade');

	return lines.join('\n');
}

module.exports = { generateOfferText };
