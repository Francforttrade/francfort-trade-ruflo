# ADR-001A — Temporal Behavioral PoC Test Contract (FROZEN)

**Status:** FROZEN — preparation/documentation only. No test in this document has been executed.
**Scope:** `poc/adr-001a/temporal/` only. Does not modify `src/`, `test/`, root `package.json`/`package-lock.json`, `Dockerfile`, or `cloudbuild.yaml`.
**Source of the 10-item invariant list (verbatim, not paraphrased):** `docs/adr/ADR-001A-durable-workflow-engine.md`, lines 107–118, heading "Critical PoC invariant" (section `## POC REQUIREMENTS`, line 75). Source type: ADR document.

```
persistent workflow identity
valid state transitions
wait/resume
failure recovery
retry
HITL (human-in-the-loop)
duplicate protection
financial gate
audit correlation
version evolution
```

**CONFLICT NOTE:** an intermediate instruction in this session's own transcript ("SYMMETRY RULE") paraphrased this list differently — splitting item 1 into "persistent workflow state" + a separate "persistent waiting" item, rewording item 2 as "validation/state transitions", and merging items 9–10 into one line ("audit correlation/version evolution"). That paraphrase is **not** the frozen source; the ADR text above (10 discrete items, exact wording) is authoritative and is what this contract freezes against, per explicit instruction not to invent a replacement list.

**Verified environment baseline this contract assumes (not re-verified here):**
- Temporal Server 1.31.2, `RUNNING_LOCAL_EPHEMERAL`, persistence `IN_MEMORY_EPHEMERAL`
- Temporal TypeScript SDK 1.23.0, isolated under `poc/adr-001a/temporal/node_modules/`
- `Worker.create()` against this server: `RUNTIME_CONSTRUCTION_VERIFIED` (workflow bundle compiled, activity map validated) — this construction check is infrastructure verification, not one of the 10 behavioral tests, and does not count toward `POC_TESTS_EXECUTED`
- One adapter pair exists: `poc/adr-001a/temporal/activities/complianceActivity.js` (wraps `src/agents/compliance/index.js :: process`) + `poc/adr-001a/temporal/workflows/complianceWorkflow.js`, task queue `adr001a-temporal-poc`
- `startToCloseTimeout: '30 seconds'` and `retry.maximumAttempts: 3` on the existing Compliance workflow are `POC_PROVISIONAL_PARAMETERS` — not production SLA/retry values

**Persistence-scope discipline (applies throughout this document):** the current Temporal Server is in-memory/ephemeral. A distinction is enforced test-by-test between:
- **Worker/process failure recovery** — a Worker process dies and restarts while the Temporal Server itself keeps running; the Server's still-live event history lets the Workflow resume via replay. This is achievable under the current ephemeral configuration, because only the *Worker* restarts, not the Server.
- **Temporal Server crash/restart recovery** — the Server process itself terminates and restarts; with in-memory persistence, all workflow history is lost on restart. This is **not** achievable under the current configuration and is explicitly out of scope for every test below unless separately flagged `BLOCKED_BY_PERSISTENCE`.

No test in this contract claims the second kind of recovery has been, or can currently be, demonstrated.

---

## TEST-01

**TEST_ID:** TEST-01-PERSISTENT-WORKFLOW-IDENTITY
**FROZEN_INVARIANT:** persistent workflow identity (ADR-001A-durable-workflow-engine.md:109)
**BUSINESS_RELEVANCE:** An FTR must correspond to exactly one durable execution across its lifecycle — matches the baseline's own concern (`CURRENT_REPOSITORY_FACTUAL_BASELINE.md` CONFLICT-01) that FTR status is currently tracked by three disagreeing fields with no single authoritative execution identity.
**PRECONDITIONS:** Temporal Server running (`RUNNING_LOCAL_EPHEMERAL`, already satisfied); a Worker registered on task queue `adr001a-temporal-poc` and actually started (`worker.run()` — not yet authorized).
**TEMPORAL_MECHANISM_UNDER_TEST:** Workflow ID assignment and lookup via `Client.workflow.getHandle(workflowId)`.
**TEST_SETUP:** Start `complianceWorkflow` with an explicit, FTR-code-derived workflow ID (e.g. `ftr-poc-0001`), synthetic input (labeled synthetic, not real lab data).
**ACTION:** After start, fetch a handle for the same workflow ID from a separate `Client` call and query its status.
**EXPECTED_BEHAVIOR:** The handle resolves to the same single execution; no duplicate execution is created.
**PASS_CRITERIA:** Returned `workflowId`/`runId` match the originally started execution; exactly one execution exists for that ID.
**FAIL_CRITERIA:** A second, independent execution is created for the same ID, or the handle cannot be resolved.
**REQUIRED_EVIDENCE:** Client-side query output (workflow ID, run ID, status) captured in a test log.
**PRODUCTION_RESOURCE_RISK:** NONE — Compliance adapter has zero external I/O (verified in the prior PoC step: no Firestore/Supabase/HTTP import anywhere in its require graph).
**PERSISTENCE_REQUIREMENT:** Server must stay running for the duration of the test only; no cross-restart durability claimed.
**CURRENT_EXECUTABILITY:** READY
**BLOCKER:** None architecturally; requires Worker to actually be started (`worker.run()`) and a Client execution — both currently unauthorized pending this contract's approval.
**COMPARABLE_GCP_TEST:** GCP Workflows execution ID assigned at trigger time, looked up via `executions.get` against the same execution name.
**STATUS:** PASS — executed 2026-09-10. Started `complianceWorkflow` as `ftr-poc-0001` (synthetic input) via one Client connection; a SEPARATE Client connection's `getHandle('ftr-poc-0001').describe()` resolved `workflowId=ftr-poc-0001` and `runId=01a08a67-2cf6-710b-82cf-63e694e3e6f2` — an exact match to the originally started execution's own runId, status COMPLETED, `HistoryLength: 11` (one execution, no duplicate). Evidence: `runner/evidence/TEST-01.json`, `runner/evidence/TEST-01-history.txt`, `runner/evidence/TEST-01-describe.txt`.

---

## TEST-02

