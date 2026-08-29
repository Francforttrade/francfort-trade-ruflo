const mockGetHistoricalAveragePriceUsd = jest.fn();

jest.mock('./pricingLookup', () => ({
	getHistoricalAveragePriceUsd: (...args) => mockGetHistoricalAveragePriceUsd(...args),
}));

const { process } = require('./index');

const baseContext = {
	seller: { name: 'Teknofert' },
	buyer: { name: 'SARL Tassali', credit_limit_usd: 750000 },
	product: { type: 'Peanuts', grade: '38/42' },
	quantity: { mt: 600 },
	incoterm: 'CFR',
	unitPriceUsd: 1250,
	freightUsdPerMt: 0,
};

describe('comercial agent', () => {
	beforeEach(() => {
		mockGetHistoricalAveragePriceUsd.mockReset();
	});

	test('generates an offer and passes price/credit checks when in range', async () => {
		mockGetHistoricalAveragePriceUsd.mockResolvedValue(1200); // 1250 is ~4% above, within tolerance

		const result = await process(baseContext);

		expect(result.agent).toBe('comercial');
		expect(result.total_value_usd).toBe(750000);
		expect(result.offer_text).toContain('Rodrigo Francfort – Francfort Trade');
		expect(result.price_check).toEqual({ historical_avg_usd: 1200, is_dump: false, within_tolerance: true });
		expect(result.credit_check).toEqual({ within_limit: true });
	});

	test('flags a price dump when unit price is 25%+ below the historical average', async () => {
		mockGetHistoricalAveragePriceUsd.mockResolvedValue(2000); // 1250 is -37.5%

		const result = await process(baseContext);

		expect(result.price_check.is_dump).toBe(true);
		expect(result.price_check.within_tolerance).toBe(false);
	});

	test('flags credit limit exceeded', async () => {
		mockGetHistoricalAveragePriceUsd.mockResolvedValue(1200);

		const result = await process({
			...baseContext,
			buyer: { name: 'SARL Tassali', credit_limit_usd: 100000 },
		});

		expect(result.credit_check).toEqual({ within_limit: false });
	});

	test('returns null price_check fields when there is no pricing history', async () => {
		mockGetHistoricalAveragePriceUsd.mockResolvedValue(null);

		const result = await process(baseContext);

		expect(result.price_check).toEqual({ historical_avg_usd: null, is_dump: false, within_tolerance: null });
	});

	test('includes negotiation deadline info when a previous quote timestamp is given', async () => {
		mockGetHistoricalAveragePriceUsd.mockResolvedValue(1200);

		const result = await process({
			...baseContext,
			previousQuoteSentAt: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50h ago
		});

		expect(result.negotiation).toEqual({ seller_review_overdue: true, needs_escalation: true });
	});
});
