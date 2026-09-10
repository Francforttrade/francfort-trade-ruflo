// ADR-001A PoC — TEST-05 controlled failure-injection test double.
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application. No production business logic, no financial semantics
// (those remain entirely inside TEST-08's separate
// financialGateActivity.js and are never embedded here), no external
// resource access, no network, no Firestore, no Supabase, no Gmail, no
// bank, no LLM.
//
// Failure behavior is driven entirely by explicit test input
// (`failUntilAttempt`) combined with Temporal's own engine-provided
// attempt counter — never by Math.random() or wall-clock time.
// Verified from the installed @temporalio/activity type definitions
// (node_modules/@temporalio/activity/lib/index.d.ts, `interface Info`):
// `readonly attempt: number` — "Attempt number for this activity. Starts
// at 1 and increments for every retry."

const { activityInfo } = require('@temporalio/activity');

/**
 * Throws on every attempt strictly less than `failUntilAttempt`, succeeds
 * starting at attempt `failUntilAttempt`. With `failUntilAttempt` of 1
 * (the default), it succeeds immediately on the first attempt.
 *
 * @param {{failUntilAttempt?: number, payload?: unknown}} input
 * @returns {{succeededOnAttempt: number, payload: unknown}}
 */
function injectableFailureActivity(input) {
	const data = input || {};
	const failUntilAttempt = Number.isInteger(data.failUntilAttempt) ? data.failUntilAttempt : 1;
	const attempt = activityInfo().attempt;

	if (attempt < failUntilAttempt) {
		throw new Error(
			`injectableFailureActivity: synthetic failure injected on attempt ${attempt} (configured to fail until attempt ${failUntilAttempt})`
		);
	}

	return { succeededOnAttempt: attempt, payload: data.payload !== undefined ? data.payload : null };
}

module.exports = { injectableFailureActivity };
