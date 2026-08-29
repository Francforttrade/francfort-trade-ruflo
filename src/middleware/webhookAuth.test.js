const { requireWebhookSecret } = require('./webhookAuth');

function buildRes() {
	const res = {};
	res.status = jest.fn(() => res);
	res.json = jest.fn(() => res);
	return res;
}

describe('webhookAuth requireWebhookSecret', () => {
	const originalSecret = process.env.WEBHOOK_SHARED_SECRET;

	afterEach(() => {
		process.env.WEBHOOK_SHARED_SECRET = originalSecret;
	});

	test('calls next() when the header matches the configured secret', () => {
		process.env.WEBHOOK_SHARED_SECRET = 'top-secret';
		const req = { get: () => 'top-secret' };
		const res = buildRes();
		const next = jest.fn();

		requireWebhookSecret(req, res, next);

		expect(next).toHaveBeenCalled();
		expect(res.status).not.toHaveBeenCalled();
	});

	test('rejects with 401 when the header is missing or wrong', () => {
		process.env.WEBHOOK_SHARED_SECRET = 'top-secret';
		const res = buildRes();
		const next = jest.fn();

		requireWebhookSecret({ get: () => 'wrong' }, res, next);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(next).not.toHaveBeenCalled();

		res.status.mockClear();
		requireWebhookSecret({ get: () => undefined }, res, next);
		expect(res.status).toHaveBeenCalledWith(401);
	});

	test('rejects with 500 when no secret is configured server-side', () => {
		delete process.env.WEBHOOK_SHARED_SECRET;
		const res = buildRes();
		const next = jest.fn();

		requireWebhookSecret({ get: () => 'anything' }, res, next);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(next).not.toHaveBeenCalled();
	});
});
