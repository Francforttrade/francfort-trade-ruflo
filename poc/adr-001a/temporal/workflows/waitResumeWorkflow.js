// ADR-001A PoC — TEST-03 (wait/resume) durable-wait Workflow.
//
// PoC-only scaffold. Not executed by this step — definition only.
//
// Reused as the base wait/resume primitive by TEST-04 (failure recovery,
// which pauses this same Workflow mid-flight before a Worker kill) and
// intended to be reused by TEST-10 (version evolution, which needs an
// in-flight paused instance to resume under a patched Worker — the
// patched Workflow-file variant itself is a separate, not-yet-created
// piece; this file only provides the base wait/resume primitive it would
// build on).
//
// Determinism note: only Workflow-safe `@temporalio/workflow` APIs are
// used. The signal handler flips a plain boolean flag — no Date.now(),
// Math.random(), timers, or I/O.

const { proxyActivities, defineSignal, setHandler, condition } = require('@temporalio/workflow');

const { checkComplianceActivity } = proxyActivities({
	startToCloseTimeout: '30 seconds',
	retry: { maximumAttempts: 3 },
});

const resumeSignal = defineSignal('resumeSignal');

/**
 * Pauses (no Activity/compute work scheduled) until `resumeSignal` is
 * received, then calls the existing Compliance Activity adapter.
 *
 * @param {object} context - forwarded unchanged to checkComplianceActivity
 */
async function waitResumeWorkflow(context) {
	let resumed = false;
	setHandler(resumeSignal, () => {
		// A duplicate signal after the first only re-sets the same flag to
		// the same value — idempotent by construction, satisfying "duplicate
		// signal must not re-trigger/duplicate the resume."
		resumed = true;
	});
	await condition(() => resumed);
	return checkComplianceActivity(context);
}

module.exports = { waitResumeWorkflow, resumeSignal };
