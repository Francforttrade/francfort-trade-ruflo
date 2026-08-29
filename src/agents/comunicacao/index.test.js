const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));

jest.mock('../../services/firestore', () => ({
	firestore: { collection: (...args) => mockCollection(...args) },
	COLLECTIONS: { SESSIONS: 'sessions' },
}));

const { process } = require('./index');

describe('comunicacao agent', () => {
	beforeEach(() => {
		mockSet.mockClear();
		mockDoc.mockClear();
		mockCollection.mockClear();
	});

	test('parses the message and persists a session to Firestore', async () => {
		const result = await process({
			channel: 'whatsapp',
			from: '+5511999999999',
			body: 'Oferta de 600 MT peanuts 38/42',
			threadId: 'thread-1',
		});

		expect(mockCollection).toHaveBeenCalledWith('sessions');
		expect(mockDoc).toHaveBeenCalledWith('thread-1');
		expect(mockSet).toHaveBeenCalledWith(
			expect.objectContaining({
				session_id: 'thread-1',
				channel: 'whatsapp',
				intent: 'quote_offer',
				quantity: { mt: 600 },
			})
		);

		expect(result.agent).toBe('comunicacao');
		expect(result.session_id).toBe('thread-1');
		expect(result.intent).toBe('quote_offer');
		expect(result.response_template).toMatch(/oferta/i);
	});

	test('generates a session id when no threadId is given', async () => {
		const result = await process({ channel: 'whatsapp', body: 'Booking confirmado' });
		expect(result.session_id).toMatch(/^sess-\d+$/);
		expect(result.intent).toBe('booking');
	});
});
