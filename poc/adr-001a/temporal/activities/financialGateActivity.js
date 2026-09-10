// ADR-001A PoC — TEST-08 financial-gate test double.
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application. Does NOT invoke src/agents/financeiro or any production
// component, bank query, Gmail, Firestore, Supabase, external provider,
// or LLM.
//
// This is a TEST DOUBLE implementing only the frozen state-sequencing
// SHAPE named by the ADR-001A financial-gate invariant. It does not
// implement Francfort Trade's actual payment-status vocabulary,
// bank-query semantics, or any real financial validation rule.

const FINANCIAL_STATES = Object.freeze({
	PAYMENT_UNKNOWN: 'PAYMENT_UNKNOWN',
	PAYMENT_SIGNAL_DETECTED: 'PAYMENT_SIGNAL_DETECTED',
	PAYMENT_EVIDENCE_RECEIVED: 'PAYMENT_EVIDENCE_RECEIVED',
	PAYMENT_VALIDATED: 'PAYMENT_VALIDATED',
	BANK_CREDIT_CONFIRMED: 'BANK_CREDIT_CONFIRMED',
	RELEASE_ELIGIBLE: 'RELEASE_ELIGIBLE',
});

// Fixed order. This array is the single source of truth for "immediate
// successor" — used by isTransitionAllowed() below.
const STATE_ORDER = Object.freeze([
	FINANCIAL_STATES.PAYMENT_UNKNOWN,
	FINANCIAL_STATES.PAYMENT_SIGNAL_DETECTED,
	FINANCIAL_STATES.PAYMENT_EVIDENCE_RECEIVED,
	FINANCIAL_STATES.PAYMENT_VALIDATED,
	FINANCIAL_STATES.BANK_CREDIT_CONFIRMED,
	FINANCIAL_STATES.RELEASE_ELIGIBLE,
]);

/**
 * Evaluates synthetic evidence against the fixed 6-state sequence.
 *
 * By construction, this function has no input surface for requesting a
 * target state directly — it only accepts four atomic boolean evidence
 * flags, one per intermediate transition — so a caller structurally
 * cannot ask for RELEASE_ELIGIBLE without every prior flag being true.
 * This is the primary enforcement mechanism (structural impossibility),
 * not a runtime check that could have a bug.
 *
 * @param {{signalDetected?: boolean, evidenceReceived?: boolean, validated?: boolean, bankConfirmed?: boolean}} syntheticEvidence
 * @returns {{finalState: string, path: string[], releaseEligible: boolean}}
 */
function evaluateFinancialGate(syntheticEvidence) {
	const evidence = syntheticEvidence || {};
	const path = [FINANCIAL_STATES.PAYMENT_UNKNOWN];

	const steps = [
		['signalDetected', FINANCIAL_STATES.PAYMENT_SIGNAL_DETECTED],
		['evidenceReceived', FINANCIAL_STATES.PAYMENT_EVIDENCE_RECEIVED],
		['validated', FINANCIAL_STATES.PAYMENT_VALIDATED],
		['bankConfirmed', FINANCIAL_STATES.BANK_CREDIT_CONFIRMED],
	];

	for (const [flagName, state] of steps) {
		if (!evidence[flagName]) {
			return { finalState: path[path.length - 1], path, releaseEligible: false };
		}
		path.push(state);
	}

	path.push(FINANCIAL_STATES.RELEASE_ELIGIBLE);
	return { finalState: FINANCIAL_STATES.RELEASE_ELIGIBLE, path, releaseEligible: true };
}

/**
 * Explicit transition-request validator — a secondary, belt-and-suspenders
 * check for callers that might attempt to request a specific state
 * directly (e.g. a hostile or buggy caller) rather than going through
 * evaluateFinancialGate()'s evidence-flag interface.
 *
 * @param {string} currentState
 * @param {string} requestedState
 * @returns {{allowed: boolean, reason: string|null}}
 */
function isTransitionAllowed(currentState, requestedState) {
	const currentIndex = STATE_ORDER.indexOf(currentState);
	const requestedIndex = STATE_ORDER.indexOf(requestedState);
	if (currentIndex === -1 || requestedIndex === -1) {
		return { allowed: false, reason: 'UNKNOWN_STATE' };
	}
	if (requestedIndex !== currentIndex + 1) {
		return { allowed: false, reason: 'NOT_IMMEDIATE_SUCCESSOR' };
	}
	return { allowed: true, reason: null };
}

module.exports = { FINANCIAL_STATES, STATE_ORDER, evaluateFinancialGate, isTransitionAllowed };
