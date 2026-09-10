// ADR-001A PoC — TEST-08 EXPECTED_BEHAVIOR point 6 support: a composition
// of two already-frozen, already-approved mechanisms — TEST-05's
// attempt-based synthetic failure injection
// (activities/failureInjectionActivity.js) and TEST-08's own
// deterministic financial-gate test double
// (activities/financialGateActivity.js) — proving that retrying the gate
// Activity reproduces the identical final state.
//
// This file adds no new business logic of its own: it does not throw
// based on any financial condition (the throw is purely
// attempt-number-driven, identical to failureInjectionActivity.js's own
// mechanism) and it does not alter evaluateFinancialGate's own state
// sequencing in any way. Per TEST_CONTRACT.md's own
// TEST08_REUSES_GENERIC_FAILURE_INJECTION note: "financialGateActivity.js
// still contains zero retry/failure logic, and failureInjectionActivity.js
// still contains zero financial-state logic" — this file is the (until
// now uncreated) composition point where the two are wired together,
// touching neither frozen file.

const { activityInfo } = require('@temporalio/activity');
const { evaluateFinancialGate } = require('./financialGateActivity');

/**
 * Throws on every attempt strictly less than `failUntilAttempt` (same
 * attempt-number-driven mechanism as injectableFailureActivity), then on
 * the succeeding attempt evaluates the financial gate against the
 * unmodified, real evaluateFinancialGate function.
 *
 * @param {{failUntilAttempt?: number, syntheticEvidence: object}} input
 */
function evaluateFinancialGateWithInjectedRetries(input) {
	const data = input || {};
	const failUntilAttempt = Number.isInteger(data.failUntilAttempt) ? data.failUntilAttempt : 1;
	const attempt = activityInfo().attempt;

	if (attempt < failUntilAttempt) {
		throw new Error(
			`evaluateFinancialGateWithInjectedRetries: synthetic failure injected on attempt ${attempt} (configured to fail until attempt ${failUntilAttempt})`
		);
	}

	return { attempt, gateResult: evaluateFinancialGate(data.syntheticEvidence) };
}

module.exports = { evaluateFinancialGateWithInjectedRetries };
