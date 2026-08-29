process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key';

const master = require('./master');

describe('orchestrator master', () => {
	test('routes a valid FTR to the target agent', async () => {
		const result = await master.route({ ftrCode: 'FTR-1', targetAgent: 'comercial' });
		expect(result.agent).toBe('comercial');
	});

	test('sends invalid FTR to excecoes', async () => {
		const result = await master.route({ targetAgent: 'comercial' });
		expect(result.agent).toBe('excecoes');
	});

	test('sends unknown agent to excecoes', async () => {
		const result = await master.route({ ftrCode: 'FTR-1', targetAgent: 'inexistente' });
		expect(result.agent).toBe('excecoes');
	});

	test('serializes concurrent routing for the same FTR', async () => {
		const order = [];
		const original = master.AGENTS.comercial.process;
		master.AGENTS.comercial.process = async (ctx) => {
			order.push(`start-${ctx.seq}`);
			await new Promise((resolve) => setTimeout(resolve, 10));
			order.push(`end-${ctx.seq}`);
			return { agent: 'comercial' };
		};

		await Promise.all([
			master.route({ ftrCode: 'FTR-2', targetAgent: 'comercial', seq: 1 }),
			master.route({ ftrCode: 'FTR-2', targetAgent: 'comercial', seq: 2 }),
		]);

		master.AGENTS.comercial.process = original;
		expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
	});
});
