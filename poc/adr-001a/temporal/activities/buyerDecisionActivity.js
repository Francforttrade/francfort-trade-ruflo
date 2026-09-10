// ADR-001A PoC — TEST-06 human-decision test double.
//
// PoC-only scaffold. Not part of the Francfort Trade production
// application. Does NOT invoke src/agents/qualidade or any production
// component, database, HTTP endpoint, external resource, or LLM.
//
// This is a TEST DOUBLE, not a reimplementation of QUALIDADE's business
// logic. Its only job is to record a decision value it is explicitly
// given as input — it never generates, infers, or defaults a decision,
// matching the frozen rule that buyer approval is an external human
// decision the system must record, never produce.

const ALLOWED_DECISIONS = Object.freeze(['APPROVED', 'REJECTED']);

/**
 * Records a buyer decision. The decision value MUST be supplied by the
 * caller (representing a durable-engine signal carrying a human's
 * explicit choice) — this function never derives it.
 *
 * @param {{decision: 'APPROVED'|'REJECTED'}} input
 * @returns {{decision: string, recordedAt: string}}
 */
function recordBuyerDecision(input) {
	const decision = input && input.decision;
	if (!ALLOWED_DECISIONS.includes(decision)) {
		throw new Error(`recordBuyerDecision: decision must be explicit test input, one of ${ALLOWED_DECISIONS.join('/')} — received: ${JSON.stringify(decision)}`);
	}
	return { decision, recordedAt: new Date().toISOString() };
}

module.exports = { ALLOWED_DECISIONS, recordBuyerDecision };
