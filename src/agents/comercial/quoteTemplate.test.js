const { generateOfferText } = require('./quoteTemplate');

describe('comercial quote template', () => {
	test('fills the offer template for Brazil peanuts (ROADMAP unit test)', () => {
		const text = generateOfferText({
			seller: 'Teknofert',
			buyer: 'SARL Tassali',
			product: { type: 'Peanuts', grade: '38/42' },
			quantity: { mt: 600 },
			incoterm: 'CFR',
			unitPriceUsd: 1250,
			totalValueUsd: 750000,
			paymentTerms: '15% adv + 85% CAD at sight',
		});

		expect(text).toContain('Vendedor: Teknofert');
		expect(text).toContain('Comprador: SARL Tassali');
		expect(text).toContain('Produto: Peanuts 38/42');
		expect(text).toContain('Quantidade: 600 MT');
		expect(text).toContain('Incoterm: CFR');
		expect(text).toContain('Preço unitário: USD 1,250.00/MT');
		expect(text).toContain('Valor total: USD 750,000.00');
		expect(text).toContain('Condições de pagamento: 15% adv + 85% CAD at sight');
		expect(text).toContain('Rodrigo Francfort – Francfort Trade');
	});

	test('omits the payment terms line when none is given', () => {
		const text = generateOfferText({
			seller: 'Teknofert',
			buyer: 'SARL Tassali',
			product: { type: 'Peanuts' },
			quantity: { mt: 600 },
			incoterm: 'FOB Santos',
			unitPriceUsd: 1000,
			totalValueUsd: 600000,
		});

		expect(text).not.toContain('Condições de pagamento');
	});
});
