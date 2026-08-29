const { calculateCommission } = require('./calculation');

describe('comissoes calculation', () => {
	test('Percentage: applies the rate over the base value', () => {
		expect(calculateCommission({ commissionType: 'Percentage', commissionRate: 2, baseUsd: 750000 })).toBe(15000);
	});

	test('Per MT: multiplies the rate by quantity', () => {
		expect(calculateCommission({ commissionType: 'Per MT', commissionRate: 25, quantityMt: 600 })).toBe(15000);
	});

	test('Flat Fee: returns the rate as-is', () => {
		expect(calculateCommission({ commissionType: 'Flat Fee', commissionRate: 5000 })).toBe(5000);
	});

	test('rejects an unknown commission type', () => {
		expect(() => calculateCommission({ commissionType: 'Bogus', commissionRate: 1 })).toThrow(/desconhecido/);
	});
});
