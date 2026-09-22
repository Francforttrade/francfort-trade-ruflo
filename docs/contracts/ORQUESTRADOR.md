# ORQUESTRADOR — Draft Component Contract (Technical Proposal, Not Implemented)

**Status:** DRAFT. This document does not describe an existing component — `src/orchestrator/master.js` (RUNTIME_CODE) is a stateless per-call router with an in-memory, non-durable FTR mutex; it has none of the properties proposed here. This draft exists because no orchestrator contract exists today, only three separate, non-reconciled artifacts: `master.js` itself, `docs/adr/ADR-001A-durable-workflow-engine.md` (engine choice: `NOT_DECIDED`), and `poc/adr-001a/temporal/TEST_CONTRACT.md` (10 frozen, generic-mechanism tests against synthetic doubles, never against the flow this document describes).

**Evidence/authority precedence, same discipline as the other P0 contracts:** `BUSINESS_DECISION` (FIN-DEC-01 through FIN-DEC-21, `FINANCEIRO_DECISIONS.md`, dated 2026-09-21) is approved intent and is preserved integrally — nothing in this draft reinterprets, narrows, or extends any FIN-DEC. `TECHNICAL_PROPOSAL` is this document's own engineering sketch, not approved by the business and not implemented. `OPEN_DECISION` is a question this draft explicitly declines to answer by inference, per instruction. No engine, database, retention period, or revocation policy is chosen anywhere in this document.

---

## Identity

- **Name:** ORQUESTRADOR (proposed durable-orchestration boundary).
- **Current reality:** does not exist. `master.js:68-89`'s `route()` performs one synchronous `agent.process(message)` call per invocation, guarded by an in-memory `withFtrLock` mutex (`master.js:40-56`) that provides no durability across a process restart.
- **Proposed architectural classification:** per `ADR-001A-durable-workflow-engine.md`'s own Authority Boundary — "the orchestration engine owns workflow execution durability" and explicitly does **not** own financial, compliance, quality, business-audit, database, or LLM authority. This draft inherits that boundary without modification.
- **Scope of this draft:** limited to the confirmation → eligibility → authorization → physical-delivery-tracking flow FIN-DEC-01–21 approve for FINANCEIRO. It does not extend to COMPLIANCE, QUALIDADE, LOGISTICS, COMISSOES, or any other P0/non-P0 component beyond what those components' own Reconciliation sections already record (`COMPLIANCE.md`, `QUALIDADE.md`). It does not reopen or re-decide ADR-001A or ADR-007.

---

## Relationship to Existing Documents (must not duplicate or contradict)

- **`FINANCEIRO_DECISIONS.md` (FIN-DEC-01–21):** the single source of approved business intent for this flow. Preserved integrally below — every reference cites a specific FIN-DEC number rather than paraphrasing.
- **`FINANCEIRO.md`:** owns the gate computation (`releaseGate.canReleaseOriginalDocuments`) and its own "Reconciliation"/"Approved Confirmation & Release Flow" sections. This draft treats those as authoritative for FINANCEIRO's domain rules and only proposes *how the orchestrator invokes them* — it does not restate or alter FINANCEIRO's business rules. Its "Consolidated requirements and acceptance — FIN-DEC-17 through FIN-DEC-21" section additionally defines per-document delivery sub-states (`PENDING_DELIVERY`/`DELIVERY_CONFIRMED`) — this draft's own `AWAITING_DELIVERY_CONFIRMATION`/`PARTIALLY_DELIVERED`/`FULLY_DELIVERED` states (below) are the workflow-level aggregate computed from that same per-document set, not a competing model.
- **`COMUNICACAO.md`'s "Reconciliation: channel role and proposed flow":** this draft's assignment of channel/normalization duties to COMUNICACAO is the same unapproved technical proposal already recorded there — not a new or stronger claim.
- **`COMPLIANCE.md`/`QUALIDADE.md`'s own Reconciliation sections:** their "single notification, per-channel/recipient result" and "order-independent evidence" language is structurally identical to what this draft proposes for the whole flow — consistent, not duplicated wholesale here.
- **`docs/adr/ADR-001A-durable-workflow-engine.md`, `CURRENT_REPOSITORY_FACTUAL_BASELINE.md`, `poc/adr-001a/temporal/TEST_CONTRACT.md`:** engine selection remains `NOT_DECIDED`; the 10 frozen PoC tests and their recorded PASS/FAIL results are untouched by this draft (see "Relationship to the Frozen PoC" below).

---

## Technical Proposal — Division of Responsibilities (TECHNICAL_PROPOSAL — not approved, not implemented)

