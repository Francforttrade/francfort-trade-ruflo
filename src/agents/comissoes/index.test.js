const { process } = require('./index');

describe('comissoes agent', () => {
	test('calculates commission by percentage and generates a commission id', async () => {
		const result = await process({
			ftrCode: '03075-26',
			commissionType: 'Percentage',
			commissionRate: 2,
			baseUsd: 750000,
			sequence: 1,
		});

		expect(result.commission_amount_usd).toBe(15000);
		expect(result.commission_id).toBe(`COM-000001-${String(new Date().getFullYear()).slice(-2)}`);
	});

	test('calculates commission per MT', async () => {
		const result = await process({ ftrCode: '03075-26', commissionType: 'Per MT', commissionRate: 25, quantityMt: 600 });
		expect(result.commission_amount_usd).toBe(15000);
	});

	test('flags a reconciliation mismatch when the paid amount differs', async () => {
		const result = await process({
			ftrCode: '03075-26',
			commissionType: 'Flat Fee',
			commissionRate: 5000,
			paidAmountUsd: 4500,
		});

		expect(result.reconciled).toBe(false);
	});

	test('reconciles when the paid amount matches', async () => {
		const result = await process({
			ftrCode: '03075-26',
			commissionType: 'Flat Fee',
			commissionRate: 5000,
			paidAmountUsd: 5000,
		});

		expect(result.reconciled).toBe(true);
	});
});
