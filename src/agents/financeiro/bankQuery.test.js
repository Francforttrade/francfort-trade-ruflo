const { queryBankCreditConfirmation } = require('./bankQuery');

describe('financeiro bankQuery (mock)', () => {
	test('confirms credit for a given SWIFT reference', async () => {
		const result = await queryBankCreditConfirmation('ITAU123ABC456XYZ');
		expect(result.confirmed).toBe(true);
		expect(result.swift_reference).toBe('ITAU123ABC456XYZ');
	});
});