```
COMUNICACAO
  - receives inbound messages on the approved channel (the operation's
    WhatsApp group, FIN-DEC-04/05)
  - normalizes: extracts text, captures sender identity, captures which
    prior message is being replied to (reply-to binding)
  - classifies message shape: confirmation-shaped / selection-shaped /
    delivery-confirmation-shaped / unclassified — this classification
    vocabulary does NOT exist in parser.js today (current intents are
    booking/invoice/bl_document/quote_offer/ftr_reference/unknown; see
    COMUNICACAO.md's own Reconciliation section)
  - does NOT decide whether a classified message satisfies any financial,
    partial-payment, or delivery gate
  - emits a structured event (see Events) to the orchestrator boundary

FINANCEIRO
  - consumes structured confirmation / selection / delivery events, never
    raw WhatsApp text
  - validates: sender authorization, binding to the correct request/
    version, and that content is an affirmative, unambiguous confirmation
    (not negative, doubtful, or ambiguous) — same rule already recorded in
    FINANCEIRO.md's own Reconciliation section, not a new rule here
  - computes eligibility via releaseGate, extended for the partial-payment
    path FIN-DEC-11/12/13 approve (see "FINANCEIRO Adapter Update Needed"
    below — the extension itself is not implemented anywhere)
  - remains the sole authority for release_flag/eligibility; nothing in
    this proposal transfers that computation to COMUNICACAO or to the
    orchestrator

ORQUESTRADOR
  - correlates a confirmation-event and a selection-event to the same
    pending request, in whichever order they arrive
  - does not request or permit an authorization dispatch until FINANCEIRO
    returns an eligible result
  - coordinates dispatch of ONE authorization via two channels (email,
    WhatsApp), tracks the result per recipient/channel, and retries only
    the failed channel — bounded, not unlimited (FIN-DEC-17 approves the
    single-channel-success behavior; it does not specify retry bounds,
    see Open Decisions)
  - tracks physical-delivery confirmation per document (FIN-DEC-18–21),
    accumulating partial confirmations until the authorized document set
    is complete
  - owns none of the domain decisions above — only sequencing,
    correlation, deduplication, and durability of the process that waits
    for and reacts to them
```

This division is a proposal for discussion, not an implemented workflow, not a change in any component's existing authority, and not a resolution of the open question (already recorded in `FINANCEIRO.md` and `P0_AUTHORITY_MATRIX.md` footnote 1) of whether COMUNICACAO is in fact the right owner of the WhatsApp-group channel.

---

## Events (TECHNICAL_PROPOSAL, NORMATIVE_TARGET — none implemented, none named by any FIN-DEC)

| Event | Producer | Consumer | Correlation key (proposed) | Required fields |
|---|---|---|---|---|
| `MessageReceived` | COMUNICACAO (channel layer) | COMUNICACAO (own classification step) | thread/message id | raw text, sender identity, channel, reply-to message id |
| `ConfirmationClassified` | COMUNICACAO | ORQUESTRADOR | `ftrCode` (proposed — see Correlation Key note below) | sender identity, bound request/version, full-or-partial flag, raw text (for audit), classification result: AFFIRMATIVE / NEGATIVE / AMBIGUOUS / UNBOUND |
| `SelectionClassified` | COMUNICACAO | ORQUESTRADOR | `ftrCode` | sender identity, bound request/version, selected-document list, raw text |
| `EligibilityEvaluated` | FINANCEIRO | ORQUESTRADOR | `ftrCode` | `release_flag`/eligibility result, `bank_credit_confirmed`, partial-payment decision (if applicable), audit reference |
| `AuthorizationChannelResult` | dispatch mechanism (owner not decided — see Open Decisions) | ORQUESTRADOR | authorization id + channel + recipient | success/failure, timestamp, attempt count |
| `AuthorizationSent` | ORQUESTRADOR | (no verified consumer proposed) | authorization id | recipients, channels, document scope, per-channel result summary |
| `DeliveryConfirmationClassified` | COMUNICACAO | ORQUESTRADOR | `ftrCode` + authorization id | sender identity, confirmed document(s), raw text |
| `AuthorizationSetFullyDelivered` | ORQUESTRADOR | (no verified consumer proposed) | authorization id | full list of confirmed documents, timestamps |

