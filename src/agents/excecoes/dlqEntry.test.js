const { buildDlqEntry } = require('./dlqEntry');

describe('excecoes dlqEntry', () => {
	test('builds a falhas_processamento entry with the required fields', () => {
		const entry = buildDlqEntry({ ftrCode: '03075-26', agent: 'financeiro', errorMsg: 'SWIFT timeout', retryCount: 3 });
		expect(entry.ftr_code).toBe('03075-26');
		expect(entry.agent).toBe('financeiro');
		expect(entry.error_msg).toBe('SWIFT timeout');
		expect(entry.retry_count).toBe(3);
		expect(typeof entry.timestamp).toBe('string');
	});
});
