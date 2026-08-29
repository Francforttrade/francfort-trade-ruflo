const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('../../services/firestore', () => ({
	firestore: { collection: (...args) => mockCollection(...args) },
	COLLECTIONS: { AUDIT_LOG: 'audit_log' },
}));

const { process } = require('./index');

describe('contratos agent', () => {
	beforeEach(() => {
		mockSet.mockClear();
		mockDoc.mockClear();
		mockCollection.mockClear();
	});

	test('parses the contract and checks credit limit without an amendment', async () => {
		const result = await process({
			ftrCode: '03075-26',
			buyer: { credit_limit_usd: 750000 },
			sellerSigned: true,
			buyerSigned: true,
			body: 'Seller: Teknofert\nBuyer: SARL Tassali\n600 MT peanuts 38/42\nUSD 1250/MT\nCFR',
		});

		expect(result.agent).toBe('contratos');
		expect(result.total_value_usd).toBe(750000);
		expect(result.credit_check).toEqual({ within_limit: true });
		expect(result.signature_check).toEqual({ complete: true });
		expect(result.new_ftr_code).toBeNull();
		expect(result.audit_id).toBeNull();
		expect(mockCollection).not.toHaveBeenCalled();
	});

	test('flags credit limit exceeded', async () => {
		const result = await process({
			ftrCode: '03075-26',
			buyer: { credit_limit_usd: 100000 },
			body: 'USD 1250/MT\n600 MT',
		});

		expect(result.credit_check).toEqual({ within_limit: false });
	});

	test('detects an amendment, versions the FTR, and writes an audit log entry', async () => {
		const result = await process({
			ftrCode: '03075-26',
			userEmail: 'rodrigo@francfort.co',
			previousQuantityMt: 600,
			body: 'Alteração para 550 MT conforme solicitado pelo comprador',
		});

		expect(result.new_ftr_code).toBe('03075-26-1');
		expect(result.audit_id).toMatch(/^AUD-/);
		expect(mockCollection).toHaveBeenCalledWith('audit_log');
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: 'amend_ftr',
				resource_id: '03075-26',
				before_state: { quantity_mt: 600 },
				after_state: { quantity_mt: 550, new_ftr_code: '03075-26-1' },
			})
		);
	});

	test('handles a message with no contract content without crashing (generic routing)', async () => {
		const result = await process({ ftrCode: '03075-26' });
		expect(result.agent).toBe('contratos');
		expect(result.total_value_usd).toBeNull();
		expect(result.credit_check).toEqual({ within_limit: null });
	});
});
