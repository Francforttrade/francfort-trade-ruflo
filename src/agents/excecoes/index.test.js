const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('../../services/firestore', () => ({
	firestore: { collection: (...args) => mockCollection(...args) },
	COLLECTIONS: { AUDIT_LOG: 'audit_log', FALHAS_PROCESSAMENTO: 'falhas_processamento' },
}));

const { process } = require('./index');

describe('excecoes agent', () => {
	beforeEach(() => {
		mockSet.mockClear();
		mockDoc.mockClear();
		mockCollection.mockClear();
	});

	test('schedules a retry with backoff when under the max retry count', async () => {
		const result = await process({ action: 'record_failure', ftrCode: '03075-26', agent: 'financeiro', errorMsg: 'SWIFT timeout', retryCount: 1 });

		expect(result.retry).toBe(true);
		expect(result.delay_ms).toBe(5000);
		expect(mockCollection).not.toHaveBeenCalled();
	});

	test('writes to the DLQ and builds the escalation message once retries are exhausted', async () => {
		const result = await process({ action: 'record_failure', ftrCode: '03075-26', agent: 'financeiro', errorMsg: 'SWIFT timeout', retryCount: 3 });

		expect(result.retry).toBe(false);
		expect(result.escalation_message).toBe('Ação necessária: FTR 03075-26 agente FINANCEIRO falhou (motivo: SWIFT timeout)');
		expect(mockCollection).toHaveBeenCalledWith('falhas_processamento');
		expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ ftr_code: '03075-26', agent: 'financeiro', retry_count: 3 }));
	});

	test('records a manual override in the audit log', async () => {
		const result = await process({ action: 'override', ftrCode: '03075-26', approvedBy: 'Rodrigo' });

		expect(result.override.note).toContain('Rodrigo override @');
		expect(mockCollection).toHaveBeenCalledWith('audit_log');
	});

	test('still handles the orchestrator routing-failure shape (backward compatible with master.js)', async () => {
		const result = await process({ reason: 'invalid_ftr', message: { targetAgent: 'comercial' } });

		expect(result.agent).toBe('excecoes');
		expect(result.reason).toBe('invalid_ftr');
		expect(mockCollection).not.toHaveBeenCalled();
	});
});
