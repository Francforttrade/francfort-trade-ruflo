const express = require('express');

const mockRoute = jest.fn().mockResolvedValue({ agent: 'comunicacao', session_id: 'sess-1' });

jest.mock('../orchestrator/master', () => ({
	route: (...args) => mockRoute(...args),
}));

const routes = require('./index');

let server;
let baseUrl;

beforeAll((done) => {
	const app = express();
	app.use(express.json());
	app.use(routes);
	server = app.listen(0, () => {
		baseUrl = `http://127.0.0.1:${server.address().port}`;
		done();
	});
});

afterAll((done) => {
	server.close(done);
});

beforeEach(() => {
	mockRoute.mockClear();
});

describe('routes', () => {
	test('POST /webhook-whatsapp routes to comunicacao on the whatsapp channel', async () => {
		const res = await fetch(`${baseUrl}/webhook-whatsapp`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ from: '+5511999999999', body: 'Oferta de 600 MT peanuts 38/42' }),
		});

		expect(res.status).toBe(200);
		expect(mockRoute).toHaveBeenCalledWith(
			expect.objectContaining({ channel: 'whatsapp', targetAgent: 'comunicacao', from: '+5511999999999' })
		);
	});

	test('POST /webhook-email routes to comunicacao on the email channel', async () => {
		const res = await fetch(`${baseUrl}/webhook-email`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				from: 'buyer@example.com',
				subject: 'FTR 03075-26',
				body: 'Booking confirmado',
				threadId: 'thread-1',
			}),
		});

		expect(res.status).toBe(200);
		expect(mockRoute).toHaveBeenCalledWith(
			expect.objectContaining({
				channel: 'email',
				targetAgent: 'comunicacao',
				from: 'buyer@example.com',
				threadId: 'thread-1',
			})
		);
	});

	test('GET /rastrear routes to logistics using query params', async () => {
		const res = await fetch(`${baseUrl}/rastrear?container=MAEU1234567`);

		expect(res.status).toBe(200);
		expect(mockRoute).toHaveBeenCalledWith(
			expect.objectContaining({ targetAgent: 'logistics', container: 'MAEU1234567' })
		);
	});
});
