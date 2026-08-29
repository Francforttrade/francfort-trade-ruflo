const { getBackoffDelayMs, shouldRetry, MAX_RETRIES } = require('./backoff');

describe('excecoes backoff', () => {
	test('follows the ROADMAP schedule: 1s, 5s, 30s, 5m, 30m', () => {
		expect(getBackoffDelayMs(0)).toBe(1000);
		expect(getBackoffDelayMs(1)).toBe(5000);
		expect(getBackoffDelayMs(2)).toBe(30000);
		expect(getBackoffDelayMs(3)).toBe(5 * 60 * 1000);
		expect(getBackoffDelayMs(4)).toBe(30 * 60 * 1000);
	});

	test('caps at the longest interval beyond the schedule length', () => {
		expect(getBackoffDelayMs(10)).toBe(30 * 60 * 1000);
	});

	test('allows retrying up to the max, then stops', () => {
		expect(shouldRetry(0)).toBe(true);
		expect(shouldRetry(MAX_RETRIES - 1)).toBe(true);
		expect(shouldRetry(MAX_RETRIES)).toBe(false);
	});
});
