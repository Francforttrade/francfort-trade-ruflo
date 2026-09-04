process.env.GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'test';

function makeDocRef({ exists, data } = {}) {
	const snapshot = { exists: Boolean(exists), data: () => data || {} };
	return {
		get: jest.fn().mockResolvedValue(snapshot),
		set: jest.fn().mockResolvedValue(undefined),
	};
}

function mockFirestoreWith(docRef) {
	jest.doMock('../../services/firestore', () => ({
		firestore: { collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })) },
		COLLECTIONS: jest.requireActual('../../services/firestore').COLLECTIONS,
	}));
}

describe('digitalizacao dedupCache', () => {
	beforeEach(() => {
		jest.resetModules();
	});

	afterEach(() => {
		jest.dontMock('../../services/firestore');
	});

	describe('getCached', () => {
		test('returns null when there is no cache entry', async () => {
			mockFirestoreWith(makeDocRef({ exists: false }));
			const { getCached } = require('./dedupCache');

			expect(await getCached('abc123')).toBeNull();
		});

		test('returns the cached extraction when fresh', async () => {
			mockFirestoreWith(
				makeDocRef({
					exists: true,
					data: {
						extracted_text: 'Invoice Number: INV-01',
						table_rows: [{ a: 1 }],
						cached_at: new Date().toISOString(),
						first_seen_ftr_code: '03075-26',
					},
				})
			);
			const { getCached } = require('./dedupCache');

			expect(await getCached('abc123')).toEqual({
				extractedText: 'Invoice Number: INV-01',
				tableRows: [{ a: 1 }],
			});
		});

		test('returns null once the entry is older than CACHE_TTL_DAYS', async () => {
			const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000).toISOString();
			mockFirestoreWith(
				makeDocRef({ exists: true, data: { extracted_text: 'stale', cached_at: ninetyOneDaysAgo } })
			);
			const { getCached } = require('./dedupCache');

			expect(await getCached('abc123')).toBeNull();
		});

		test('returns null without querying Firestore when there is no hash', async () => {
			const docRef = makeDocRef({ exists: true, data: {} });
			mockFirestoreWith(docRef);
			const { getCached } = require('./dedupCache');

			expect(await getCached(null)).toBeNull();
			expect(docRef.get).not.toHaveBeenCalled();
		});
	});

	describe('setCached', () => {
		test('stores extractedText/tableRows and the FTR that first produced this hash', async () => {
			const docRef = makeDocRef({ exists: false });
			mockFirestoreWith(docRef);
			const { setCached } = require('./dedupCache');

			await setCached('abc123', { extractedText: 'text', tableRows: null }, '03075-26');

			expect(docRef.set).toHaveBeenCalledWith(
				expect.objectContaining({ extracted_text: 'text', table_rows: null, first_seen_ftr_code: '03075-26' }),
				{ merge: true }
			);
		});

		test('preserves the original first_seen_ftr_code on a later overwrite under a different FTR', async () => {
			const docRef = makeDocRef({ exists: true, data: { first_seen_ftr_code: '03075-26' } });
			mockFirestoreWith(docRef);
			const { setCached } = require('./dedupCache');

			await setCached('abc123', { extractedText: 'text again' }, '03080-26');

			expect(docRef.set).toHaveBeenCalledWith(
				expect.objectContaining({ first_seen_ftr_code: '03075-26' }),
				{ merge: true }
			);
		});

		test('does nothing when there is no hash', async () => {
			const docRef = makeDocRef();
			mockFirestoreWith(docRef);
			const { setCached } = require('./dedupCache');

			await setCached(null, { extractedText: 'text' }, '03075-26');

			expect(docRef.set).not.toHaveBeenCalled();
		});
	});
});
