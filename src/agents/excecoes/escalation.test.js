const { buildEscalationMessage } = require('./escalation');

describe('excecoes escalation', () => {
	test('matches the exact ROADMAP example message', () => {
		const message = buildEscalationMessage({ ftrCode: '03075-26', agent: 'financeiro', reason: 'SWIFT timeout' });
		expect(message).toBe('Ação necessária: FTR 03075-26 agente FINANCEIRO falhou (motivo: SWIFT timeout)');
	});
});
