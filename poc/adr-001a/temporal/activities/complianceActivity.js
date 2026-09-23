// ADR-001A PoC — Temporal Activity adapter boundary proof.
//
// This file is PoC-only scaffold code. It is NOT part of the Francfort
// Trade production application, is not imported by src/ or server.js, and
// is not built/deployed by Dockerfile or cloudbuild.yaml.
//
// It imports the existing, unmodified production COMPLIANCE component
// (src/agents/compliance/index.js) and wraps its process(context) function
// as a plain async function suitable for later registration as a Temporal
// Activity. No business logic is duplicated here — this function is a
// pass-through adapter only.
//
// This file defines a function. It does not execute it, does not create a
// Temporal Workflow, Worker, or Client, and does not run any of the
// ADR-001A PoC invariant tests.

const compliance = require('../../../../src/agents/compliance');

/**
 * Temporal Activity adapter for the COMPLIANCE domain component.
 *
 * Activity input -> existing process(context) mapping:
 *   activityInput.ftrCode         -> context.ftrCode
 *   activityInput.market          -> context.market
 *   activityInput.labResultPpb    -> context.labResultPpb
 *   activityInput.presentDocuments -> context.presentDocuments
 *   activityInput.expiryDates     -> context.expiryDates
 *
 * The adapter passes activityInput straight through as context — the
 * existing production function's signature (async process(context)) is
 * unchanged and uncopied.
 *
 * @param {object} activityInput
 * @returns {Promise<object>} the existing component's unmodified return value
 */
async function checkComplianceActivity(activityInput) {
	return compliance.process(activityInput);
}

module.exports = { checkComplianceActivity };
