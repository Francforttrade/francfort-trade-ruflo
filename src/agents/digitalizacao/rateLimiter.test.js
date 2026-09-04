process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'test';

function makeDocRef({ exists, data } = {}) {
	return {
		get: jest.fn().mockResolvedValue({ exists: Boolean(exists), data: () => data || {} }),
		set: jest.fn().mockResolvedValue(undefined),
	};
}

function mockFirestoreWith(byDocId) {
	jest.doMock('../../services/firestore', () => ({
		firestore: {
			collection: jest.fn(() => ({
				doc: jest.fn((docId) => byDocId[docId] || makeDocRef()),
			})),
		},
		COLLECTIONS: jest.requireActual('../../services/firestore').COLLECTIONS,
	}));
}

describe('digitalizacao rateLimiter', () => {
	beforeEach(() => {
		jest.resetModules();
		process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_FTR = '3';
		process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_DAY = '5';
	});

	afterEach(() => {
		jest.dontMock('../../services/firestore');
		delete process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_FTR;
		delete process.env.DIGITALIZACAO_MAX_PAID_CALLS_PER_DAY;
	});

	function todayDocId(kind) {
		return `${kind}-day-${new Date().toISOString().slice(0, 10)}`;
	}

	describe('isUnderPaidCallCap', () => {
		test('true when both the per-FTR and per-day counters are below their caps', async () => {
			mockFirestoreWith({
				'paddle-ftr-03075-26': makeDocRef({ exists: true, data: { count: 1 } }),
				[todayDocId('paddle')]: makeDocRef({ exists: true, data: { count: 2 } }),
			});
			const { isUnderPaidCallCap } = require('./rateLimiter');

			expect(await isUnderPaidCallCap('paddle', '03075-26')).toBe(true);
		});

		test('false once the per-FTR cap is reached, even with headroom left for the day', async () => {
			mockFirestoreWith({
				'paddle-ftr-03075-26': makeDocRef({ exists: true, data: { count: 3 } }),
				[todayDocId('paddle')]: makeDocRef({ exists: true, data: { count: 0 } }),
			});
			const { isUnderPaidCallCap } = require('./rateLimiter');

			expect(await isUnderPaidCallCap('paddle', '03075-26')).toBe(false);
		});

		test('false once the per-day cap is reached, even for an FTR with no calls yet', async () => {
			mockFirestoreWith({
				'paddle-ftr-03075-26': makeDocRef({ exists: false }),
				[todayDocId('paddle')]: makeDocRef({ exists: true, data: { count: 5 } }),
			});
			const { isUnderPaidCallCap } = require('./rateLimiter');

			expect(await isUnderPaidCallCap('paddle', '03075-26')).toBe(false);
		});

		test('true when neither counter document exists yet', async () => {
			mockFirestoreWith({});
			const { isUnderPaidCallCap } = require('./rateLimiter');

			expect(await isUnderPaidCallCap('paddle', '03075-26')).toBe(true);
		});

		test('paddle and document_ai track separate budgets — one hitting its cap does not throttle the other', async () => {
			mockFirestoreWith({
				'paddle-ftr-03075-26': makeDocRef({ exists: true, data: { count: 3 } }),
				[todayDocId('paddle')]: makeDocRef({ exists: true, data: { count: 0 } }),
				'document_ai-ftr-03075-26': makeDocRef({ exists: true, data: { count: 0 } }),
				[todayDocId('document_ai')]: makeDocRef({ exists: true, data: { count: 0 } }),
			});
			const { isUnderPaidCallCap } = require('./rateLimiter');

			expect(await isUnderPaidCallCap('paddle', '03075-26')).toBe(false);
			expect(await isUnderPaidCallCap('document_ai', '03075-26')).toBe(true);
		});
	});

	describe('recordPaidCall', () => {
		test('increments both the per-FTR and per-day counters for the given kind', async () => {
			const ftrDoc = makeDocRef({ exists: true, data: { count: 1 } });
			const dayDoc = makeDocRef({ exists: true, data: { count: 2 } });
			mockFirestoreWith({ 'document_ai-ftr-03075-26': ftrDoc, [todayDocId('document_ai')]: dayDoc });
			const { recordPaidCall } = require('./rateLimiter');

			await recordPaidCall('document_ai', '03075-26');

			expect(ftrDoc.set).toHaveBeenCalledWith(expect.objectContaining({ count: expect.anything() }), { merge: true });
			expect(dayDoc.set).toHaveBeenCalledWith(expect.objectContaining({ count: expect.anything() }), { merge: true });
		});
	});
});
