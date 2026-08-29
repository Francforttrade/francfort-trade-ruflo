const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('../../services/firestore', () => ({
	firestore: { collection: (...args) => mockCollection(...args) },
	COLLECTIONS: { AUDIT_LOG: 'audit_log' },
}));

const { process } = require('./index');

describe('financeiro agent', () => {
	beforeEach(() => {
		mockSet.mockClear();
		mockDoc.mockClear();
		mockCollection.mockClear();
	});

	test('GATE CRÍTICO: releases documents and writes an audit entry when all conditions hold', async () => {
		const result = await process({
			ftrCode: '03075-26',
			swiftReference: 'ITAU123ABC456XYZ',
			invoiceStatus: 'Issued',
			paymentStatus: 'Received',
			userEmail: 'rodrigo@francfort.co',
		});

		expect(result.release_flag).toBe(true);
		expect(result.bank_credit_confirmed).toBe(true);
		expect(result.audit_id).toMatch(/^AUD-/);
		expect(mockCollection).toHaveBeenCalledWith('audit_log');
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: 'release_documents',
				resource_id: '03075-26',
				after_state: expect.objectContaining({ original_documents_released: true }),
			})
		);
	});

	test('rejects a malformed SWIFT reference without querying the bank or releasing', async () => {
		const result = await process({
			ftrCode: '03075-26',
			swiftReference: 'not-a-valid-ref',
			invoiceStatus: 'Issued',
			paymentStatus: 'Received',
		});

		expect(result.swift_valid).toBe(false);
		expect(result.release_flag).toBe(false);
		expect(mockCollection).not.toHaveBeenCalled();
	});

	test('blocks release when invoice is still a draft, even with confirmed credit', async () => {
		const result = await process({
			ftrCode: '03075-26',
			swiftReference: 'ITAU123ABC456XYZ',
			invoiceStatus: 'Draft',
			paymentStatus: 'Received',
		});

		expect(result.bank_credit_confirmed).toBe(true);
		expect(result.release_flag).toBe(false);
		expect(mockCollection).not.toHaveBeenCalled();
	});

	test('accepts an already-known bank_credit_confirmed value without re-querying the bank', async () => {
		const result = await process({
			ftrCode: '03075-26',
			bankCreditConfirmed: false,
			invoiceStatus: 'Issued',
			paymentStatus: 'Received',
		});

		expect(result.bank_credit_confirmed).toBe(false);
		expect(result.release_flag).toBe(false);
	});

	test('flags a suspiciously early payment for reconciliation', async () => {
		const result = await process({
			ftrCode: '03075-26',
			invoiceStatus: 'Draft',
			paymentStatus: 'Pending',
			paymentDate: '2026-08-01',
			etaDate: '2026-08-20',
		});

		expect(result.reconciliation).toEqual({ suspiciously_early: true });
	});
});
