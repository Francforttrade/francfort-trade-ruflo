const {
	parseContract,
	extractIncoterm,
	extractUnitPriceUsd,
	extractDeliveryDate,
	extractPaymentTerms,
	detectAmendment,
} = require('./parser');

const SAMPLE_CONTRACT = `Seller: Teknofert
Buyer: SARL Tassali
600 MT peanuts 38/42
USD 1250/MT
CFR
Payment terms: 15% adv + 85% CAD at sight
Delivery date: 2026-08-25`;

describe('contratos parser', () => {
	test('parses a full contract text (config/schemas.json FTR example)', () => {
		const result = parseContract(SAMPLE_CONTRACT);
		expect(result).toMatchObject({
			seller: 'Teknofert',
			buyer: 'SARL Tassali',
			quantity_mt: 600,
			grade: '38/42',
			unit_price_usd: 1250,
			incoterm: 'CFR',
			payment_terms: '15% adv + 85% CAD at sight',
			delivery_date: '2026-08-25',
			is_amendment: false,
			amended_quantity_mt: null,
		});
	});

	test('extracts incoterm regardless of case', () => {
		expect(extractIncoterm('incoterm: fob santos')).toBe('FOB Santos');
		expect(extractIncoterm('sem incoterm aqui')).toBeNull();
	});

	test('extracts unit price in USD/MT', () => {
		expect(extractUnitPriceUsd('USD 1,250.00/MT')).toBeCloseTo(1250.0);
		expect(extractUnitPriceUsd('sem preço')).toBeNull();
	});

	test('extracts delivery date and payment terms', () => {
		expect(extractDeliveryDate('Delivery date: 2026-09-01')).toBe('2026-09-01');
		expect(extractPaymentTerms('Payment terms: CAD at sight')).toBe('CAD at sight');
	});

	test('detects an amendment and the new quantity', () => {
		expect(detectAmendment('Alteração para 550 MT conforme solicitado')).toEqual({
			is_amendment: true,
			amended_quantity_mt: 550,
		});
		expect(detectAmendment('contrato original sem mudanças')).toEqual({
			is_amendment: false,
			amended_quantity_mt: null,
		});
	});
});