**TEST_ID:** TEST-02-VALID-STATE-TRANSITIONS
**FROZEN_INVARIANT:** valid state transitions (ADR-001A-durable-workflow-engine.md:110)
**BUSINESS_RELEVANCE:** Baseline FACT-06 (this session's frozen baseline) prohibits modeling the FTR lifecycle as a naive linear `DRAFT → APPROVED → SHIPPED` chain; the real topology branches. A durable engine must support the actual branching topology, not force a false linear one.
**PRECONDITIONS:** Same as TEST-01.
**TEMPORAL_MECHANISM_UNDER_TEST:** Workflow-internal control flow (conditional branching inside `complianceWorkflow`, or a small successor Workflow added for this test) driven by Activity result content.
**TEST_SETUP:** Two synthetic inputs to `complianceActivity`: one that resolves `checklist.complete: true`, one that resolves `checklist.complete: false` (both are real, existing return-shape branches of the unmodified `compliance.process` function — not invented).
**ACTION:** Run the Workflow once per input; inspect the Workflow's recorded event history for the branch taken.
**EXPECTED_BEHAVIOR:** The Workflow's history shows the branch corresponding to each Activity result; no invalid/impossible transition is recorded.
**PASS_CRITERIA:** History for each run matches the expected branch deterministically; a Workflow replay (if triggered) reproduces the identical branch.
**FAIL_CRITERIA:** Non-deterministic branch selection, or a branch not explainable by the Activity's own return value.
**REQUIRED_EVIDENCE:** `temporal workflow show` history output (read-only CLI) for both runs.
**PRODUCTION_RESOURCE_RISK:** NONE
**PERSISTENCE_REQUIREMENT:** Server running for test duration only.
**CURRENT_EXECUTABILITY:** READY
**BLOCKER:** Same Worker/Client prerequisite as TEST-01.
**COMPARABLE_GCP_TEST:** GCP Workflows `switch` step branching on a connector call's result, inspected via execution step logs.
**STATUS:** PASS — executed 2026-09-10. Both runs (`test02-complete-true-*`, `test02-complete-false-*`) took the expected branch (PATH_A / PATH_B) against Temporal Server RUNNING_LOCAL_EPHEMERAL. Evidence: `runner/evidence/TEST-02.json`, `runner/evidence/TEST-02-history-complete-true.txt`, `runner/evidence/TEST-02-history-complete-false.txt`.

---

## TEST-03

**TEST_ID:** TEST-03-WAIT-RESUME
**FROZEN_INVARIANT:** wait/resume (ADR-001A-durable-workflow-engine.md:111)
**BUSINESS_RELEVANCE:** Several P0 contracts (QUALIDADE's buyer-approval HITL boundary, COMPLIANCE's expiry-alert timing) depend on a workflow being able to pause for an unbounded/unknown duration without holding resources, then resume exactly where it left off — a capability confirmed absent from current production code (`master.js`'s `withFtrLock` is an in-memory, non-durable mutex only).
**PRECONDITIONS:** Same as TEST-01, plus a Workflow that calls `condition()` gated by a signal to pause — now created (see below).
**TEMPORAL_MECHANISM_UNDER_TEST:** `@temporalio/workflow`'s `defineSignal`/`setHandler`/`condition` primitives.
**TEST_SETUP:** Workflow pauses awaiting a named signal (`resumeSignal`) before calling the Compliance Activity.
**ACTION:** Start the Workflow; confirm it is paused (no Activity yet scheduled); send the signal via Client; confirm the Activity then executes.
**EXPECTED_BEHAVIOR:** No Activity/compute work occurs before the signal; execution proceeds only after the signal arrives, regardless of elapsed wall-clock time between start and signal.
**PASS_CRITERIA:** Event history shows a wait/marker event before the signal and Activity scheduling only after it.
**FAIL_CRITERIA:** Activity executes before the signal, or the Workflow never resumes after the signal.
**REQUIRED_EVIDENCE:** Event history timestamps showing the gap between start and signal-triggered resumption.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/workflows/waitResumeWorkflow.js`, exported symbols `waitResumeWorkflow`, `resumeSignal` — created; syntax-checked; confirmed present in the compiled Workflow bundle (`Worker.create()` construction-only check, webpack log line `./workflows/waitResumeWorkflow.js` among the bundled modules).
**PRODUCTION_RESOURCE_RISK:** NONE
**PERSISTENCE_REQUIREMENT:** Server running for test duration only — no requirement that the wait survive a Server restart.
**CURRENT_EXECUTABILITY:** READY (corrected — the file this row's own BLOCKER previously said was missing now exists and is confirmed wired into the Worker's bundle; no remaining structural gap)
**BLOCKER:** NONE remaining structurally. Execution itself (starting the Worker, starting the Workflow, sending the signal) still requires separate, future authorization.
**COMPARABLE_GCP_TEST:** GCP Workflows `events.await_callback` or `sys.sleep` step, resumed via an external HTTP callback.
**STATUS:** PASS — executed 2026-09-10. History confirms `WorkflowExecutionSignaled` (event 5) precedes `ActivityTaskScheduled` (event 9); no Activity scheduled in the pre-signal history snapshot. Evidence: `runner/evidence/TEST-03.json`, `runner/evidence/TEST-03-history.txt`.

---

## TEST-04

**TEST_ID:** TEST-04-FAILURE-RECOVERY
**FROZEN_INVARIANT:** failure recovery (ADR-001A-durable-workflow-engine.md:112)
**BUSINESS_RELEVANCE:** Confirms the engine — not `master.js`'s non-durable in-memory lock — is what survives a process crash mid-FTR-execution.
**PRECONDITIONS:** Same as TEST-01. **Explicitly scoped to Worker/process failure only** — see the persistence-scope discipline note at the top of this document.
**TEMPORAL_MECHANISM_UNDER_TEST:** Workflow replay from Server-retained event history after a Worker process restart.
**TEST_SETUP:** Start a Workflow that pauses (as in TEST-03) so it is mid-flight and durable-waiting; kill the Worker process; restart a new Worker process pointed at the same still-running Server/task queue.
**ACTION:** Send the resume signal after the Worker restart; observe whether the Workflow completes correctly.
**EXPECTED_BEHAVIOR:** The restarted Worker replays the Workflow's history and resumes exactly where the killed Worker left off; the Activity executes correctly after resumption.
**PASS_CRITERIA (technology-neutral):** Execution state and progress survive an interruption of the component responsible for actually running the workflow/activity code, without loss or duplication of work already durably recorded — regardless of which specific mechanism (killing a process, an underlying platform disruption) causes the interruption.
**PASS_CRITERIA (this Temporal test's specific verification of the above):** Workflow completes with the correct result despite the mid-flight Worker kill; no duplicate or skipped Activity execution.
**FAIL_CRITERIA:** Workflow is lost, stuck, or produces an incorrect/duplicated result after Worker restart.
**REQUIRED_EVIDENCE:** Worker process logs (kill + restart timestamps) and the Workflow's final event history.
**PRODUCTION_RESOURCE_RISK:** NONE
**PERSISTENCE_REQUIREMENT:** Temporal **Server** must remain running throughout (its in-memory history is sufficient for this test's scope). **A stricter variant — the Server itself terminating and restarting — is `BLOCKED_BY_PERSISTENCE` and is explicitly NOT covered by this test row.** That stricter variant would require a separately authorized durable local persistence configuration (Temporal CLI's `--db-filename` flag, confirmed available in an earlier preflight step) before it could be attempted.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/workflows/waitResumeWorkflow.js` (unchanged, already wired) + `poc/adr-001a/temporal/harness/runPocWorkerProcess.js` (standalone entry point; `require.main === module`-guarded, calls `createPocWorker()` + `worker.run()` ONLY when run directly as its own OS process, never on `require()`) + `poc/adr-001a/temporal/harness/workerFailureRecoveryHarness.js` (exported symbols `spawnWorkerProcess`, `killWorkerProcess`, `runFailureRecoveryHarness` — all defined, none called; `runFailureRecoveryHarness` documents the full 7-step sequence in a doc comment and throws if ever called, as an explicit placeholder guard against accidental execution).
**CURRENT_EXECUTABILITY:** READY (upgraded — the harness scaffolding now exists; the guard verified via load-only `require()` — no webpack bundling output appeared, confirming `main()`/`createPocWorker()` was never triggered, and no `node.exe` process was spawned)
**BLOCKER:** NONE remaining structurally. Execution itself (actually spawning/killing processes, sending the resume signal) still requires separate, future authorization — this file only proves the mechanism exists and cannot fire accidentally.
**SYMMETRY_FINDING:** The *invariant* (technology-neutral PASS_CRITERIA above) applies equally to both candidates, but the *mechanism this row uses to test it* — deliberately killing and restarting a Worker process — has no direct GCP Workflows counterpart, because GCP Workflows exposes no user-managed worker process to kill. This is a genuine, disclosed asymmetry, not a hidden one: a future GCP Workflows test for this same invariant would need a different mechanism (e.g. citing GCP's own documented execution-durability guarantees, since the customer cannot deliberately trigger the underlying platform's failure/recovery path). Recorded here rather than forcing a false equivalence.
**COMPARABLE_GCP_TEST:** No exact analog — GCP Workflows is fully managed with no user-visible "Worker" to kill; the comparable claim would be execution continuity across an underlying platform-managed disruption, which cannot be deliberately triggered from outside GCP's control plane.
**STATUS:** PASS — executed 2026-09-10. Worker PID 20260 SIGKILLed mid-wait (07:58:47Z) while the Workflow held no scheduled Activity; a fresh Worker process (PID 19524, same task queue, same still-running Server) came up and, after the resume signal (07:58:55Z), the Workflow completed with exactly one `ActivityTaskScheduled`/`ActivityTaskCompleted` pair — no duplication, no loss. Evidence: `runner/evidence/TEST-04.json`, `runner/evidence/TEST-04-history.txt`, `runner/evidence/TEST-04-new-worker.log`.

---

## TEST-05

**TEST_ID:** TEST-05-RETRY
**FROZEN_INVARIANT:** retry (ADR-001A-durable-workflow-engine.md:113)
**BUSINESS_RELEVANCE:** None of the 12 domain components currently have engine-managed retry — each `process(context)` call in `master.js`'s `route()` is a single, unretried attempt.
**PRECONDITIONS:** Same as TEST-01. Existing `complianceWorkflow.js` already declares `retry: { maximumAttempts: 3 }` (POC_PROVISIONAL_PARAMETERS, not a validated production value).
**TEMPORAL_MECHANISM_UNDER_TEST:** `proxyActivities`'s `retry` policy.
**TEST_SETUP:** A test-only Activity variant that synthetically throws on its first N invocations, then succeeds (labeled synthetic failure injection — not a real Compliance failure mode).
**ACTION:** Run the Workflow; observe Activity attempt count in event history.
**EXPECTED_BEHAVIOR:** The Activity is retried automatically up to `maximumAttempts`, succeeding on the attempt where the synthetic failure stops.
**PASS_CRITERIA:** Event history shows the expected number of attempts and eventual success without any external/manual retry trigger.
**FAIL_CRITERIA:** Workflow fails permanently despite attempts remaining, or retries beyond the configured cap.
**REQUIRED_EVIDENCE:** Event history attempt count.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/activities/failureInjectionActivity.js` (`injectableFailureActivity(input)` — fails deterministically until `input.failUntilAttempt`, using Temporal's own engine-provided `activityInfo().attempt`, verified from the installed SDK's type definitions, not Math.random()/clock) + `poc/adr-001a/temporal/workflows/retryWorkflow.js` (`retryWorkflow`, `retry: { maximumAttempts: 5 }`) — both created; syntax-checked; confirmed wired into the Worker's `activities` map and present in the compiled Workflow bundle (`Worker.create()` construction-only check).
**PRODUCTION_RESOURCE_RISK:** NONE — zero `require()` beyond `@temporalio/activity`/`@temporalio/workflow`; no production/external reference.
**PERSISTENCE_REQUIREMENT:** Server running for test duration only.
**CURRENT_EXECUTABILITY:** READY (upgraded — both the failure-injection double and its Workflow now exist and are confirmed wired into the shared Worker's bundle)
**BLOCKER:** NONE remaining structurally. Execution itself still requires separate, future authorization.
**COMPARABLE_GCP_TEST:** GCP Workflows step-level `retry` policy (`retry.default` or a custom `retry` block) on a connector/HTTP call.
**STATUS:** PASS — executed 2026-09-10. `failUntilAttempt: 3`; Activity's own return (`succeededOnAttempt: 3`) matches the engine's own `ActivityTaskStarted.attempt: 3`, whose `lastFailure.message` carries the attempt-2 synthetic error — direct engine-stamped evidence of 2 automatic retries with no external trigger. (Note: Temporal does not emit a separate history event per failed attempt — the per-attempt record lives on the final `ActivityTaskStarted` event's own `attempt`/`lastFailure` fields, not as N distinct `ActivityTaskFailed` events; captured via raw JSON history, not the summarized CLI view.) Evidence: `runner/evidence/TEST-05.json`, `runner/evidence/TEST-05-history.txt`, `runner/evidence/TEST-05-raw.json`.

---

## TEST-06

**TEST_ID:** TEST-06-HITL
**FROZEN_INVARIANT:** HITL (human-in-the-loop) (ADR-001A-durable-workflow-engine.md:114)
**BUSINESS_RELEVANCE:** Directly matches the QUALIDADE contract's frozen HITL boundary (`docs/contracts/QUALIDADE.md`, QUA-GAP-001, source type: P0 contract) — buyer approval is an external human decision that QUALIDADE must record, never generate or infer. Also matches this session's earlier "BUYER APPROVAL HITL SEMANTICS" instruction: `WORKFLOW → WAIT_BUYER_APPROVAL → durable wait → EXTERNAL HUMAN EVENT → APPROVED or REJECTED → workflow resumes`.
**PRECONDITIONS:** Same as TEST-03 (durable wait mechanism), plus a minimal PoC-local human-decision stub — see CORRECTION note below.
**CORRECTION (semantic review):** the invariant under test is the *engine's* capacity to durably pause, be resumed only by an explicit external signal, and make that decision traceable — it does not depend on QUALIDADE's actual lab-interpretation business logic in any way. Requiring the real QUALIDADE component here was an unjustified production-infrastructure coupling introduced when this contract was first drafted; the QUALIDADE contract's own frozen rule (`docs/contracts/QUALIDADE.md`, QUA-GAP-001) is precisely that QUALIDADE "must not generate or infer buyer approval" — meaning QUALIDADE's role, even in production, is to *record* a decision it never produces. A PoC-local stub that does exactly that recording (nothing else) proves the identical engine invariant without weakening it, since the thing being proven — the engine's HITL mechanism, not QUALIDADE's domain correctness — is unchanged either way.
**TEMPORAL_MECHANISM_UNDER_TEST:** Signal-gated `condition()`, identical mechanism to TEST-03, applied specifically to a buyer-approval decision point.
**TEST_SETUP:** Workflow pauses at a `WAIT_BUYER_APPROVAL` point; an external signal (`buyerDecision: 'APPROVED' | 'REJECTED'`, explicitly labeled as a synthetic stand-in for a real human decision) is sent via Client, exactly as a human's approval action would be represented. A minimal PoC-local Activity (not the production QUALIDADE component) records whatever the signal carried, verbatim.
**ACTION:** Send `APPROVED` in one run and `REJECTED` in a separate run; observe the Workflow's subsequent branch (matches TEST-02's mechanism, applied to this specific decision).
**EXPECTED_BEHAVIOR:** The Workflow never proceeds past the wait point on its own; it only proceeds once the external signal arrives, and takes the branch matching the signal's value. No code path lets the Workflow or the recording stub fabricate the decision.
**PASS_CRITERIA:** Both `APPROVED` and `REJECTED` runs show the wait point held until signaled, and the correct downstream branch in each case.
**FAIL_CRITERIA:** Workflow proceeds without a signal, or the recording stub itself sets the decision value rather than merely recording what the signal carried.
**REQUIRED_EVIDENCE:** Event history showing the wait, the signal payload, and the resulting branch.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/activities/buyerDecisionActivity.js` (`recordBuyerDecision(input)`) + `poc/adr-001a/temporal/workflows/buyerDecisionWorkflow.js` (`buyerDecisionWorkflow`, signal `buyerDecisionSignal`) — both created; syntax-checked; confirmed wired into the Worker's `activities` map and present in the compiled Workflow bundle (`Worker.create()` construction-only check).
**PRODUCTION_RESOURCE_RISK:** NONE — the implementation touches no production component and therefore no Firestore/Supabase path exists to risk.
**PERSISTENCE_REQUIREMENT:** Server running for test duration only.
**CURRENT_EXECUTABILITY:** READY (upgraded — both the Activity double and its Workflow-side signal-gated wait now exist and are confirmed wired into the shared Worker's bundle)
**BLOCKER:** NONE remaining structurally. Execution itself (starting the Worker, starting the Workflow, sending the decision signal) still requires separate, future authorization.
**COMPARABLE_GCP_TEST:** GCP Workflows `events.await_callback` step, resumed via an external HTTP callback carrying the same `APPROVED`/`REJECTED` payload.
**STATUS:** PASS — executed 2026-09-10. Both runs (APPROVED, REJECTED) show `WorkflowExecutionSignaled` preceding `ActivityTaskScheduled` (wait held), and the recording stub's returned `decision` matches exactly what each signal carried. Evidence: `runner/evidence/TEST-06.json`, `runner/evidence/TEST-06-history.txt`.

---

## TEST-07

**TEST_ID:** TEST-07-DUPLICATE-PROTECTION
**FROZEN_INVARIANT:** duplicate protection (ADR-001A-durable-workflow-engine.md:115)
**BUSINESS_RELEVANCE:** Directly matches MSG-GAP-001 (`docs/contracts/COMUNICACAO.md`, source type: P0 contract) — COMUNICACAO's current redelivery behavior is a non-idempotent full-overwrite `.set()` call; this test evaluates whether the orchestration boundary itself can supply the missing idempotency guarantee.
**PRECONDITIONS:** Same as TEST-01.
**TEMPORAL_MECHANISM_UNDER_TEST:** Temporal's Workflow ID reuse policy (`workflowIdReusePolicy`) at Client-start time.
**TEST_SETUP:** Attempt to start two Workflow executions with the identical Workflow ID (simulating a redelivered COMUNICACAO webhook for the same FTR), using the default (or an explicitly configured) reuse policy.
**ACTION:** Issue the second `start` call for the same Workflow ID while the first is still open (or after it completed, depending on the policy under test) and observe the Client's response.
**EXPECTED_BEHAVIOR:** The second start is rejected or deduplicated per the configured reuse policy — no second, independent execution silently runs.
**PASS_CRITERIA:** Exactly one execution's Activity/side-effect work occurs for the duplicated ID; the second `start` call surfaces a clear reuse-policy response.
**FAIL_CRITERIA:** Two independent executions both run to completion for the same ID.
**REQUIRED_EVIDENCE:** Client-side start-call responses for both attempts, plus event history confirming a single execution.
**PRODUCTION_RESOURCE_RISK:** NONE
**PERSISTENCE_REQUIREMENT:** Server running for test duration only.
**CURRENT_EXECUTABILITY:** READY
**BLOCKER:** Same Worker/Client prerequisite as TEST-01.
**COMPARABLE_GCP_TEST:** No direct GCP Workflows equivalent to Workflow ID reuse policy is confirmed from repository evidence — GCP Workflows execution names are caller-supplied but its duplicate-execution semantics have not been verified in this session; flagging as an open question for the GCP track rather than asserting an unverified equivalence.
**STATUS:** PASS — executed 2026-09-10. Second `start` call with the identical Workflow ID while the first was still open was rejected client-side with `WorkflowExecutionAlreadyStartedError`; history for the ID shows exactly one `WorkflowExecutionStarted` and one Activity execution. Evidence: `runner/evidence/TEST-07.json`, `runner/evidence/TEST-07-history.txt`.

---

## TEST-08

**TEST_ID:** TEST-08-FINANCIAL-GATE
**FROZEN_INVARIANT:** financial gate (ADR-001A-durable-workflow-engine.md:116)
**BUSINESS_RELEVANCE:** Directly implements this task's own earlier-frozen "FINANCIAL GATE POC SEMANTICS" section and `docs/contracts/FINANCEIRO.md`'s FIN-GAP-001 (source type: P0 contract) — proves the engine preserves `NO RELEASE WITHOUT FINANCIAL GATE` using explicitly labeled synthetic bank evidence, while making no claim about real bank integration readiness or about `src/agents/financeiro`'s own correctness.
**CORRECTION (semantic review, second pass):** the earlier version of this row required wrapping the real `src/agents/financeiro` component, reasoning that a PoC-local reimplementation would constitute prohibited business-logic duplication. That reasoning conflated two different things: FINANCEIRO's actual domain rules (real bank-query semantics, real payment-status vocabulary reconciliation — not needed here) versus the financial-gate **state-sequencing contract** itself (`PAYMENT_UNKNOWN → PAYMENT_SIGNAL_DETECTED → PAYMENT_EVIDENCE_RECEIVED → PAYMENT_VALIDATED → BANK_CREDIT_CONFIRMED → RELEASE_ELIGIBLE`), which is exactly what ADR-001A needs to test at the engine level. ADR-001A evaluates the durable workflow **engine**, not FINANCEIRO's implementation (`ADR-001A-durable-workflow-engine.md`'s own Authority Boundary: "The orchestration engine does NOT automatically own: financial authority... these remain explicit domain/data responsibilities held by the existing adapters" — this scopes what production ownership means, not what the PoC's test double must execute). A minimal, deterministic PoC-local **contract test double** — implementing only the fixed 6-state sequencing shape, not FINANCEIRO's actual business conditions — proves the identical engine invariant without executing or duplicating FINANCEIRO's domain logic.
**PRECONDITIONS:** A minimal PoC-local deterministic financial-gate test double — not yet created; no production adapter of any kind required.
**TEST08_MINIMUM_POC_MECHANISM:** A PoC-local Activity, e.g. `evaluateFinancialGate(syntheticEvidence)`, that walks the fixed 6-state sequence purely as a function of its synthetic input (explicitly labeled synthetic — never real bank/payment data), returning the final state reached and the full path taken. It implements no aflatoxin-style conditional business rules, no payment-status vocabulary, and no bank-query semantics — only the state-machine shape named by the frozen invariant.
**TEMPORAL_MECHANISM_UNDER_TEST:** Deterministic Workflow branch gating a downstream "release" marker strictly on the test double's returned final state being exactly `RELEASE_ELIGIBLE`; combined with TEST-05's retry mechanism (to prove retry can't bypass the gate) and TEST-07's duplicate-ID/signal handling (to prove a duplicated "payment confirmed" signal can't double-promote the state).
**TEST_SETUP:** Multiple synthetic evidence inputs, each engineered to make the test double stop at a specific named state: (a) stop at `PAYMENT_UNKNOWN`, (b) stop at `PAYMENT_SIGNAL_DETECTED`, (c) stop at `PAYMENT_EVIDENCE_RECEIVED`, (d) stop at `PAYMENT_VALIDATED`, (e) reach `BANK_CREDIT_CONFIRMED` → `RELEASE_ELIGIBLE`. Plus: a retried execution (via TEST-05's synthetic-failure-injection pattern) and a duplicated "payment confirmed" signal (via TEST-07's mechanism), both against the same evidence as (e).
**ACTION:** Run the Workflow once per input (a)–(e); separately, run once with retry-forced re-invocation of the gate Activity, and once with a duplicated confirmation signal. Observe the final state reached and the resulting Workflow outcome in each case.
**EXPECTED_BEHAVIOR:**
1. `RELEASE_ELIGIBLE` never occurs from input (a) — `PAYMENT_UNKNOWN` alone.
2. `RELEASE_ELIGIBLE` never occurs from inputs (b), (c), or (d) alone.
3. `BANK_CREDIT_CONFIRMED` is reached in every run that reaches `RELEASE_ELIGIBLE` — no run skips it.
4. An attempt to request `RELEASE_ELIGIBLE` directly (bypassing the sequence) is rejected by the test double's own state machine.
5. Every attempted and accepted transition is visible in Workflow event history.
6. Retrying the gate Activity (same synthetic evidence) reproduces the identical final state — replay/retry does not derive a different, gate-bypassing outcome.
7. A duplicated confirmation signal does not advance the state machine a second time.
8. No LLM call appears anywhere in the test double or Workflow code for this test.
9. No Firestore, Supabase, Gmail, banking system, or external provider is contacted — the test double is pure/local, zero I/O.
**PASS_CRITERIA:** All nine EXPECTED_BEHAVIOR points hold across all runs described in TEST_SETUP/ACTION.
**FAIL_CRITERIA:** Any run reaches `RELEASE_ELIGIBLE` without passing through every prior named state in order, or a retry/duplicate signal promotes the state more than the single intended time.
**REQUIRED_EVIDENCE:** Event history for every run listed in TEST_SETUP, showing the test double's returned state path and the resulting Workflow outcome.
**TEST08_BUSINESS_LOGIC_DUPLICATED:** NO — the test double implements only the invariant's own named state-sequencing shape (5 intermediate/terminal states in a fixed order), not FINANCEIRO's actual business rules (real bank-query semantics, real payment-status vocabulary reconciliation, or any condition beyond the named states) — the same category of artifact as a contract-shaped test fixture, consistent with the `jest.mock`-style precedent already established elsewhere in this repository and reused for TEST-06/TEST-09's corrected stubs.
**PRODUCTION_RESOURCE_RISK:** NONE — the test double never references `src/agents/financeiro`, Firestore, or Supabase, mocked or real.
**PERSISTENCE_REQUIREMENT:** Server running for test duration only.
**CURRENT_EXECUTABILITY:** READY (fully — the earlier caveat is now resolved: TEST-05's `failureInjectionActivity.js` exists and is confirmed wired into the same Worker, so EXPECTED_BEHAVIOR point 6's shared dependency is satisfied. All nine points are now structurally ready, per `TEST08_REUSES_GENERIC_FAILURE_INJECTION` below.)
**BLOCKER:** NONE remaining structurally. Execution itself still requires separate, future authorization.
**TEST08_REUSES_GENERIC_FAILURE_INJECTION:** YES, structurally — a future combined Workflow could call `injectableFailureActivity` (from `failureInjectionActivity.js`) to force N retries around a call to `evaluateFinancialGate`, without either file referencing the other or embedding financial semantics into the failure-injection double: `financialGateActivity.js` still contains zero retry/failure logic, and `failureInjectionActivity.js` still contains zero financial-state logic. That combined Workflow is not created in this step (not required to make TEST-08 itself structurally ready) — only the reuse *possibility* is confirmed here.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/activities/financialGateActivity.js` (`evaluateFinancialGate`, `isTransitionAllowed`, `FINANCIAL_STATES`, `STATE_ORDER`) + `poc/adr-001a/temporal/workflows/financialGateWorkflow.js` (`financialGateWorkflow`) — both created; syntax-checked; confirmed wired into the Worker's `activities` map and present in the compiled Workflow bundle. `evaluateFinancialGate` structurally cannot accept a target state as input (only 4 atomic evidence flags), which by construction prevents any direct-jump request; `isTransitionAllowed` additionally rejects any requested state that is not the immediate successor of the current state in `STATE_ORDER`.
**TEST08_GCP_SYMMETRY:** PRESERVED — the test double is a technology-neutral pure function/state model; a future GCP Workflows track would wrap the identical double via its own connector/step mechanism, giving both candidates the same minimal, non-production-coupled bar for this invariant.
**COMPARABLE_GCP_TEST:** Same test double, wrapped as a GCP Workflows connector/step call, tested against the identical nine EXPECTED_BEHAVIOR points.
**EXECUTION_ADDENDUM (2026-09-10):** Points 6 and 7 had no combined Workflow to actually run (`TEST08_REUSES_GENERIC_FAILURE_INJECTION` confirmed the *possibility* only). Two composition-only PoC files were added to make execution possible, touching neither frozen activity: `activities/financialGateRetryActivity.js` (`evaluateFinancialGateWithInjectedRetries` — TEST-05's attempt-based throw pattern wrapping the unmodified `evaluateFinancialGate`) + `workflows/financialGateRetryWorkflow.js` for point 6; `workflows/financialGateSignalWorkflow.js` (`paymentConfirmedSignal`, same latch pattern as `buyerDecisionWorkflow.js`) for point 7. Both re-exported from `workflows/index.js` and the retry activity added to `worker/complianceWorker.js`'s activities map; Worker restarted to pick up the new bundle (PID 2232).
**STATUS:** PASS — executed 2026-09-10, all nine EXPECTED_BEHAVIOR points. (a)-(e) each reached exactly their expected named state; RELEASE_ELIGIBLE only from (e), always passing through BANK_CREDIT_CONFIRMED. Point 4 confirmed structurally (`isTransitionAllowed` rejects non-immediate-successor requests; `evaluateFinancialGate` has no target-state parameter). Point 6: retried gate Activity's engine-stamped `attempt` reached 3, final state still `RELEASE_ELIGIBLE`. Point 7: two `paymentConfirmedSignal`s sent, only one `ActivityTaskScheduled` recorded — duplicate did not re-evaluate. Points 8/9 verified by `require()`-target source inspection (not raw text search, which false-positived on the files' own "does NOT use LLM/Firestore/Supabase" disclaimer comments). Evidence: `runner/evidence/TEST-08.json`, `runner/evidence/TEST-08-history.txt`.

---

## TEST-09

**TEST_ID:** TEST-09-AUDIT-CORRELATION
**FROZEN_INVARIANT:** audit correlation (ADR-001A-durable-workflow-engine.md:117)
**BUSINESS_RELEVANCE:** Matches this task's own earlier "ADR-001A EVIDENCE DISCIPLINE" instruction and `docs/contracts/P0_AUTHORITY_MATRIX.md` footnote 5 (source type: P0 contract) — engine execution history must be distinguishable from, and correlatable to, a business audit record.
**CORRECTION (semantic review):** the frozen invariant text (`docs/adr/ADR-001A-durable-workflow-engine.md:117`) says only "audit correlation" — it does not name Firestore, Supabase, or the production `AUDIT_LOG` system, and nothing about the invariant requires them. Requiring a not-yet-created FINANCEIRO/CONTRATOS/EXCECOES adapter (as this row originally stated) was an unjustified production-infrastructure coupling. The invariant is fully provable by generating a deterministic, synthetic business audit record entirely inside the PoC (in-memory or a PoC-local file) and correlating it with the engine's own identifiers — no production component, Firestore, or Supabase involved at all, not even in mocked form.
**ENGINE EXECUTION EVIDENCE (side A — natively available from Temporal, no adapter needed):** workflow ID, run ID, workflow event history, Activity attempt records, timestamps, engine-level state transitions — all obtainable directly from the Temporal Client/history API once a Workflow has run.
**BUSINESS AUDIT EVIDENCE (side B — PoC-local, synthetic, no production dependency):** a synthetic FTR/business correlation identifier (e.g. `ftr-poc-0001`, matching TEST-01's convention), a business event/action label (e.g. `"compliance_check_completed"`), a decision/result (e.g. the Compliance Activity's own `checklist.complete` value — real return-shape, synthetic input), a synthetic relevant-domain-state snippet, and a source/actor label (e.g. `"poc-test-harness"`).
**PRECONDITIONS:** A minimal PoC-local function that writes side B above, given side A's Workflow ID/Run ID as a parameter — not yet created; no production adapter of any kind required.
**TEMPORAL_MECHANISM_UNDER_TEST:** Passing the Temporal Workflow ID/Run ID as an explicit correlation field into the PoC-local audit-record writer, then confirming it round-trips.
**TEST_SETUP:** Run `complianceWorkflow`; immediately after (or from within, via an Activity), call the PoC-local audit-record writer with the Workflow's own ID/Run ID and a synthetic business payload; capture the written record in memory or to a PoC-local file under `poc/adr-001a/temporal/`.
**ACTION:** Inspect the captured audit record for the Workflow's own ID/Run ID.
**EXPECTED_BEHAVIOR:** The synthetic audit record carries the same Workflow ID/Run ID as the engine's own event history — the two can be joined by that field.
**PASS_CRITERIA:** Correlation field present and matching in both the engine history (side A) and the synthetic audit record (side B).
**FAIL_CRITERIA:** No correlation field, or the engine's own history and the synthetic audit record cannot be joined at all.
**REQUIRED_EVIDENCE:** Side-by-side capture of Workflow event history and the PoC-local audit record.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/activities/auditRecordActivity.js` (`writeAuditRecord(input)`, `getAuditLog()`) + `poc/adr-001a/temporal/workflows/auditCorrelationWorkflow.js` (`auditCorrelationWorkflow`, using `@temporalio/workflow`'s `workflowInfo()` to source side-A identifiers) — both created; syntax-checked; confirmed wired into the Worker's `activities` map and present in the compiled Workflow bundle. In-memory array only (no file, database, or network write); no import of `src/agents/financeiro`, `contratos`, or `excecoes`, and no Firestore/Supabase client anywhere, mocked or real.
**PRODUCTION_RESOURCE_RISK:** NONE — unconditionally, not merely conditional on correct mocking, since the implementation never references a production component or a real/mocked Firestore/Supabase client at all.
**PERSISTENCE_REQUIREMENT:** Server running for test duration only.
**CURRENT_EXECUTABILITY:** READY (upgraded — both the Activity double and the correlating Workflow now exist and are confirmed wired into the shared Worker's bundle)
**BLOCKER:** NONE remaining structurally. Execution itself still requires separate, future authorization.
**COMPARABLE_GCP_TEST:** Same correlation-field approach, using the GCP Workflows execution ID in place of Temporal's Workflow/Run ID, and the identical PoC-local synthetic audit-record writer (technology-neutral, reusable for either candidate's track).
**STATUS:** PASS — executed 2026-09-10. The `writeAuditRecord` Activity's completed result (side B, decoded from the raw history payload) carries `workflowId`/`runId` identical to the engine's own `Client`-visible identifiers (side A) — exact match, both fields. Evidence: `runner/evidence/TEST-09.json`, `runner/evidence/TEST-09-history.txt`.

---

## TEST-10

**TEST_ID:** TEST-10-VERSION-EVOLUTION
**FROZEN_INVARIANT:** version evolution (ADR-001A-durable-workflow-engine.md:118)
**BUSINESS_RELEVANCE:** Domain rules change over time (e.g. COMPLIANCE's per-market aflatoxin limits, per `docs/contracts/COMPLIANCE.md`) — an orchestration engine must let in-flight executions finish under the rules they started with while new executions pick up updated logic, without an all-at-once cutover.
**PRECONDITIONS:** Same as TEST-03 (a Workflow paused mid-flight via durable wait), plus a second, deliberately modified copy of the wait/resume Workflow (still PoC-only, still not touching `src/`) representing a "new version" of the Workflow definition — now created.
**TEMPORAL_MECHANISM_UNDER_TEST:** `@temporalio/workflow`'s `patched()`/`deprecatePatch()` versioning API — signatures verified directly from the installed SDK's type definitions (`node_modules/@temporalio/workflow/lib/workflow.d.ts`): `patched(patchId: string): boolean` and `deprecatePatch(patchId: string): void`, not assumed.
**TEST_SETUP:** Start a Workflow instance and let it pause mid-flight (as in TEST-03) under "version A" Worker code (`worker/complianceWorker.js`, bundle `workflows/index.js`); deploy a "version B" Worker (same task queue `adr001a-temporal-poc`, `worker/complianceWorkerV2.js`, bundle `workflows/indexV2.js`) with a `patched('poc-v2-branch')` conditional added; resume the paused instance via signal.
**ACTION:** Observe which code path the already-in-flight instance takes after resuming under the new Worker code, versus a freshly started instance under the same new Worker code.
**EXPECTED_BEHAVIOR:** The in-flight instance completes deterministically under its original (pre-patch) behavior via replay; a newly started instance takes the new, patched branch.
**PASS_CRITERIA:** Both behaviors observed exactly as described, with no non-determinism error raised by the SDK during replay of the in-flight instance.
**FAIL_CRITERIA:** A non-deterministic-history error occurs on replay, or the in-flight instance silently picks up the new branch instead of completing under its original behavior.
**REQUIRED_EVIDENCE:** Event history for both the in-flight and freshly started instances, plus Worker logs showing which code version handled each.
**MINIMUM_ISOLATED_POC_IMPLEMENTATION:** `poc/adr-001a/temporal/workflows/waitResumeWorkflowV2.js` (`waitResumeWorkflow`, same exported name/signal as V1, plus one `patched('poc-v2-branch')` branch) + `poc/adr-001a/temporal/workflows/indexV2.js` (bundle entry re-exporting V2's variant alongside the unchanged other workflows) + `poc/adr-001a/temporal/worker/complianceWorkerV2.js` (`createPocWorkerV2`, same task queue as V1, same activities map) — all created; syntax-checked; both V1 and V2 bundles independently confirmed to compile successfully via two separate `Worker.create()` construction-only checks (V1: 3532ms, V2: 1291ms — both later, faster, since node_modules/webpack cache was already warm), each ending in the expected `"Not running. Current state: INITIALIZED"` on `shutdown()`, confirming neither ever started polling.
**PRODUCTION_RESOURCE_RISK:** NONE
**PERSISTENCE_REQUIREMENT:** Server running for test duration only; both Worker versions connect to the same still-running Server — no Server restart involved.
**CURRENT_EXECUTABILITY:** READY (upgraded — this row's own blocker previously named two missing pieces; both now exist and are independently bundle-verified)
**BLOCKER:** NONE remaining structurally. Execution itself still requires separate, future authorization. This step proves structural readiness only — it does not, and does not claim to, demonstrate actual Temporal production versioning safety merely because two Workflow files compile; that would require the actual behavioral execution this step is not authorized to run.
**TEST10_INSTALLED_SDK_SUPPORT_VERIFIED:** YES — `patched`/`deprecatePatch` confirmed present with the exact signatures above, read directly from the installed package's `.d.ts` file, not assumed or guessed from memory.
**COMPARABLE_GCP_TEST:** GCP Workflows workflow revisions — a new revision deployed while an execution from a prior revision is still in flight, confirmed (or not) to keep running under the revision it started with; not yet verified against GCP documentation in this session.
**STATUS:** FAIL — executed 2026-09-10. Both the in-flight (paused-under-V1, resumed-under-V2) instance AND the freshly-started-under-V2 instance took the NEW patched branch (`pocVersion: "v2-patched-branch"` in both results; a `MarkerRecorded` event appears in both histories at the same relative position, event 9). No non-determinism error was raised on either — the `patched()` mechanism itself behaved exactly per its documented contract. **Root cause (structural, not a test-script defect):** `waitResumeWorkflow.js`'s pause point (`await condition(() => resumed)`) sits BEFORE the branch point V2 adds; under V1, execution never reaches or records anything past the wait. So when V2 replays this in-flight instance's history, the segment containing `patched('poc-v2-branch')` has no prior recorded events at all — it is not "replaying an already-recorded divergence point," it is fresh (non-replaying) execution for both instances alike, and `patched()` correctly returns `true` in both per its own documented semantics ("If the workflow is not currently replaying, then this call always returns true"). Demonstrating the intended asymmetry (in-flight keeps old behavior, only fresh gets new behavior) requires the in-flight instance to have already recorded a Workflow Task **past** the patch point under V1 before V2 takes over — i.e. the pause needs to sit after the branch, not before it. That is a change to the pause-point placement in the frozen `waitResumeWorkflow.js`/`waitResumeWorkflowV2.js` pair, out of scope for an additive-only execution step. Evidence: `runner/evidence/TEST-10.json`, `runner/evidence/TEST-10-history.txt`, `runner/evidence/TEST-10-v2-worker.log`.

**ADDENDUM — corrected scenario, executed 2026-09-10 (does not replace the FAIL above; that result and its root-cause analysis stand as-is for the original `waitResumeWorkflow.js`/`waitResumeWorkflowV2.js` pair):** at the user's request, built a second, additive-only scenario purpose-built to exercise the actual asymmetry — new files `workflows/versionEvolutionWorkflow.js` (V1) / `workflows/versionEvolutionWorkflowV2.js` (V2) + `harness/runPocWorkerProcessV2.js`, re-exported from `workflows/index.js`/`workflows/indexV2.js`. The only change from the original pair: `checkComplianceActivity` is called **unconditionally first**, and the `condition()` pause comes **after** — so an in-flight V1 instance already has the Activity call recorded in history before any version swap, giving V2's replay something real to reconcile against.
**RESULT: PASS.** In-flight instance (Activity call pre-recorded under V1, then resumed under V2): completed under the OLD behavior (no `pocVersion` field), history shows **no** `MarkerRecorded` event at all — `patched()` returned `false` during replay of the pre-existing segment, exactly as documented, and exactly one `ActivityTaskScheduled` total (no duplicate execution on replay). Fresh instance (started after V2 deployed, zero prior history): completed under the NEW behavior (`pocVersion: "v2-patched-branch"`), history **does** show a `MarkerRecorded` event (event 5, before the Activity call) — `patched()` returned `true` since nothing was being replayed. This is the clean, technology-correct demonstration of Temporal's version-evolution invariant; the original FAIL was a PoC-scenario-shape gap, not an engine-mechanism gap. Evidence: `runner/evidence/TEST-10b.json`, `runner/evidence/TEST-10b-history.txt`, `runner/evidence/TEST-10b-v2-worker.log`.

---

## Summary

| Test | Invariant | Executability | Execution result |
|---|---|---|---|
| TEST-01 | persistent workflow identity | READY | **PASS** (executed 2026-09-10, separately, at explicit user request) |
| TEST-02 | valid state transitions | READY | **PASS** |
| TEST-03 | wait/resume | READY (`waitResumeWorkflow.js` created, confirmed wired) | **PASS** |
| TEST-04 | failure recovery (Worker/process scope only) | READY (`harness/runPocWorkerProcess.js` + `harness/workerFailureRecoveryHarness.js` created; guard-verified never to fire on `require()`) | **PASS** |
| TEST-05 | retry | READY (`failureInjectionActivity.js` + `retryWorkflow.js` created, confirmed wired) | **PASS** |
| TEST-06 | HITL | READY (`buyerDecisionActivity.js` + `buyerDecisionWorkflow.js` created, confirmed wired) | **PASS** |
| TEST-07 | duplicate protection | READY | **PASS** |
| TEST-08 | financial gate | READY, all nine EXPECTED_BEHAVIOR points (the earlier retry-sub-scenario caveat is resolved now that TEST-05's double exists) | **PASS** (required two new composition-only files for points 6/7 — see row's EXECUTION_ADDENDUM) |
| TEST-09 | audit correlation | READY (`auditRecordActivity.js` + `auditCorrelationWorkflow.js` created, confirmed wired) | **PASS** |
| TEST-10 | version evolution | READY (`waitResumeWorkflowV2.js` + `indexV2.js` + `complianceWorkerV2.js` created; both V1 and V2 bundles independently compile-verified via `Worker.create()`) | **FAIL** on the original scenario (structural gap, see row); **PASS** on a corrected additive-only scenario addendum built and run afterward (see row) |

**READY_TEST_COUNT: 10/10.**

**Correction note (carried from the prior step, for continuity):** TEST-03, TEST-04, TEST-05, and TEST-10 were at one point marked READY while their own BLOCKER field already stated a required file didn't exist — an internal contradiction caught during static-completeness review. All missing pieces named by those blockers have since been created in this step and this one: `waitResumeWorkflow.js`, the TEST-04 harness (`runPocWorkerProcess.js` + `workerFailureRecoveryHarness.js`), `failureInjectionActivity.js` + `retryWorkflow.js`, and `waitResumeWorkflowV2.js` + `indexV2.js` + `complianceWorkerV2.js`. Every READY classification above is now backed by either "nothing missing, only execution-time authorization remains" or an actual passing `Worker.create()`/bundle-compilation check — never by an unresolved blocker text.

**No test in this contract is `BLOCKED_BY_PERSISTENCE`** as scoped — every test's mechanism only requires the Temporal *Server* to stay running for the test's own duration, not to survive a restart. The one place a stricter, Server-crash-surviving claim could be made (TEST-04) is explicitly carved out as a separate, `BLOCKED_BY_PERSISTENCE` variant not covered by this contract, per the persistence-scope discipline stated at the top of this document.

**EXECUTION PASS (2026-09-10):** TEST-02 through TEST-10 executed against a real local Temporal Server (`RUNNING_LOCAL_EPHEMERAL`) and real Worker process(es), per explicit user authorization to run tests 2–10 in sequence, stopping and reporting on any failure. TEST-01 was explicitly excluded from this pass. **8 of 9 executed tests PASS outright** (TEST-02, 03, 04, 05, 06, 07, 08, 09); **TEST-10 FAILS on its original scenario** on a structural scenario gap in the existing `waitResumeWorkflow.js`/`waitResumeWorkflowV2.js` pause-point placement (root cause detailed in the TEST-10 row above) — the underlying Temporal `patched()` mechanism itself behaved correctly and per its documented contract; the PoC scenario as originally structured does not exercise the asymmetry the invariant requires. Execution stopped after TEST-10 per instruction to stop and report on failure. At the user's follow-up request, a corrected additive-only TEST-10 scenario (`versionEvolutionWorkflow.js`/`versionEvolutionWorkflowV2.js`) was then built and run, and **PASSES cleanly** — see the TEST-10 row's ADDENDUM for the mechanism-level confirmation (in-flight preserves old behavior with no `MarkerRecorded` event; fresh instance takes new behavior with one). `POC_TESTS_EXECUTED: 9/10` on original scenarios as of that pass (TEST-01 not yet attempted); the version-evolution invariant itself is now demonstrated PASS via the corrected addendum. All runner scripts and captured evidence live under `runner/` (git-untracked, same as the rest of `poc/`).

**TEST-01 EXECUTION (2026-09-10, separate follow-up pass, per explicit user request — TEST-01 only, no other test re-run, no acceptance criteria altered):** executed against the already-running local Temporal Server and already-running Worker (no new server/worker start was necessary — both preconditions were already satisfied from the prior pass). **PASS** — see TEST-01 row above. `POC_TESTS_EXECUTED: 10/10` — every test in this frozen contract has now been executed at least once; TEST-10 carries both its original-scenario FAIL and its corrected-scenario-addendum PASS, both preserved.
