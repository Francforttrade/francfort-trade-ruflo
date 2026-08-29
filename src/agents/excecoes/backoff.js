// ROADMAP: "Exponential backoff: 1s, 5s, 30s, 5m, 30m" / "Max 3 retries".
const BACKOFF_SCHEDULE_MS = [1000, 5000, 30000, 5 * 60 * 1000, 30 * 60 * 1000];
const MAX_RETRIES = 3;

function getBackoffDelayMs(retryCount) {
	const index = Math.min(retryCount, BACKOFF_SCHEDULE_MS.length - 1);
	return BACKOFF_SCHEDULE_MS[index];
}

function shouldRetry(retryCount) {
	return retryCount < MAX_RETRIES;
}

module.exports = { BACKOFF_SCHEDULE_MS, MAX_RETRIES, getBackoffDelayMs, shouldRetry };
