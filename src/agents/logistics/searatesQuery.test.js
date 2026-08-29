const { queryContainerTracking } = require('./searatesQuery');

describe('logistics searatesQuery (mock)', () => {
	test('returns a tracking payload for the given container', async () => {
		const result = await queryContainerTracking('MAEU1234567');
		expect(result.container_number).toBe('MAEU1234567');
		expect(result.mocked).toBe(true);
	});
});
