process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'test';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_KEY = process.env.SUPABASE_KEY || 'test-key';

const master = require('./master');

describe('orchestrator master', () => {
	test('routes a valid FTR to the target agent', async () => {
		const result = await master.route({ ftrCode: 'FTR-1', targetAgent: 'contratos' });
		expect(result.agent).toBe('contratos');
	});

	test('routes a valid FTR to digitalizacao (needs_review when there is nothing to extract)', async () => {
		// digitalizacao escalates needs_review straight to EXCECOES (see
		// digitalizacao/index.js's escalate()), which writes to Firestore —
		// stub it out the same way the comunicacao/comercial tests below do,
		// since this suite otherwise runs without any Firestore mocking.
		const original = master.AGENTS.excecoes.process;
		master.AGENTS.excecoes.process = jest.fn().mockResolvedValue({ agent: 'excecoes' });

		const result = await master.route({ ftrCode: 'FTR-1', targetAgent: 'digitalizacao' });

		master.AGENTS.excecoes.process = original;
		expect(result.agent).toBe('digitalizacao');
		expect(result.needs_review).toBe(true);
		expect(result.escalated_to_excecoes).toBe(true);
	});

	test('sends invalid FTR to excecoes', async () => {
		const result = await master.route({ targetAgent: 'contratos' });
		expect(result.agent).toBe('excecoes');
	});

	test('sends unknown agent to excecoes', async () => {
		const result = await master.route({ ftrCode: 'FTR-1', targetAgent: 'inexistente' });
		expect(result.agent).toBe('excecoes');
	});

	test('routes to comunicacao without requiring an FTR code (intake step)', async () => {
		const original = master.AGENTS.comunicacao.process;
		master.AGENTS.comunicacao.process = async (ctx) => ({ agent: 'comunicacao', received: ctx.body });

		const result = await master.route({ body: 'Oferta de 600 MT peanuts', targetAgent: 'comunicacao' });

		master.AGENTS.comunicacao.process = original;
		expect(result.agent).toBe('comunicacao');
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