**Correlation key note (TECHNICAL_PROPOSAL, not a decision):** `ftrCode` is proposed as the correlation key because every other P0 gate uses it (`FINANCEIRO.md`, `COMPLIANCE.md`, `QUALIDADE.md` Input Contracts) and FIN-DEC-06's presented summary includes the FTR. This is **not** stated by any FIN-DEC record as the binding mechanism, and the technical means of extracting/verifying `ftrCode` from a WhatsApp reply is already recorded as unresolved (`FINANCEIRO.md` Implementation Gap #9). COMUNICACAO's own correlation key today is `session_id`, not `ftrCode` (`COMUNICACAO.md`'s ADR-001A adapter section) — reconciling the two is itself unresolved work, not settled by this proposal.

---

## Proposed States (TECHNICAL_PROPOSAL — extends, does not replace, `FINANCEIRO.md`'s own proposed states)

```
AWAITING_INPUTS                 (from FINANCEIRO.md) neither confirmation
                                 nor selection received yet
CONFIRMATION_RECEIVED           (from FINANCEIRO.md) confirmation valid and
                                 bound; selection still pending
SELECTION_RECEIVED              (from FINANCEIRO.md) selection received;
                                 confirmation still pending
NOT_CONFIRMED                   (from FINANCEIRO.md) negative, ambiguous,
                                 or unbound reply — does not advance
READY_TO_AUTHORIZE              (from FINANCEIRO.md) both present, in
                                 either order — FINANCEIRO not yet invoked
ELIGIBILITY_REJECTED            [NEW] FINANCEIRO was invoked and returned
                                 an ineligible result (e.g. invoiceStatus/
                                 paymentStatus gate unmet even with a valid
                                 confirmation) — no FIN-DEC record or code
                                 path defines what happens next from here
                                 (see Open Decisions / Failure Handling)
AUTHORIZATION_IN_PROGRESS       [NEW] eligible result received; dispatch to
                                 one or both channels started, at least one
                                 channel result still outstanding
AUTHORIZATION_SENT              [NEW, extends FINANCEIRO.md's same-named
                                 state] per FIN-DEC-07, this is authorization
                                 dispatched, explicitly NOT proof of
                                 physical delivery
AWAITING_DELIVERY_CONFIRMATION  [NEW] authorization sent; every authorized
                                 document is still at FINANCEIRO.md's
                                 per-document PENDING_DELIVERY sub-state —
                                 none has reached DELIVERY_CONFIRMED yet
                                 (FIN-DEC-18)
PARTIALLY_DELIVERED             [NEW] the aggregate over the authorized
                                 document set: some documents carry
                                 FINANCEIRO.md's per-document DELIVERY_
                                 CONFIRMED sub-state, others remain
                                 PENDING_DELIVERY (FIN-DEC-21's own worked
                                 example: BL confirmed, CO/Phyto pending)
FULLY_DELIVERED                 [NEW, terminal] the aggregate once every
                                 authorized document carries FINANCEIRO.md's
                                 per-document DELIVERY_CONFIRMED sub-state
                                 (FIN-DEC-21) — this state says nothing
                                 about the financial balance, which FIN-DEC-
                                 21 explicitly keeps separate
```

These three delivery-tracking states are computed purely as an aggregate over the per-document `PENDING_DELIVERY`/`DELIVERY_CONFIRMED` sub-states `FINANCEIRO.md`'s Consolidated section defines — they introduce no separate per-document data model of their own. None of the states above exist in any current code (`financeiro/index.js`, `comunicacao/index.js`, or `master.js`). They are design labels for this draft, not implemented enums, and are not required to replace `paymentStatusService.js`'s existing 9-value Portuguese enum, consistent with the same non-replacement note already recorded in `FINANCEIRO.md`.

---

## Inputs / Outputs (workflow-level, TECHNICAL_PROPOSAL)

**Inputs (to start or resume a workflow instance):**
- `ftrCode` (proposed correlation key — see note above).
- The financial summary fields FIN-DEC-06/13 approve for presentation: FTR, invoice, amount, currency (full case); FTR, invoice, currency, invoice total, amount received, balance (partial case).
- Classified events from COMUNICACAO: `ConfirmationClassified`, `SelectionClassified`, `DeliveryConfirmationClassified`.
- `EligibilityEvaluated` from FINANCEIRO.
- `AuthorizationChannelResult` from whatever mechanism performs the actual email/WhatsApp send (owner not decided — see Open Decisions).

**Outputs:**
- No downstream component is verified to consume any output of this proposed workflow today — the same "no verified consumer" finding already recorded for every existing P0 component's output contract applies here by construction, since nothing calls this proposed component yet.
- The workflow's own state (above) and its audit trail are its primary externally-observable product.

---

## Responsibilities Matrix (recap)

**Value legend for this table — deliberately distinct from `P0_AUTHORITY_MATRIX.md`'s legend, so nothing below is mistakable for a business-approved authority determination:**
```
PROPOSED_OWNER     — this draft's technical proposal assigns this component
                     primary responsibility for the row; NOT approved by the
                     business, NOT implemented
PROPOSED_PRODUCER  — this draft's technical proposal has this component
                     supply a signal another component validates; NOT
                     approved, NOT implemented
AUTHORITATIVE      — an already-confirmed authority per P0_AUTHORITY_MATRIX.md
                     (the real matrix, not this draft), restated here for
                     context — unchanged by this proposal
NONE               — no component, proposed or confirmed, holds this
                     responsibility
```

| Responsibility | COMUNICACAO | FINANCEIRO | ORQUESTRADOR |
|---|---|---|---|
| Receive/normalize inbound message | PROPOSED_OWNER | — | — |
| Classify message shape (confirmation/selection/delivery/unclassified) | PROPOSED_OWNER | — | — |
| Bind reply to sender identity and prior message | PROPOSED_OWNER | — | — |
| Validate confirmation content (affirmative vs. negative/ambiguous) | PROPOSED_PRODUCER (classification signal) | PROPOSED_OWNER (final validation) | — |
| Compute eligibility / `release_flag` (incl. partial payment) | — | AUTHORITATIVE (confirmed, per `P0_AUTHORITY_MATRIX.md` — unchanged by this proposal) | — |
| Wait for confirmation + selection, in either order | — | — | PROPOSED_OWNER |
| Decide when to request FINANCEIRO's evaluation | — | — | PROPOSED_OWNER |
| Sequence the single, two-channel authorization dispatch | — | — | PROPOSED_OWNER |
| Track per-channel/recipient delivery result and bounded retry | — | — | PROPOSED_OWNER |
| Accumulate per-document physical-delivery confirmation | — | — | PROPOSED_OWNER |
| Decide whether a physical original was actually delivered | — | — | **NONE** — this is Rodrigo's or Leonardo's decision (FIN-DEC-19); the orchestrator only records/accumulates what COMUNICACAO classifies and FINANCEIRO (or a to-be-decided validator) confirms is bound and authorized |

---

## Deduplication (TECHNICAL_PROPOSAL)

- **Inbound message level:** COMUNICACAO's existing Firestore session write is an unconditional full overwrite (`comunicacao/index.js:22`, `.set()`), not a merge or reject-on-exists (`COMUNICACAO.md` Idempotency section) — **not sufficient** on its own for this flow. The orchestrator must supply its own duplicate-delivery protection, consistent with the note already recorded in `FINANCEIRO.md`'s ADR-001A adapter section ("a workflow engine wrapping this component as its FTR-discovery entry point must supply its own duplicate-delivery protection").
- **Confirmation/selection level:** a duplicate confirmation or selection reply for the same pending request may cause FINANCEIRO's eligibility evaluation to run again — recalculation itself is not prohibited, consistent with `FINANCEIRO.md`'s own acceptance criterion ("may repeat the gate computation") and its Consolidated section's tracking model ("Recalculation is allowed"). What must not duplicate is the business *effect*: a second, independent authorization dispatch, or a second audit/business-effect record for the same eligible outcome. Each evaluation attempt — including one that recomputes an already-known result — remains individually and legitimately visible in the audit trail; deduplication applies to outward effects, not to the record that an evaluation happened.
- **Authorization/channel level:** a retry of a failed channel must reuse the same authorization identifier, scope, and content — never mint a new authorization (FIN-DEC-17, explicit: "a autorização continua única, com o mesmo identificador, escopo e conteúdo nas novas tentativas").
- **Delivery-confirmation level:** repeating the same document's delivery confirmation must not duplicate the delivered record, nor reopen a document already marked delivered (FIN-DEC-21, explicit).

---

## Failure Handling (TECHNICAL_PROPOSAL, with explicit OPEN_DECISION markers)

- **One channel fails, the other succeeds (FIN-DEC-17, `BUSINESS_DECISION`):** the authorization is valid on the succeeding channel while the system retries the failed one. **`OPEN_DECISION`:** FIN-DEC-17 itself does not define retry interval, maximum attempt count, or what happens after retries are exhausted ("não há autorização para tentativas ilimitadas" — a negative constraint, not a positive specification). This draft does not invent those values.
- **Both channels fail:** not addressed by any FIN-DEC record. Must not be silently recorded as success (per FIN-DEC-17's own acceptance-criteria language, already carried into `FINANCEIRO.md`). What should happen instead — escalation, indefinite retry, human alert — is `OPEN_DECISION`.
- **FINANCEIRO returns an ineligible result** (`ELIGIBILITY_REJECTED`, above): no FIN-DEC record and no existing code path (`FINANCEIRO.md`'s own Authority Boundary "Human override" discussion) defines an automatic next step. The pre-existing, unresolved question of whether an EXCECOES override can bypass `canReleaseOriginalDocuments` is **not** answered by this draft and must not be assumed as the escalation path.
- **Negative, doubtful, or ambiguous reply:** recorded as `NOT_CONFIRMED`; no re-prompt, no automatic retry-request behavior is authorized by any FIN-DEC record — inventing one here would exceed this draft's scope.
- **Value, currency, or document-set change after a request was already sent:** FIN-DEC records already flag this as unspecified ("Alteração de valor, moeda ou objeto após a solicitação exige tratamento de invalidação/reconfirmação a especificar" — `FINANCEIRO_DECISIONS.md`). Repeated here as still open, not resolved.
- **Delivery confirmation from someone other than Rodrigo or Leonardo:** rejected outright, never recorded as a valid delivery (FIN-DEC-19, explicit).
- **Delivery confirmation for a document outside the authorized set:** must not be incorporated by inference; requires clarification rather than silent scope expansion (FIN-DEC-21, explicit, echoing FIN-DEC-15/16's same rule for the original authorization scope).

---

## Proposed Acceptance Criteria (orchestrator-specific — additive to, not a repeat of, `FINANCEIRO.md`'s and `COMUNICACAO.md`'s own lists)

None of these are implemented or executed.

1. Confirmation and selection events for the same operation, received in either order, both persist and correlate to the same pending request; neither is discarded for arriving "out of sequence."
2. A duplicate confirmation or duplicate selection message for the same pending request may cause FINANCEIRO's evaluation to run again — recalculation is not itself prohibited (see `FINANCEIRO.md`'s Consolidated section, "Recalculation is allowed"). What must not happen is a second, independent authorization dispatch or a duplicated business-effect/audit record for the same eligible outcome; each evaluation attempt remains individually visible in the audit trail rather than being collapsed or discarded.
3. No authorization dispatch begins before `EligibilityEvaluated` reports an eligible result — `READY_TO_AUTHORIZE` is not itself permission to authorize.
4. A single authorization identifier is used across both channels and across every retry of a failed channel; no code path mints a second identifier for the same eligible result.
5. A channel failure is recorded and retried independently of the other channel's outcome; the overall authorization is not marked failed while at least one channel has a terminal success (FIN-DEC-17).
6. Per-document delivery confirmation accumulates without discarding prior confirmations — confirming one document does not require or imply re-confirming previously confirmed ones (FIN-DEC-21).
7. `FULLY_DELIVERED` is reached only when every document in the authorized set (as scoped by FIN-DEC-15/16, not the full original set) has a valid delivery confirmation.
8. A delivery confirmation never modifies, closes, or reconciles the financial balance — FIN-DEC-21 keeps these facts explicitly separate.
9. Every event above (confirmation, selection, eligibility, authorization dispatch, per-channel result, delivery confirmation) is retained with its correlation key, sender/actor, and timestamp, sufficient to reconstruct the sequence for audit — the specific retention *duration* is `OPEN_DECISION` (FIN-DEC-14/20 leave it "a definir"), but the *shape* of what must be retained is not.
10. Replaying/redelivering any one event (confirmation, selection, channel result, delivery confirmation) produces no observable state change beyond the first valid processing of that event.
11. A channel result indicating a notification was sent, delivered, or read (`AuthorizationChannelResult`) must never be recorded or treated as a physical-delivery confirmation — only a `DeliveryConfirmationClassified` event, bound to the correct authorization and document, from an authorized sender, establishes delivery (FIN-DEC-18–20, mirrored from `FINANCEIRO.md`'s FIN-AC-18A).
12. Correlation required to accept an inbound event is event-specific, not one blanket rule: a `ConfirmationClassified` or `SelectionClassified` event must match authorized sender identity, operation, pending request, and request version to be accepted; a `DeliveryConfirmationClassified` event must additionally match the specific authorization id and name only documents within that authorization's scope (FIN-DEC-18–21) — matching identity/operation/request/version alone is not sufficient for a delivery event without also matching the authorization and its document scope.

---

## Relationship to the Frozen PoC (preserved, not reused as sufficient evidence)

`poc/adr-001a/temporal/TEST_CONTRACT.md`'s TEST-01 through TEST-10 and their recorded results (`POC_TESTS_EXECUTED: 10/10`, 9 PASS outright, TEST-10 FAIL-then-PASS-on-addendum) are **unchanged by this draft**. This draft does not modify that document, does not claim any of its 10 invariants is sufficient evidence for the flow proposed here, and does not reuse its Temporal-specific implementation files (this draft is engine-agnostic; the frozen PoC is Temporal-specific by construction). Specifically:

- TEST-03/TEST-06 each prove a **single** signal-gated wait (`wait/resume`, `HITL`). Neither composes **two independent, order-agnostic waits converging** the way `CONFIRMATION_RECEIVED`/`SELECTION_RECEIVED` → `READY_TO_AUTHORIZE` requires.
- TEST-08 proves a **linear, single-evidence-input** 6-state financial-gate sequence. It does not model a partial-payment branch, nor a second, independent human decision (release-with-balance) layered onto the same gate.
- TEST-05/TEST-07 prove single-activity retry and single-Workflow-ID duplicate rejection. Neither proves a **two-destination, partial-success, per-channel-bounded-retry** dispatch pattern.
- No test in the frozen contract models **incremental, per-item accumulation toward a completion state** (FIN-DEC-21's per-document delivery tracking).

None of this is a defect in the frozen PoC — it answered the questions it was scoped to answer. It is recorded here so that this draft's new scenarios (below) are not mistaken for already-covered ground.

---

## New Test Scenarios Needed (identified only — not implemented, not executed)

| Scenario | Extends which ADR-001A invariant | Why the frozen 10 don't cover it | Precondition before it could be attempted |
|---|---|---|---|
| SCENARIO-A: two-signal convergence, either order | wait/resume (TEST-03), HITL (TEST-06) | Both frozen tests gate on exactly one signal; this needs two independent waits joining into one state, order-agnostic | Engine choice (`OPEN_DECISION`); confirmation/selection event shapes agreed |
| SCENARIO-B: single authorization, two channels, partial channel failure, bounded retry | retry (TEST-05), duplicate protection (TEST-07) | TEST-05 retries one Activity; TEST-07 dedups one Workflow ID. Neither models two destinations with independent per-channel outcomes under one shared identifier | Retry bound decided (`OPEN_DECISION`, FIN-DEC-17 leaves it open); channel-send mechanism owner decided |
| SCENARIO-C: per-document partial delivery accumulation to completion | version evolution's incremental-state spirit is closest, but no frozen test models item-level accumulation at all | No existing invariant or test addresses a growing, partial completion set | Document-selection data model decided (`OPEN_DECISION`, `FINANCEIRO.md` Implementation Gap #11) |
| SCENARIO-D: duplicate inbound message at the orchestration boundary (distinct from COMUNICACAO's own persistence-layer overwrite gap) | duplicate protection (TEST-07) | TEST-07 tests engine-level Workflow-ID reuse only; it does not test a redelivered *business* message being correctly folded into an already-open, multi-signal-waiting instance | Engine choice; correlation-key mechanism decided |
| SCENARIO-E: FINANCEIRO-ineligible result reached after a valid confirmation | financial gate (TEST-08) | TEST-08's test double only reaches `RELEASE_ELIGIBLE` or stops earlier; it never models a *valid* confirmation combined with a gate failure on an unrelated condition (e.g. `invoiceStatus` not `Issued`) | Escalation policy decided (`OPEN_DECISION`, no FIN-DEC or code path defines one) |

Each scenario, if pursued, would need its own frozen test contract in the same style as `TEST_CONTRACT.md` — this table is a punch list, not that contract.

---

## FINANCEIRO Adapter Update Needed (pointer only — no code or FINANCEIRO.md change made here)

`FINANCEIRO.md`'s existing "ADR-001A Minimum Adapter Contract" section still specifies, in full and unchanged:

```
invoke('financeiro', 'evaluate_release', context)
  → success:            { release_flag: boolean, bank_credit_confirmed: boolean|null,
                           swift_valid: boolean|null, audit_id: string|null }
  → deterministic_gate:  release_flag itself IS the gate result — the workflow
                          engine must treat `release_flag: true` as "domain
                          authorized release," never compute or override it
  → retryable_failure:   UNKNOWN — no retry classification exists yet (see
                          Retry Semantics); until defined, treat all failures
                          as REQUIRES_REVIEW rather than assuming retryable
  → permanent_failure:   not established
  → review_required:     payment_tracking.status in {REVISAO_MANUAL,
                          AGUARDANDO_SWIFT, SALDO_PENDENTE} — advisory signal,
                          not a hard gate
  → correlation:         ftr_code (echoed input) — no event_id/correlation_id
                          exists in this component's output today
```

This is the **original** 3-field-gate shape and does not reflect any of the FIN-DEC-01–21 reconciliation already written elsewhere in the same document's "Approved Confirmation & Release Flow" section. It remains deliberately unedited by this draft — kept as a clean, separate record of current behavior rather than being blended with the proposed interface below. Specifically stale relative to that section — missing adapter actions, not incorrect ones:

1. No adapter action accepts a structured confirmation event (sender identity, bound request/version, affirmative/negative/ambiguous classification) in place of a raw `bankCreditConfirmed` boolean.
2. No adapter action accepts a document-selection payload (FIN-DEC-15/16).
3. No adapter action represents the partial-payment decision path (FIN-DEC-11/12/13) as distinct from the full-payment path.
4. No adapter action exists for evaluating or recording a physical-delivery confirmation (FIN-DEC-18–21) — today's single `evaluate_release` action only reaches as far as authorization, never delivery.

**Mapping `review_required` to the proposed coordination states (a relationship, not a replacement):** `review_required`'s three existing values are not declared obsolete by this proposal merely because new coordination states exist above — they describe `payment_tracking`'s own, unrelated precedence table (`FINANCEIRO.md` Business Rules #4) and remain valid outputs of that computation regardless of this draft.

| Current `review_required` value | Relationship to this draft's proposed states | Gap |
|---|---|---|
| `REVISAO_MANUAL` | Orthogonal — forced by the caller-supplied `needsManualReview` flag, unrelated to a confirmation/selection/delivery signal | No adapter action translates between this and `NOT_CONFIRMED`/`ELIGIBILITY_REJECTED`; the two vocabularies coexist untranslated |
| `AGUARDANDO_SWIFT` | Loosely overlaps with `AWAITING_INPUTS`/`CONFIRMATION_RECEIVED` in spirit (payment not yet evidenced) but is computed from `swiftReceived`/due-date logic, not from any WhatsApp confirmation event | No mapping exists in code; the two signals are computed independently today |
| `SALDO_PENDENTE` | Loosely overlaps with the financial precondition behind `PARTIALLY_DELIVERED`, but `payment_tracking.status` and the partial-payment release decision (FIN-DEC-12/13) are, per `FINANCEIRO.md`'s own Open Decisions, still not reconciled with each other | Pre-existing gap, already recorded in `FINANCEIRO.md`; not newly introduced by this draft |
| *(no current value)* | `NOT_CONFIRMED`, `ELIGIBILITY_REJECTED`, and the delivery-tracking states | No current adapter output represents any of these — this is a genuine addition, not a replacement of `review_required` |

**Recommendation (pointer, not executed):** a future documentation-only pass on `FINANCEIRO.md` should add one or more adapter actions (e.g., an `evaluate_release` revision accepting the structured event shape, plus a distinct action for delivery-confirmation recording) to that file's own "ADR-001A Minimum Adapter Contract" section — and, separately, decide whether `review_required` and the new coordination states should ever be unified, which this draft does not decide. This draft deliberately does not prescribe the exact revised signature — that is `FINANCEIRO.md`'s own document to update, consistent with the instruction that this task only point out the gap.

---

## COMUNICACAO Adapter Update Needed (pointer only — no code or COMUNICACAO.md change made here)

`COMUNICACAO.md`'s existing "ADR-001A Minimum Adapter Contract" section still specifies only:

```
invoke('comunicacao', 'parse_message', context)
  → success:            { intent, ftr_code, ftr_code_normalized, ftr_ambiguous,
                           session_id, response_template, ... (full shape above) }
  → deterministic_gate:  N/A — this component never gates anything
  → retryable_failure:   N/A — no failure mode exists
  → permanent_failure:   N/A
  → review_required:     ftr_ambiguous: true (informational; no queue exists
                          today to actually route it to review)
  → correlation:         session_id (NOT ftr_code — this is the one P0
                          component whose correlation key is NOT the FTR
                          code, consistent with its FTR-gate exemption)
```

This is the adapter shape for the **existing** `/webhook-whatsapp`/`/webhook-gmail` intake and its fixed 6-value intent enum (`booking`/`invoice`/`bl_document`/`quote_offer`/`ftr_reference`/`unknown`). It does not reflect any part of the channel role this draft's Technical Proposal (and `COMUNICACAO.md`'s own "Reconciliation: channel role and proposed flow" section) sketches for the approved WhatsApp-group confirmation flow. Specifically stale relative to that proposal:

1. **Single, generic action only.** There is one `parse_message` action producing one of 6 generic intents — no action corresponds to the `ConfirmationClassified` / `SelectionClassified` / `DeliveryConfirmationClassified` events this draft's Events table proposes, and none of the 6 existing intents represents "bank credit confirmation," "document selection," or "physical-delivery confirmation."
2. **No affirmative/negative/ambiguous classification exists.** `parse_message`'s output has no field distinguishing a bound-but-negative or bound-but-ambiguous reply from an affirmative one — the "necessary but not sufficient" rule already recorded in both `FINANCEIRO.md`'s and `COMUNICACAO.md`'s own Reconciliation sections has no corresponding adapter output field today.
3. **No reply-to-message binding is represented.** Neither the Input Contract (`subject`, `body`, `channel`, `from`, `threadId`) nor the adapter's success shape carries which prior message (the agent's summary post) a reply is bound to — required for correlating a confirmation/selection/delivery reply to the correct pending request/version.
4. **Correlation key mismatch, unresolved.** The adapter's own `correlation: session_id (NOT ftr_code)` line is accurate for the existing intake but conflicts with this draft's proposed `ftrCode`-keyed events (see this draft's Correlation Key note under "Events") — no adapter revision resolves this, and this draft does not resolve it either.
5. **No distinction between the general intake webhook and the dedicated per-operation WhatsApp group** (FIN-DEC-04/05). The adapter contract has one action for one channel; whether the approved group is additional traffic through the same `parse_message` action or a separate one is undecided (see Open Decisions below), so no adapter revision can be written yet without that decision.
6. **`review_required: ftr_ambiguous: true` does not map onto `NOT_CONFIRMED`.** The existing adapter's only "needs attention" signal is about multiple FTR codes in one message — a different concept from an unbound, negative, or ambiguous confirmation/selection/delivery reply, which this proposal's `NOT_CONFIRMED` state (see Proposed States) has no adapter-level equivalent for today.

**Recommendation (pointer, not executed):** a future documentation-only pass on `COMUNICACAO.md` should add adapter action(s) distinct from `parse_message` for the classification vocabulary this draft proposes, once (a) the channel-ownership question (Open Decisions, below) is settled and (b) the correlation-key mismatch between `session_id` and `ftrCode` is resolved. This draft deliberately does not prescribe the exact revised signature — that is `COMUNICACAO.md`'s own document to update, consistent with the same pointer-only treatment already given to `FINANCEIRO.md` above.

---

## Open Decisions — explicitly NOT chosen by this draft

- **Engine** (Temporal / GCP Workflows / custom): `ADR-001A-durable-workflow-engine.md` remains `NOT_DECIDED`. This draft is written engine-agnostically on purpose.
- **Persistence authority** for orchestrator-owned correlation/durable state (Firestore vs. Supabase): `ADR-007` is `NOT_STARTED`. Not chosen here.
- **Retention period** for confirmation/selection/delivery messages and their metadata: FIN-DEC-14/20 leave this "a definir." Not chosen here.
- **Revocation policy:** no FIN-DEC record addresses whether an already-sent authorization can be revoked or invalidated, by whom, or what happens to in-flight delivery tracking if it is. Not invented here.
- **Retry bounds** for FIN-DEC-17's channel-failure case (interval, maximum attempts, behavior after exhaustion): FIN-DEC-17 itself leaves these unspecified. Not chosen here.
- **Escalation path** for an `ELIGIBILITY_REJECTED` result or a both-channels-failed authorization: no FIN-DEC record or existing code path defines one (including the pre-existing, separately unresolved question of EXCECOES's override reaching FINANCEIRO's gate). Not invented here.
- **Owner of the actual email/WhatsApp send mechanism** referenced in the Events table (`AuthorizationChannelResult`'s producer): this draft assigns dispatch *coordination* to the orchestrator but does not decide which component performs the literal send — COMUNICACAO, a new notification component, or something else. Not decided.
- **Who is the WhatsApp-group channel owner** (COMUNICACAO vs. FINANCEIRO vs. new component): already flagged as unresolved in `FINANCEIRO.md`, `COMUNICACAO.md`, and `P0_AUTHORITY_MATRIX.md` footnote 1. This draft's Technical Proposal assumes COMUNICACAO for concreteness, consistent with those documents' own proposals — it does not resolve the question.

---

## Evidence Index

| Claim | File | Symbol/Lines | Type |
|---|---|---|---|
| Current router has no durability | `src/orchestrator/master.js` | 40-56, 68-89 | RUNTIME_CODE |
| Engine choice not decided | `docs/adr/ADR-001A-durable-workflow-engine.md` | full document, `FINAL DECISION: NOT DECIDED` | ARCHITECTURE_DOCUMENTATION |
| Orchestration engine authority boundary | `docs/adr/ADR-001A-durable-workflow-engine.md` | "Authority boundary" section | ARCHITECTURE_DOCUMENTATION |
| No durable orchestration in production | `docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` | §4 | ARCHITECTURE_DOCUMENTATION |
| Frozen PoC test results (10 tests, engine-specific, synthetic doubles) | `poc/adr-001a/temporal/TEST_CONTRACT.md` | full document | TEST (PoC, frozen) |
| Approved financial/delivery flow, FIN-DEC-01 through FIN-DEC-21 | `docs/contracts/FINANCEIRO_DECISIONS.md` | full document, dated 2026-09-21 | BUSINESS_DECISION |
| FINANCEIRO's own reconciliation and stale adapter section | `docs/contracts/FINANCEIRO.md` | "Approved Confirmation & Release Flow" and "ADR-001A Minimum Adapter Contract" sections | BUSINESS_DECISION reconciliation + RUNTIME_CODE-derived adapter spec |
| COMUNICACAO's proposed channel role, not approved | `docs/contracts/COMUNICACAO.md` | "Reconciliation: channel role and proposed flow" | TECHNICAL_PROPOSAL |
| COMUNICACAO's correlation key is session_id, not ftr_code | `docs/contracts/COMUNICACAO.md` | ADR-001A Minimum Adapter Contract section | RUNTIME_CODE |
| Orchestrator-contract dependency flagged as open | `docs/contracts/DOCUMENTATION_PLAN.md` | "Dependências transversais," item 1 | ARCHITECTURE_DOCUMENTATION |
| COMUNICACAO/FINANCEIRO/orchestrator boundary question | `docs/contracts/P0_AUTHORITY_MATRIX.md` | footnote 1, footnote 7 | ARCHITECTURE_DOCUMENTATION |

**No runtime, test, or configuration file was changed to produce this document. No engine, database, retention period, or revocation policy was chosen. FIN-DEC-01 through FIN-DEC-21 are unmodified by this draft.**
