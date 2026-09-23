# FINANCEIRO — Normative Component Contract

**Status:** Normative contract, hardened from repository evidence. This is a P0 contract — FINANCEIRO gates the release of original shipping documents, the single highest-stakes deterministic decision in the system.
**Evidence precedence used:** RUNTIME_CODE > TEST > CONFIGURATION > ARCHITECTURE_DOCUMENTATION > PRD > ROADMAP. Where the task's suggested state progression is not yet established in the repository, it is labeled `NORMATIVE_TARGET`, not treated as current fact. **BUSINESS_DECISION** (explicit, dated decisions recorded in `FINANCEIRO_DECISIONS.md`, FIN-DEC-01 through FIN-DEC-21, all confirmed 2026-09-21) sits above ARCHITECTURE_DOCUMENTATION/PRD/ROADMAP as approved intent, but is not itself RUNTIME_CODE — a BUSINESS_DECISION establishes what must be built, not that it has been built. Every reconciliation below keeps the two distinct.

---

## Identity

- **Name:** FINANCEIRO
- **Architectural classification:** Domain Service / Rule Engine (deterministic; zero LLM authority — RUNTIME_CODE, repo-wide search for `anthropic|openai|gpt-|claude-` returns no match in `src/agents/financeiro/`)
- **Domain responsibility:** SWIFT reference format validation, bank-credit-confirmation lookup, original-document release gating, payment reconciliation flagging, payment-tracking status/balance computation, arrival/collection alerting.
- **Lifecycle role:** Sequential FTR lifecycle stage (per `test/integration/ftr-end-to-end.test.js:166`, `targetAgent: 'financeiro'`), gated by FTR mutex like all non-transversal agents (`src/orchestrator/master.js` — absent from `AGENTS_WITHOUT_FTR_GATE`).

---

## Invocation

- **Entry conditions:** Invoked via `master.route({targetAgent: 'financeiro', ftrCode, ...})` — `ftrCode` must be non-empty (`master.js` `isValidFtr`, RUNTIME_CODE). **No live HTTP route exists for this component** — confirmed absent from `src/routes/index.js`'s 6 routes (RUNTIME_CODE, absence verified). Reachable today only via direct `master.route()` calls, as `test/integration/ftr-end-to-end.test.js:166` does.
- **Allowed actions/commands:** None distinguished by an `action` field — unlike EXCECOES/QUALIDADE, `financeiro/index.js`'s single `process(context)` always runs the same logic path (RUNTIME_CODE, `financeiro/index.js:12-76`).
- **Required context:** None enforced by code beyond the orchestrator's generic `ftrCode` presence check. `financeiro/index.js` destructures `swiftReference`, `invoiceStatus`, `paymentStatus`, `etaDate`, `paymentDate`, `userEmail` (line 13) without any required/optional distinction in code — CODE_ONLY.
- **Optional context:** `context.bankCreditConfirmed`, `context.totalInvoiceUsd`, `context.confirmedPaymentsUsd`, `context.swiftReceived`, `context.messageText`, `context.paymentDueDate`, `context.today`, `context.alertWindowDays`, `context.needsManualReview` — each has an explicit `??`/`||`/default fallback in code (`financeiro/index.js:20,52-63`), so their optionality is CODE_ONLY-confirmed, not documented elsewhere.

---

## Input Contract

| Field | Type | Required/Optional | Source | Validation | Semantic meaning |
|---|---|---|---|---|---|
| `ftrCode` | string | required (orchestrator-enforced) | caller | `master.js isValidFtr`: non-empty string only — no format regex applied at this gate | FTR being evaluated |
| `swiftReference` | string | optional | caller | `swiftValidation.isValidSwiftReference`: regex `^[A-Z]{4}\d{3}[A-Z]{3}\d{3}[A-Z]{3}$` (`swiftValidation.js:3`) | Payment reference to validate |
| `invoiceStatus` | string | optional | caller (presumably `invoices.invoice_status` per `supabase.js` TABLES.INVOICES / `config/schemas.json` Invoice.invoice_status enum `Draft/Issued/Paid/Disputed`) | none in this component — raw string comparison only (`releaseGate.js:3`) | Gate input |
| `paymentStatus` | string | optional | caller — **ambiguous source, see Invariants/Open Decisions** | none — raw string comparison (`releaseGate.js:3`, compares to literal `'Received'`) | Gate input |
| `bankCreditConfirmed` | boolean or null/undefined | optional | caller, or computed internally if `swiftReference` present and this is unset (`index.js:20-24`) | none | Gate input |
| `etaDate` | ISO date string | optional | caller | none | Used for `reconciliation.isPaymentSuspiciouslyEarly` and `paymentStatusService` |
| `paymentDate` | ISO date string | optional | caller | none | Same as above |
| `userEmail` | string | optional | caller | none | Audit-entry attribution only |
| `totalInvoiceUsd` | number | optional | caller | none (`== null` guard only, `index.js:52`) | Gates whether `payment_tracking` sub-object is computed at all |
| `confirmedPaymentsUsd` | number | optional, default `0` | caller | none | Balance calculation input |
| `swiftReceived` | boolean | optional, derived if absent from `context.messageText` via `paymentSignals.detectSwiftMention` else `Boolean(swiftReference)` (`index.js:54`) | caller or derived | none | Status precedence input |
| `messageText` | string | optional | caller | none | Only consulted if `swiftReceived` is absent |
| `paymentDueDate` | ISO date string | optional | caller | none | Overdue/due-soon calculation |
| `today` | ISO date string | optional, default `new Date()` | caller | none | Testability seam |
| `alertWindowDays` | number | optional, default `7` (`paymentStatusService.js:19,47`) | caller or `src/config.js`? — **not verified**: `financeiro/index.js` passes `context.alertWindowDays` straight through (line 61), it does NOT read `CONFIG.ALERT_DAYS_BEFORE` from `src/config.js` despite that being the same conceptual value used by `logistics`/`alertService` — CODE_ONLY, unreconciled | none | Alert-window threshold |
| `needsManualReview` | boolean | optional, default `false` | caller | none | Forces `REVISAO_MANUAL` status unconditionally (`paymentStatusService.js:50-52`) |

---

## Output Contract

| Field | Type | Guaranteed/Conditional | Semantic meaning | Downstream consumer |
|---|---|---|---|---|
| `agent` | `'financeiro'` | guaranteed | Component identity tag | none verified — no caller inspects `result.agent` (CODE_ONLY convention shared by all 12 agents) |
| `ftr_code` | string or null | guaranteed | Echo of input | none verified |
| `swift_valid` | boolean or null | guaranteed (`null` when no `swiftReference` given, else `true`/`false`) | Format validity of `swiftReference` | none verified |
| `bank_credit_confirmed` | boolean or null | guaranteed | See Business Rules — **this is the single most consequential field in the component and it is backed by a mock** (see Implementation Gaps) | `releaseGate` internally |
| `release_flag` | boolean | guaranteed | Whether original documents may be released | **No verified downstream consumer** — no code reads `result.release_flag` after `financeiro.process()` returns (CODE_ONLY: the release *decision* is computed and audited, but nothing in the repository is verified to act on the flag by actually notifying a courier — `docs/ROADMAP.md:258` describes an intended "email DHL, courier número" action that has no corresponding code) |
| `audit_id` | string or null | guaranteed | Firestore `AUDIT_LOG` document id, set only when `release_flag` is true | none verified |
| `reconciliation` | object or null | conditional on `paymentDate` AND `etaDate` both present | `{suspiciously_early: boolean}` — advisory flag only | none verified |
| `payment_tracking` | object or null | conditional on `context.totalInvoiceUsd != null` | `computePaymentStatus(...)` result: `{status, balance}` | none verified as consumed by another component — this is the payment-tracking feature's own status, separate from `paymentStatus`/`release_flag` above (see Invariants) |

Early-return short-circuit: if `swiftReference` is given but fails format validation, the function returns **immediately** at `index.js:16-18` with `{agent, ftr_code, swift_valid: false, bank_credit_confirmed: null, release_flag: false, audit_id: null}` — `reconciliation` and `payment_tracking` are **absent from the returned object entirely** in this path (not merely `null` — the keys are never set). This is a genuine shape difference between the two return paths and is recorded as CODE_ONLY, undocumented elsewhere.

---

## Business Rules

1. **SWIFT reference format:** `^[A-Z]{4}\d{3}[A-Z]{3}\d{3}[A-Z]{3}$` (`swiftValidation.js:3`). **OPEN_DECISION flagged below** — this does not match the ISO 9362 BIC/SWIFT code format used by real banks (8 or 11 alphanumeric characters); it appears to validate an internal Francfort payment-tracking reference convention, not an actual bank SWIFT code. Classification: CODE_ONLY, unreconciled against any external standard.
2. **Release gate (`docs/ROADMAP.md:253-259`, `docs/PAGAMENTOS_TRACKING.md:59-68`, `releaseGate.js:2-4` — 3 independent sources agree, DOCUMENTED):** `canReleaseOriginalDocuments` returns true **only if** `invoiceStatus === 'Issued'` AND `paymentStatus === 'Received'` AND `bankCreditConfirmed === true`. All three conditions are mandatory; there is no partial-release or override path inside this function.
3. **A SWIFT copy alone is never confirmation (DOCUMENTED — `paymentSignals.js:1-6`, `docs/PAGAMENTOS_TRACKING.md:59-68`):** text-detected signals (`detectSwiftMention`, `detectPaymentConfirmedLanguage`) are explicitly, repeatedly commented as insufficient — only `bankQuery.queryBankCreditConfirmation`'s result (or a caller-supplied `bankCreditConfirmed`) may set the gate's boolean.
4. **Payment-tracking status precedence (RUNTIME_CODE, `paymentStatusService.js:41-85`, DOCUMENTED in its own header comment as "this module's documented interpretation"):** `needsManualReview` overrides everything → no `totalInvoiceUsd` → balance ≤ 0 (`PAGAMENTO_CONFIRMADO`) → overdue (`VENCIDO`) → any confirmed amount > 0 (`PAGAMENTO_PARCIAL`) → `swiftReceived` (`SWIFT_RECEBIDO`) → due soon (`AGUARDANDO_SWIFT`) → has a due date at all (`PAGAMENTO_PREVISTO`) → else `SALDO_PENDENTE`.
5. **Early-payment flag (`docs/ROADMAP.md:263`, `reconciliation.js:1-8`):** payment received more than 7 days before ETA is flagged `suspiciously_early` — advisory, non-blocking.
6. **Alert dedup and suppression (`alertService.js:37-42`):** an alert already sent for the *current* ETA is not re-sent; an alert is suppressed once balance ≤ 0 unless `needsManualReview`.
7. **Internal-only alerting (DOCUMENTED — `alertService.js:1-5`, cross-referenced by `docs/PAGAMENTOS_TRACKING.md:49`):** alert emails are never sent to the buyer, only to internal recipients (`src/config.js` `ALERT_RECIPIENTS`, always includes `export@francfort.co`).

---

## Invariants

- `FROZEN` per this task: **NO RELEASE WITHOUT FINANCIAL GATE** — no code path in `financeiro/index.js` sets `release_flag: true` without first calling `canReleaseOriginalDocuments`. Verified: the only assignment to `releaseFlag` is at `index.js:26`, unconditionally routed through the gate function.
- **IMPLEMENTATION_GAP — the gate's evidentiary basis is currently a mock, not real bank confirmation.** `bankQuery.js:5-7` (`queryBankCreditConfirmation`) unconditionally returns `{confirmed: true, ...}` for **any** syntactically valid SWIFT reference — it performs no actual bank API call (its own comment states this explicitly: *"no real bank API integration exists yet; this simulates confirmation for any syntactically valid SWIFT reference"*). Consequence: today, in the runtime as it exists, supplying any string matching the SWIFT regex and leaving `bankCreditConfirmed` unset will cause `bankCreditConfirmed` to resolve to `true` unconditionally. The invariant "no release without financial gate" is currently a **structural** guarantee (the code path is always consulted) but **not an evidentiary** one (the consulted source is a stub that always says yes). This is the single most important finding in this contract and must not be silently smoothed over. **BUSINESS_DECISION update (FIN-DEC-01/02/04-06/14):** the business has since approved what should replace this mock in operational terms — a human bank-credit lookup performed by Rodrigo or Leonardo, evidenced by a reply to a WhatsApp message the agent posts in the operation's WhatsApp group, with no attachment required. This answers the *business* question of what "real evidence" means (see Open Decisions), but `bankQuery.js` has not been touched — the mock remains the only code-level producer of `bankCreditConfirmed` as of this reconciliation. No automated bank-API integration was approved or requested; see the Functional Specification section below.
- **IMPLEMENTATION_GAP — two non-interoperating payment-status vocabularies coexist in this component.** `releaseGate.js` compares `paymentStatus` against the literal English string `'Received'` — matching `config/schemas.json`'s `Payment.payment_status` enum (`Pending, In Transit, Received, Cleared, Disputed`) and the same-named Supabase `payments` table column. Separately, `paymentStatusService.computePaymentStatus` produces a **different**, Portuguese, 9-value enum (`SEM_INFORMACAO` ... `REVISAO_MANUAL`) matching `supabase/migrations/0002_payment_tracking.sql`'s `payment_tracking_meta.payment_status` CHECK constraint (lines 28-32 of that migration). No RUNTIME_CODE was found in `financeiro/index.js` or elsewhere that translates one into the other, or that feeds `payment_tracking`'s computed status into `releaseGate`'s englishenum comparison. **OPEN_DECISION:** is `payment_tracking.status === 'PAGAMENTO_CONFIRMADO'` intended to ever influence `release_flag`, or are these two deliberately independent signals (one per-payment-row, one per-FTR-tracking-row)? Not resolved by any document found.
- Idempotency of `swiftReference` reuse across multiple `process()` calls is **not established** — no uniqueness check is performed by this component (the `payments.swift_reference UNIQUE` constraint lives in `supabase/migrations/0001_init_schema.sql`, outside this component's own code path, and is never queried by `financeiro/index.js`).

---

## Authority Boundary

```
MAY_DECIDE:
  - swift_valid (format check only — deterministic regex)
  - release_flag (deterministic function of 3 inputs — see Implementation Gap above
    for the caveat on bankCreditConfirmed's evidentiary weight)
  - reconciliation.suspiciously_early (advisory)
  - payment_tracking.status / .balance (deterministic precedence table)

MAY_RECOMMEND:
  - determineNextAction (alertService.js:67-70) — a next-action string for a
    human ("Cobrar o saldo pendente", "Confirmar crédito com o financeiro",
    etc.) — advisory text only, never itself invoked as an action

MAY_RECORD:
  - audit_id (Firestore AUDIT_LOG entry, written only on release_flag=true)

MAY_NOT_DECIDE:
  - Whether a bank credit is REAL — that determination is delegated to
    bankQuery.queryBankCreditConfirmation, which (Implementation Gap above)
    currently cannot make that determination either. No component in this
    repository currently holds this authority with real evidence.
    BUSINESS_DECISION (FIN-DEC-01/02): the approved real-world evidentiary
    source is Rodrigo's or Leonardo's own bank query, not this component and
    not an automated bank API. FINANCEIRO's authority stays confined to
    *computing release_flag from* whatever value that human confirmation
    resolves to (via `bankCreditConfirmed`) — the human confirmation and
    FINANCEIRO's gate computation are and remain two distinct
    responsibilities; neither one is approved to replace the other.
  - Whether to actually release documents to a courier — release_flag is
    computed but no verified code acts on it (see Output Contract)

LLM: NO AUTHORITY (zero LLM anywhere in src/, confirmed repo-wide)
```

**Human override:** `src/agents/excecoes/index.js`'s generic `action: 'override'` branch (`excecoes/index.js:10-15`) writes an audited override record for **any** `ftrCode`/`approvedBy` pair — but this is a shared, cross-agent mechanism, not FINANCEIRO-specific, and **no verified code path connects an EXCECOES override to `canReleaseOriginalDocuments`'s three-condition gate**. **OPEN_DECISION:** whether a Rodrigo override is intended to bypass the release gate, and if so how, is not established in any document or code path found. **Not resolved by FIN-DEC-01–21** (the complete decision set to date): FIN-DEC-03's "no second authorization after confirmation" describes the *normal* path through the gate (a valid `bankCreditConfirmed` satisfies the gate on its own merits), not an override of the gate's three conditions — it is a different mechanism from EXCECOES's override, and the two must not be conflated. FIN-DEC-17–21 (channel retry, delivery confirmation) do not touch this question either.

---

## Side Effects

- Firestore write: `COLLECTIONS.AUDIT_LOG` document, only when `release_flag === true` (`financeiro/index.js:30-38`).
- No writes to Supabase are performed directly by `financeiro/index.js` itself (verified: no `supabase`/`TABLES` import in this file) — despite `payments.bank_credit_confirmed` conceptually needing to be updated somewhere per `docs/ROADMAP.md:251`; **IMPLEMENTATION_GAP:** no code was found anywhere in `src/` that performs this Supabase write.
- No email is sent directly by `financeiro/index.js` — `alertService.js`'s email-building functions are not called from `index.js` at all (verified: no `require('./alertService')` in `financeiro/index.js`'s import list). **This means `alertService.js` is currently a disconnected module relative to this component's own `process()` entry point** — consistent with the prior documentation-coverage audit's finding that `alertService.js` exists, is tested, but is not wired into `index.js`.
- No Google Calendar interaction (`calendarService.js` is called from `logistics`, not `financeiro`).

---

## Persistence

- **Reads:** none verified directly in `financeiro/index.js` (all data arrives via `context`, supplied by the caller — no `supabase.from(...)` or `firestore.collection(...).get()` call exists in this file).
- **Writes:** `COLLECTIONS.AUDIT_LOG` (Firestore) — conditional, see Side Effects.
- **Current store:** Firestore for the audit entry; no direct store ownership for `payments`/`invoices` tables despite conceptually being the authority over their `bank_credit_confirmed`/release fields.
- **Authoritative ownership:** `DEFERRED_TO_ADR_007` — the baseline document (`docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §2) already records an open conflict between Firestore's and Supabase's FTR-status fields; this component adds a second, narrower instance of the same class of problem (two payment-status vocabularies, §Invariants above) that ADR-007 should resolve together with the broader question.

---

## Dependencies

- `swiftValidation.js`, `bankQuery.js`, `releaseGate.js`, `reconciliation.js`, `paymentStatusService.js`, `paymentSignals.js` — all sibling modules, imported directly (`financeiro/index.js:4-9`).
- `src/agents/contratos/auditTrail.js` (`buildAuditEntry`) — cross-agent direct import (`financeiro/index.js:3`), consistent with the "direct module import, not `master.route()`" invocation pattern established for every cross-agent call in this repository.
- `src/services/firestore.js`.
- **Not a dependency, despite conceptual proximity:** `alertService.js` (see Side Effects — imported by no one in `financeiro/index.js`), `src/services/email.js` (never called by this component), `src/services/calendarService.js` (never called by this component).

---

## Error Model

No typed/domain error taxonomy exists for FINANCEIRO (unlike `digitalizacao/errorCodes.js`). The only "error-shaped" branch is the SWIFT-format-invalid early return (`index.js:16-18`), which is not an exception — it is a valid, structured result with `swift_valid: false`. **No error codes are invented here for completeness** per this task's own instruction — this is recorded as `NOT_DOCUMENTED` / absent, not backfilled.

---

## Retry Semantics

```
RETRYABLE:       not established — no retry-count field or backoff call exists
                 in financeiro/index.js (unlike digitalizacao, which calls
                 excecoes.process directly on failure)
NON_RETRYABLE:   not established
REQUIRES_REVIEW: not established as a formal signal, though needsManualReview
                 forces PAYMENT_STATUS.REVISAO_MANUAL in payment_tracking —
                 this is a status value, not a retry-classification
UNKNOWN:         everything else — this component does not itself call
                 excecoes.process anywhere (verified: no require('../excecoes')
                 in financeiro/index.js), unlike digitalizacao
```

---

## Idempotency

Not established. No content-hash, no uniqueness check on `swiftReference` reuse performed by this component's own code (the database-level `UNIQUE` constraint on `payments.swift_reference` exists in `supabase/migrations/0001_init_schema.sql` but is never queried here). Calling `process()` twice with the same inputs produces the same deterministic output (the functions are pure), but nothing prevents the same SWIFT reference from being processed twice as if it were two separate payments, since this component performs no persistence read/write of `payments` rows itself.

---

## Human Review / Approval

- `needsManualReview` (boolean input) forces `REVISAO_MANUAL` in `payment_tracking.status` — but this affects only the `payment_tracking` output field, **not** `release_flag`.
- No human-approval workflow is implemented for the release decision itself — see Authority Boundary's "Human override" discussion (OPEN_DECISION).
- **BUSINESS_DECISION (FIN-DEC-01–16):** an approved human-approval design now exists for the release decision — Rodrigo or Leonardo confirms bank credit (and, for partial payments, explicitly authorizes release-with-balance using the exact wording in FIN-DEC-13) by replying in the operation's WhatsApp group to the agent's summary message. This design is documented in full in "Approved Confirmation & Release Flow" below. It remains **entirely unimplemented**: `financeiro/index.js` still only consumes a caller-supplied `bankCreditConfirmed` boolean, with no WhatsApp integration, identity binding, or message persistence anywhere in this component or its dependencies. A separate, later-approved human-approval design for the physical-delivery decision (FIN-DEC-18–21) exists in parallel — see "Consolidated requirements and acceptance — FIN-DEC-17 through FIN-DEC-21" below; the two designs cover different decisions (release authorization vs. delivery confirmation) and are not the same approval. See also the "Acceptance Criteria Index" below for a single pointer to both.

---

## Security / Permissions

No component-specific authorization model documented or implemented — `userEmail` is accepted and used only for audit-entry attribution (`index.js:31`), never validated against a permission list. Access control for whoever can call this component is entirely upstream, at the (non-existent, per Invocation) HTTP layer.

---

## Audit / Observability

- `logger.warn` on invalid SWIFT format (`index.js:16`).
- `logger.info` on release (`index.js:41`, tagged "GATE CRÍTICO").
- Firestore `AUDIT_LOG` entry on release, built by `contratos/auditTrail.buildAuditEntry` — carries `operation: 'release_documents'`, `resourceId: ftrCode`, `beforeState`/`afterState`, `userEmail`.
- No metric/counter is emitted toward MONITOR — consistent with the documentation-coverage audit's finding that MONITOR has no verified producer wiring from any other agent.

---

## Workflow Boundary

- **Valid predecessor/event:** per `docs/ROADMAP.md`'s phase diagram (ARCHITECTURE_DOCUMENTATION/ROADMAP, not RUNTIME_CODE-enforced): invoice issued, SWIFT sent, bank statement available. No code enforces this ordering — `financeiro.process()` can be called with any combination of fields at any time.
- **Successful exit:** `release_flag: true` + `audit_id` set.
- **Failure exit:** SWIFT-format-invalid early return (`swift_valid: false`, `release_flag: false`).
- **Wait/review state:** `payment_tracking.status === 'REVISAO_MANUAL'` or `'AGUARDANDO_SWIFT'` — but these do not halt or gate anything by themselves; they are advisory output values only.
- **Downstream capability:** `docs/ROADMAP.md:18` names `comissoes` as the next phase after payment confirmation — **no verified code wiring** connects `financeiro`'s output to a `comissoes` invocation (consistent with the orchestration-gap finding in the baseline document).

---

## ADR-001A Minimum Adapter Contract

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
**The workflow engine must not treat `bank_credit_confirmed: true` as strong evidence** until the Implementation Gap above (mock bank query) is resolved — this is the most important caveat for any PoC or production orchestration wrapping this component.

---

## Current Implementation Mapping

The task's suggested normative progression:
```
PAYMENT_UNKNOWN → PAYMENT_SIGNAL_DETECTED → PAYMENT_EVIDENCE_RECEIVED →
PAYMENT_VALIDATED → BANK_CREDIT_CONFIRMED → RELEASE_ELIGIBLE
```
is **`NORMATIVE_TARGET`** — introduced by this task, not previously established in any repository document — mapped against actual code as follows:

| Normative target state | Current implementation equivalent | Status |
|---|---|---|
| `PAYMENT_UNKNOWN` | `PAYMENT_STATUS.SEM_INFORMACAO` | Matches |
| `PAYMENT_SIGNAL_DETECTED` | `paymentSignals.detectSwiftMention`/`detectPaymentConfirmedLanguage` returning true, or `PAYMENT_STATUS.SWIFT_RECEBIDO` | Matches, informally |
| `PAYMENT_EVIDENCE_RECEIVED` | No distinct code-level state — collapses into `swiftReference` being present + valid format | `IMPLEMENTATION_GAP` (no distinct state) |
| `PAYMENT_VALIDATED` | No distinct code-level state — `swift_valid: true` is the closest, but this is a format check, not evidence validation | `IMPLEMENTATION_GAP` |
| `BANK_CREDIT_CONFIRMED` | `bankCreditConfirmed === true` | Matches in name, **but see the mock-evidence Implementation Gap above** — the state exists but its evidentiary backing does not |
| `RELEASE_ELIGIBLE` | `release_flag === true` (`canReleaseOriginalDocuments`) | Matches — this is the one state with a real, deterministic, code-enforced computation |

---

## Implementation Gaps

1. `bankQuery.queryBankCreditConfirmation` is a mock — always confirms. **This is the highest-priority gap in the entire P0 set.**
2. No code writes `payments.bank_credit_confirmed` in Supabase — the release gate consumes a caller-supplied value with no verified persistence trail.
3. Two non-interoperating payment-status vocabularies (English `payments.payment_status` vs. Portuguese `payment_tracking_meta.payment_status`) with no translation code between them.
4. `alertService.js` is fully implemented and tested but not wired into `financeiro/index.js`'s `process()` — dead code relative to this entry point.
5. No error-code taxonomy, no retry/backoff integration with EXCECOES from this component (digitalizacao is the only agent verified to call `excecoes.process()` directly).
6. `release_flag`'s downstream action (notifying a courier, per `docs/ROADMAP.md:258`) has no corresponding code.
7. `alertWindowDays` is read from `context` in this component, not from `src/config.js`'s `ALERT_DAYS_BEFORE` — an unreconciled second source of the same conceptual value used elsewhere (`logistics`).
8. **[NEW, BUSINESS_DECISION-derived] No WhatsApp integration exists anywhere in `src/agents/financeiro/` or its dependencies** (verified: no `whatsapp` reference in this component's files) — required by FIN-DEC-04/05/06 for posting the summary message and receiving the confirmation reply.
9. **[NEW] No identity-binding mechanism exists** to authenticate that a WhatsApp reply came from Rodrigo or Leonardo specifically, as opposed to merely arriving from a phone number or display name — required by the "controles técnicos propostos" in `FINANCEIRO_DECISIONS.md` (display name alone is explicitly called out there as insufficient).
10. **[NEW] `releaseGate.js`'s gate is binary on `paymentStatus === 'Received'`** — no branch exists for the partial-payment path FIN-DEC-11/12 approve; reconciling this requires a design decision on how `payment_tracking`'s `PAGAMENTO_PARCIAL` status (or an equivalent new field) is meant to satisfy or extend the gate, which is not established anywhere in code today.
11. **[NEW] No data model exists for "selected documents"** — FIN-DEC-15/16 require an authorization to name only the originals selected in the WhatsApp thread; no field in the Input/Output Contract above represents a document selection.
12. **[NEW] No mechanism exists to send a single authorization across two channels (email + WhatsApp) and track delivery per recipient/channel** — `alertService.js` sends email only and is disconnected from `index.js` (Gap #4); FIN-DEC-08/09/10 require one authorization, identified once, reaching both Rodrigo and Leonardo by both channels, with success/failure recorded per channel/recipient rather than treated as a single pass/fail outcome.
13. **[NEW] No message/metadata persistence or retention policy is implemented** for the confirmation reply itself — FIN-DEC-14 requires preserving the message, but leaves the retention policy "a definir."

## Open Decisions

- Is `SWIFT_REFERENCE_REGEX` meant to validate a real BIC/SWIFT code, or an internal reference convention? Format doesn't match ISO 9362. — **Not addressed by FIN-DEC-01–21 (the complete decision set to date); still open.**
- Should `payment_tracking.status` ever influence `release_flag`, or are they deliberately independent? — **Sharpened, not closed, by FIN-DEC-11/12:** the business now requires *some* partial-payment path into the release decision, which makes this technical question load-bearing rather than academic, but does not itself specify the answer.
- Is EXCECOES's generic manual override intended to ever bypass `canReleaseOriginalDocuments`, and if so, through what mechanism? — **Not addressed by FIN-DEC-01–21 (the complete decision set to date); still open** (see Authority Boundary note above distinguishing this from FIN-DEC-03).
- Who/what is responsible for eventually replacing the bank-query mock with a real integration, and what does "real evidence" mean operationally? — **RESOLVED at the business level by FIN-DEC-01/02/04-06/14**: Rodrigo or Leonardo, via their own bank query, evidenced by a WhatsApp reply in the operation group, no attachment required. **Still open at the implementation level:** every mechanism needed to carry out that design (items 8-13 in Implementation Gaps above).
- **[NEW]** Does the approved WhatsApp confirmation flow belong inside FINANCEIRO itself, inside COMUNICACAO (which `P0_AUTHORITY_MATRIX.md` records as `AUTHORITATIVE` for message normalization), or as a new, currently unmodeled channel-handling path? Not decided in this reconciliation — flagged, not answered, in `P0_AUTHORITY_MATRIX.md`. A technical (unapproved) proposal for splitting this across COMUNICACAO/FINANCEIRO/orchestrator is sketched in "Approved Confirmation & Release Flow" below, but it is a proposal, not a resolution.
- **[NEW]** What does "política de retenção a definir" (FIN-DEC-14) resolve to for the confirmation message and its metadata? Not decided.
- **[NEW]** What is the data model for a document selection (FIN-DEC-15/16) — identifier scheme, how it attaches to the authorization and to the FTR version, how a later change to the selection is handled? Not decided.

---

## Acceptance Criteria Index (FIN-DEC-01–21)

**Status:** navigation aid only — no new requirement, no duplication. This document accumulated two separate acceptance-criteria lists as FIN-DEC-01–21 grew in two rounds: a first list (unnumbered `FIN-DEC` prefix, plain item numbers) written when decisions ran through FIN-DEC-16, and a second, ID-prefixed list (`FIN-AC-*`) added later for FIN-DEC-17 through FIN-DEC-21. This index maps topic → home section → existing identifiers, exactly as those identifiers already appear in their home section. It does not restate any requirement's text, and it does not introduce new IDs.

| Topic | Home section | Identifiers (unchanged) |
|---|---|---|
| Full-payment confirmation validity (affirmative, bound, not negative/ambiguous/unauthorized) | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | items 1–4 |
| Order-independence of confirmation/selection; dispatch gated on eligibility, not just presence | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | item 5 |
| Recalculation permitted; duplicate authorization/effects are not | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | item 6 |
| Document-selection scope (authorization names only what was selected) | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | item 7 |
| `AUTHORIZATION_SENT` ≠ physical delivery | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | item 8 |
| No-attachment sufficiency for bank-credit confirmation (FIN-DEC-14) | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | item 9 |
| Single-channel-success validity while the other channel is retried | "Approved Confirmation & Release Flow" → Proposed acceptance criteria | item 10 |
| Channel failure / bounded retry (FIN-DEC-17) | "Consolidated requirements and acceptance — FIN-DEC-17 through FIN-DEC-21" → Acceptance criteria table | `FIN-AC-17A`–`FIN-AC-17E` |
| Notification sent/delivered/read ≠ physical delivery (FIN-DEC-18) | same as above | `FIN-AC-18A` |
| Delivery-confirmation identity restricted to Rodrigo/Leonardo (FIN-DEC-19) | same as above | `FIN-AC-19A`–`FIN-AC-19B` |
| No-attachment sufficiency for delivery confirmation (FIN-DEC-20) | same as above | `FIN-AC-20A`–`FIN-AC-20B` |
| Per-document partial-delivery accumulation (FIN-DEC-21) | same as above | `FIN-AC-21A`–`FIN-AC-21D` |
| Gate blocks dispatch despite valid confirmation/selection | same as above | `FIN-AC-GATE` |

---

## Reconciliation with Approved Business Decisions (FIN-DEC-01–16)

*(For FIN-DEC-17–21's reconciliation and acceptance criteria, see "Consolidated requirements and acceptance — FIN-DEC-17 through FIN-DEC-21" below, or the "Acceptance Criteria Index" above.)*

**Status:** BUSINESS_DECISION reconciliation. Source: `FINANCEIRO_DECISIONS.md`, all decisions dated 2026-09-21, "Fonte: respostas explícitas do usuário nesta conversa." Every row below treats the decision as settled and asks only what it changes in this contract's RUNTIME_CODE-evidenced sections. No code, test, or integration was touched to produce this table.

| FIN-DEC | Approved requirement | Current code behavior (`src/agents/financeiro/`) | Reconciliation status |
|---|---|---|---|
| 01, 02 | Rodrigo or Leonardo confirms bank credit by querying the bank themselves; either one alone is sufficient, no dual confirmation | `bankCreditConfirmed` is caller-supplied, or resolved by `bankQuery.js`'s unconditional mock (`{confirmed: true}` for any valid-format SWIFT reference) | PENDING_IMPLEMENTATION — no code path reads a human confirmation source at all; the mock remains the sole producer |
| 03 | After a valid confirmation (and the other gate conditions), release proceeds automatically with no second human authorization | `releaseGate.canReleaseOriginalDocuments` already requires no second approval once its 3 inputs are true — structurally consistent | CURRENT_BEHAVIOR already matches this requirement's *shape*; it is only the evidentiary quality of `bankCreditConfirmed` (row above) that is not yet approved-grade |
| 04, 05, 06, 14 | Confirmation channel is the operation's WhatsApp group; agent posts FTR/invoice/amount/currency; Rodrigo or Leonardo replies to that message; no attachment required | No WhatsApp reference exists anywhere in this component or its dependencies (verified) | PENDING_IMPLEMENTATION — approved design, zero code |
| 07 | "Liberar" means sending an authorization to have someone deliver the physical originals — not proof of delivery itself | `release_flag: true` + `audit_id` is computed; no courier-notification code exists (pre-existing Implementation Gap #6) | Reinforces the existing gap; the approved definition confirms `release_flag`'s current scope ("authorization computed," not "delivery confirmed") was already correct, it just has no downstream action wired to it |
| 08, 09, 10 | A single authorization, sent via two channels (email **and** WhatsApp), reaches Rodrigo (rodrigo@francfort.co, +5511982344422) and Leonardo (finance@francfort.co, +5511982344411) — one authorization, not two independent ones | No email/WhatsApp send exists in `financeiro/index.js`; `alertService.js` (email only) is disconnected from it (pre-existing Implementation Gap #4) | PENDING_IMPLEMENTATION |
| 11, 12 | Partial payment may permit release; Rodrigo or Leonardo decides case-by-case, no automatic minimum threshold | `releaseGate.js` still requires the literal `paymentStatus === 'Received'` — no partial-payment branch exists in the gate | PENDING_IMPLEMENTATION — the approved requirement is not representable by today's binary gate; needs a reconciled partial-payment path (Open Decisions, item on `payment_tracking.status`) |
| 13 | Approved exact reply text for the partial case: **"Crédito confirmado. Autorizo liberar com saldo pendente."** | Not modeled anywhere — no field captures a partial-release decision distinct from `bankCreditConfirmed` | PENDING_IMPLEMENTATION |
| 15, 16 | Authorization covers only the originals Rodrigo or Leonardo selects in the same WhatsApp thread — not all originals by default | No document-selection field exists in the Input or Output Contract | PENDING_IMPLEMENTATION |

**Two distinct responsibilities, kept distinct (per this task's explicit instruction):** the human act (Rodrigo's or Leonardo's bank query and WhatsApp reply) is the *evidentiary* act — it produces a value. `releaseGate.canReleaseOriginalDocuments` remains the sole *computational* act — it decides `release_flag` from that value plus `invoiceStatus`/`paymentStatus`. FIN-DEC-01–16 approve what feeds the gate's `bankCreditConfirmed` input and, for partial cases, an additional release-with-balance decision; no FIN-DEC record transfers the gate's own computation to Rodrigo, Leonardo, or any WhatsApp reply, and none should be read as doing so.

---

## Approved Confirmation & Release Flow — Functional Specification (FIN-DEC-01–16)

*(For FIN-DEC-17–21's parallel functional detail — channel retry, physical delivery — see "Consolidated requirements and acceptance — FIN-DEC-17 through FIN-DEC-21" below, or the "Acceptance Criteria Index" above.)*

**Status:** NORMATIVE_TARGET / BUSINESS_DECISION. This section specifies the approved design end-to-end. It changes no RUNTIME_CODE fact recorded elsewhere in this contract, and nothing in it has been implemented, tested, or activated.

### Inputs (approved)

- `ftrCode` — same field as the existing Input Contract; correlates the confirmation to one FTR.
- FTR code, invoice reference, amount, currency — presented by the agent in the WhatsApp message (FIN-DEC-06). Partial-payment case adds: total invoice amount, amount received, remaining balance (FIN-DEC-13).
- Selected original documents — supplied by Rodrigo or Leonardo in the same thread (FIN-DEC-15/16); never inferred by the agent.
- WhatsApp reply text — full-payment case: no exact wording was made mandatory ("Nenhum texto exato de confirmação foi obrigatório nesta decisão," `FINANCEIRO_DECISIONS.md`). This is latitude on *phrasing*, not on *content*: the reply must still be an explicit, affirmative confirmation that the bank credit was consulted and confirmed (the substance of FIN-DEC-01/02). Partial-payment case: exact approved wording is **"Crédito confirmado. Autorizo liberar com saldo pendente."** (FIN-DEC-13) — no variant text is approved.
- Sender identity — the WhatsApp identity of whoever replies. Binding this to an authenticated Rodrigo/Leonardo identity is PENDING_IMPLEMENTATION (Implementation Gap #9); a display name alone is explicitly insufficient per the source decisions.

**Necessary but not sufficient (correction to the prior draft of this section):** an authorized sender replying, bound to the correct request, is a *necessary* condition for confirmation in both the full and partial cases — it is not *sufficient* on its own. A bound reply from Rodrigo or Leonardo that is a negative ("não confirmado", "ainda não verifiquei o banco"), a stated doubt/uncertainty, or textually ambiguous (e.g. a bare "ok" or "recebido") must **not** be treated as a confirmation. No exhaustive list of accepted or rejected phrasings has been approved for the full-payment case — only that the content must be an unambiguous affirmative confirmation; inventing a specific accepted-phrasing list beyond FIN-DEC-13's exact partial-case wording remains out of scope for this document.

### Proposed states (NORMATIVE_TARGET — none of these exist in code; they do not need to, and are not proposed to, replace `paymentStatusService.js`'s existing 9-value enum one-for-one)

Confirmation and document selection are two independent signals that may arrive **in either order** (correction to the prior draft, which incorrectly sequenced selection before confirmation). Authorization dispatch waits for both, regardless of which arrives first:

```
AWAITING_INPUTS         agent has posted the financial summary; neither a
                         valid credit confirmation nor a document selection
                         has been received yet
CONFIRMATION_RECEIVED   a valid, bound, affirmative confirmation arrived
                         (full or, per FIN-DEC-13 wording, partial) —
                         document selection not yet received
SELECTION_RECEIVED      a document selection arrived — valid confirmation
                         not yet received
READY_TO_AUTHORIZE      both inputs present; evaluate the reconciled gate.
                         Dispatch only on an eligible gate result.
AUTHORIZATION_SENT      a single authorization dispatched via two channels,
                         email and WhatsApp (FIN-DEC-08/09/10), to Rodrigo
                         and Leonardo — NOT proof of physical delivery
                         (FIN-DEC-07); delivery result is tracked per
                         recipient/channel, not as one pass/fail outcome
NOT_CONFIRMED           a reply arrived that does not establish confirmation:
                         unbound to the request, from an unauthorized
                         sender, an explicit negative, a stated doubt, or
                         textually ambiguous — must not auto-confirm, and
                         must be visibly recorded as a non-confirmation
                         rather than silently discarded (see Inputs above)
```

### Approved message wording (verbatim)

- Apresentação (caso integral): FTR, invoice, valor, moeda (FIN-DEC-06).
- Apresentação (caso parcial): FTR, invoice, moeda, total da invoice, valor recebido, saldo (FIN-DEC-13).
- Resposta aprovada (caso parcial, texto exato obrigatório): **"Crédito confirmado. Autorizo liberar com saldo pendente."**
- Resposta (caso integral): sem texto exato definido, mas deve ser uma confirmação afirmativa e inequívoca do crédito consultado no banco. Remetente autorizado e resposta vinculada à solicitação são necessários, mas não bastam isoladamente — negativas, dúvidas e mensagens ambíguas não confirmam o pagamento.

### Responsible parties

- **Rodrigo Francfort or Leonardo Francfort** — bank-credit confirmation, partial-payment release decision, document selection. Either one alone suffices at every step (FIN-DEC-02/12/16); no step approved so far requires both. Confirmation and selection may come from different messages, in either order, and even from different one of the two people.
- **FINANCEIRO component (`releaseGate.canReleaseOriginalDocuments`)** — remains the sole deterministic computer of `release_flag` from `invoiceStatus`, `paymentStatus`, `bankCreditConfirmed`. The approved human confirmation feeds `bankCreditConfirmed`; it does not replace or bypass the gate computation.
- **Authorization recipients** — Rodrigo and Leonardo, both reached by the same single authorization via two channels, email and WhatsApp (FIN-DEC-08/09/10); the same two people are both the confirming/authorizing parties and the notification recipients.

### Proposed acceptance criteria (none implemented or tested)

1. A valid, bound, affirmative confirmation from Rodrigo **or** Leonardo alone satisfies `bankCreditConfirmed`; no second approval is required (FIN-DEC-02/03).
2. A reply that is bound to the request and from an authorized sender, but is a negative, a stated doubt, or otherwise not an affirmative confirmation, must **not** satisfy `bankCreditConfirmed` — and must be recorded as a distinct non-confirmation outcome, not treated as equivalent to silence.
3. A textually ambiguous reply (e.g. a bare "ok", "recebido", or — for the partial case — a bare "confirmado" without the FIN-DEC-13 exact wording) must not be accepted as confirmation, full or partial.
4. A reply must match, jointly, on: authorized sender identity (Rodrigo or Leonardo), the correct operation, the correct pending request, and the correct request version — a reply from an unauthorized sender, or one bound to a different operation/request/version, must not confirm anything regardless of its text. This correlation requirement is specific to the confirmation/selection event; a delivery confirmation additionally requires matching the specific authorization id and naming only documents within that authorization's scope (see the Consolidated section's FIN-DEC-18–21 requirements below).
5. Document selection and credit confirmation may be received in either order; the system must wait for both before evaluating dispatch, and must not authorize on selection alone or confirmation alone. Presence of both signals is necessary but not sufficient: dispatch additionally requires the reconciled financial gate (`releaseGate`, extended for the partial-payment path) to return an eligible result — `READY_TO_AUTHORIZE` is readiness to evaluate, not permission to authorize.
6. A duplicate confirmation reply, or a duplicate document-selection message, for the same request may repeat the gate computation, but must not produce duplicate authorization effects or an expanded document scope.
7. A dispatched authorization names only the documents selected in that thread — no unselected original is included (FIN-DEC-15/16).
8. `AUTHORIZATION_SENT` is distinct from, and must never be conflated with, confirmed physical delivery (FIN-DEC-07).
9. Absence of an attached bank statement/proof does not block confirmation (FIN-DEC-14).
10. If the single authorization is delivered on one channel but fails on the other (e.g. WhatsApp delivered, email bounces), the authorization itself is still considered sent — but the per-channel/per-recipient failure must be recorded, surfaced, and not silently dropped or treated as if the whole authorization failed.

### Pendências — decisões de negócio ainda em aberto (não são pendências técnicas)

- **Política de retenção** da mensagem de confirmação e seus metadados — FIN-DEC-14 aprova a dispensa do comprovante bancário anexado, mas deixa a retenção explicitamente "a definir."
- **Entrega física — decisão resolvida:** FIN-DEC-18 a 21 estabelecem confirmação no grupo por Rodrigo ou Leonardo, mensagem suficiente sem anexo e registro por documento. Formato textual e identificação/versionamento permanecem pendentes.
- **Tratamento de alteração de valor, moeda ou objeto** após a solicitação já ter sido enviada (invalidar e reiniciar vs. pedir reconfirmação) — política de negócio ainda não definida pelo usuário.

### Pendências — implementação técnica (a decisão de negócio já existe; falta construir)

- Integração WhatsApp: identificador do grupo, provedor, envio/recepção e vínculo de resposta à mensagem original — disponibilidade técnica não verificada.
- Vínculo de identidade autenticada de Rodrigo/Leonardo a um número de WhatsApp (nome de exibição não basta).
- Classificação técnica de uma resposta como afirmativa/negativa/ambígua — quem faz essa interpretação e com que confiabilidade não está definido em código.
- Reconciliar o gate literal `paymentStatus === 'Received'` de `releaseGate.js` com o caminho de pagamento parcial já aprovado (FIN-DEC-11/12) — nenhuma branch existe hoje.
- Modelo de dados para "documentos selecionados," versionado contra a solicitação e preservado na auditoria.
- Mecanismo de coordenação que aguarda os dois sinais (confirmação e seleção) em qualquer ordem antes de autorizar, sem timeout ou política de expiração definidos.
- Identificador único de autorização compartilhado entre os dois canais, com resultado de entrega registrado por destinatário/canal e sem essa entrega parcial ser interpretada como duas autorizações.
- Onde este fluxo é implementado — dentro de FINANCEIRO, dentro de COMUNICACAO, ou coordenado pelo orquestrador — ver proposta técnica abaixo; não decidido.

### Proposta técnica de divisão de responsabilidades (PROPOSTA — não é decisão de negócio, não aprovada, não implementada)

Esta subseção é uma proposta de engenharia para organizar as pendências técnicas acima; nenhuma parte dela foi aprovada pelo usuário nem decide algo que as FIN-DEC deixaram em aberto.

- **COMUNICACAO** (hoje `AUTHORITATIVE` para normalização de mensagens, per `P0_AUTHORITY_MATRIX.md`) — postar a mensagem de apresentação (FTR/invoice/valor/moeda, ou o conjunto parcial de FIN-DEC-13); receber respostas do grupo de WhatsApp; vincular cada resposta à mensagem original; capturar a identidade do remetente; classificar a resposta em termos de mensagem (confirmação/seleção/negativa/ambígua) como uma extensão do seu papel existente de normalização — sem, porém, decidir se essa classificação satisfaz o gate financeiro.
- **FINANCEIRO** — interpretar o evento estruturado que COMUNICACAO produz em termos de negócio: validar se uma "confirmação" classificada está vinculada à versão correta da solicitação, aplicar `releaseGate.canReleaseOriginalDocuments` (com a branch de parcial reconciliada), computar `release_flag`, e registrar a auditoria. FINANCEIRO não parsearia mensagens de WhatsApp diretamente — continuaria recebendo `bankCreditConfirmed` e os demais campos do gate como hoje, agora providos por um evento em vez de um valor simulado.
- **Orquestrador** (motor durável ADR-001A / `master.js`) — coordenar a espera pelos dois sinais independentes (confirmação e seleção) em qualquer ordem, invocar FINANCEIRO quando confirmação e seleção estiverem disponíveis e, somente com resultado elegível do gate reconciliado, sequenciar o disparo da autorização única nos dois canais, registrando o resultado por destinatário/canal. Esse é exatamente o tipo de espera/correlação que `master.route()` hoje não implementa (ver `DOCUMENTATION_PLAN.md`, item 1 das dependências transversais).

Esta divisão é uma proposta técnica para discussão; não resolve o Open Decision já registrado sobre se o fluxo pertence a FINANCEIRO ou COMUNICACAO — ela propõe que a resposta seja "nenhum dos dois sozinho," mas isso ainda depende de validação de negócio e arquitetura antes de virar decisão.

---

## Consolidated requirements and acceptance — FIN-DEC-17 through FIN-DEC-21

**Status:** approved business requirements from FINANCEIRO_DECISIONS.md; implementation and acceptance execution remain pending. This section complements FIN-DEC-01 through FIN-DEC-16 without changing the frozen PoC results. *(For the FIN-DEC-01–16 reconciliation and functional specification, see "Reconciliation with Approved Business Decisions" and "Approved Confirmation & Release Flow" above, or the "Acceptance Criteria Index" earlier in this document.)*

### Approved requirements

| Decision | Contract requirement | Implementation status |
|---|---|---|
| FIN-DEC-17 | An eligible authorization remains valid through the successful channel when email or WhatsApp fails. Retry the failed channel with the same authorization, content and document scope. | PENDING_IMPLEMENTATION |
| FIN-DEC-18 | Physical delivery is confirmed in the operation's WhatsApp group, separately from credit confirmation and authorization notification. | PENDING_IMPLEMENTATION |
| FIN-DEC-19 | Only Rodrigo or Leonardo may confirm physical delivery; either alone suffices. | PENDING_IMPLEMENTATION |
| FIN-DEC-20 | Their valid delivery-confirmation message is sufficient; no receipt or attachment is mandatory. | PENDING_IMPLEMENTATION |
| FIN-DEC-21 | Record the delivered subset individually and keep the other authorized documents pending. Accumulate subsequent valid confirmations. | PENDING_IMPLEMENTATION |

Both Rodrigo and Leonardo remain notification recipients. FIN-DEC-17 does not decide whether receipt by only one person suffices when the other receives nothing on either channel. Record outcomes per recipient/channel; do not mark failed or uncertain destinations as successful. Reconcile uncertain effects before retrying. Retry limits, intervals and exhaustion handling remain to be specified; unlimited retries are not approved.

### Proposed tracking model — not implemented

Maintain separate dimensions for financial eligibility, authorization notification and physical delivery. Having confirmation and document selection makes the request ready for gate evaluation, not automatically eligible. Dispatch only after the applicable reconciled gate returns an eligible result; a partial-payment case still requires its explicit approved decision.

Use one authorization identity across channels and retries. Keep each destination/channel's outcome and attempt history. A delivered or read notification is not physical delivery.

For each authorized original, preserve its identifier/version and delivery confirmation: source message, authenticated sender, group, timestamp, operation and authorization linkage. Proposed document states are PENDING_DELIVERY and DELIVERY_CONFIRMED; these are design labels, not runtime enums. `ORQUESTRADOR.md`'s proposed workflow-level states `AWAITING_DELIVERY_CONFIRMATION`/`PARTIALLY_DELIVERED`/`FULLY_DELIVERED` are the aggregate computed purely from this same per-document pair — they introduce no separate per-document data model of their own. Pending documents equal the authorized set minus the set with valid delivery confirmations. The aggregate is complete only when all authorized documents are confirmed.

Accept delivery evidence only from Rodrigo or Leonardo in the operation group. A display name is not identity verification. Ambiguous or unlinked messages require clarification; do not infer delivery of all originals. Unknown documents do not expand authorization. Repeated calculations are allowed; duplicate messages must not duplicate records or external effects. Physical delivery does not settle an outstanding financial balance.

### Acceptance criteria — specified, not executed

| ID | Scenario | Required result |
|---|---|---|
| FIN-AC-17A | WhatsApp succeeds; email fails for an intended recipient. | Authorization remains valid through WhatsApp; record email failure and retry only the failed destination/channel with the same authorization. |
| FIN-AC-17B | Email succeeds; WhatsApp fails. | Equivalent result, preserving email success and pending WhatsApp retry. |
| FIN-AC-17C | Both channels fail, or provider outcome is uncertain. | No successful delivery is fabricated; preserve failures, reconcile uncertainty, and retry under a bounded policy whose parameters (interval, max attempts, escalation after exhaustion) remain unspecified — see "Remaining decisions and engineering work" below. |
| FIN-AC-17D | Retry or duplicate confirmation occurs. | Same authorization identity, content and selected documents; no second authorization or intentional resend to a successful destination. |
| FIN-AC-17E | One recipient receives nothing on either channel. | Keep that recipient's failure visible; do not infer that the other recipient's receipt fulfills the unresolved recipient-coverage policy. |
| FIN-AC-18A | Provider reports authorization sent, delivered or read. | No original is marked physically delivered. |
| FIN-AC-19A | Rodrigo or Leonardo provides a valid, scoped delivery confirmation in the group. | Accept either alone; no second approver is required. |
| FIN-AC-19B | Another participant confirms, or identity/group/linkage is invalid. | Do not register an authorized physical delivery. |
| FIN-AC-20A | Valid delivery confirmation has no attachment. | Accept the message; do not require a receipt. Preserve message and metadata. |
| FIN-AC-20B | Delivery message is ambiguous or cannot identify the authorization/documents. | Keep unresolved documents pending and request clarification. |
| FIN-AC-21A | Authorized set is BL, CO and Phyto; valid confirmation identifies only BL. | BL delivered; CO and Phyto pending. |
| FIN-AC-21B | Later valid confirmations identify CO, then Phyto. | Accumulate confirmations; complete the set only after Phyto, preserving prior evidence and the financial balance. |
| FIN-AC-21C | BL confirmation is repeated. | No duplicate delivery and no reopening of already delivered documents. |
| FIN-AC-21D | Confirmation names an unauthorized document. | Do not expand scope or mark it as delivered under this authorization; seek clarification. |
| FIN-AC-GATE | Confirmation and selection exist but another applicable gate condition fails. | Do not dispatch authorization; record the blocking condition. |

### Remaining decisions and engineering work

The channel, authorized people, no-attachment rule and partial-delivery treatment are settled by FIN-DEC-18 through FIN-DEC-21. Remaining business questions include retention, changed/revoked authorizations or evidence, and recipient coverage when one recipient receives nothing. Exact delivery wording and precise document identification/versioning remain unspecified.

Engineering still needs authenticated group integration, correlation to request/payment/document versions, individual delivery records, persistence ownership, deduplication, per-recipient/channel delivery outcomes, bounded retries and uncertain-outcome reconciliation. The proposed COMUNICACAO/FINANCEIRO/orchestrator split remains a proposal; master.route does not implement durable coordination.

---

## Evidence Index

| Claim | File | Symbol/Lines | Type |
|---|---|---|---|
| Release gate 3-condition rule | `src/agents/financeiro/releaseGate.js` | 2-4 | RUNTIME_CODE |
| Release gate rule (corroborating) | `docs/ROADMAP.md` | 253-259 | ROADMAP |
| Release gate rule (corroborating) | `docs/PAGAMENTOS_TRACKING.md` | 59-68 | ARCHITECTURE_DOCUMENTATION |
| Bank query is a mock | `src/agents/financeiro/bankQuery.js` | 1-7 | RUNTIME_CODE |
| SWIFT format regex | `src/agents/financeiro/swiftValidation.js` | 3 | RUNTIME_CODE |
| Payment status precedence | `src/agents/financeiro/paymentStatusService.js` | 41-85 | RUNTIME_CODE |
| Payment status enum matches DB CHECK | `supabase/migrations/0002_payment_tracking.sql` | 28-32 | CONFIGURATION |
| Payments table English enum | `config/schemas.json` | Payment.payment_status | CONFIGURATION |
| Text signals are never confirmation | `src/agents/financeiro/paymentSignals.js` | 1-6, 26-31 | RUNTIME_CODE |
| Early-payment flag | `src/agents/financeiro/reconciliation.js` | 1-8 | RUNTIME_CODE |
| Alert dedup/suppression | `src/agents/financeiro/alertService.js` | 37-42 | RUNTIME_CODE |
| Internal-only alerting | `src/agents/financeiro/alertService.js` | 1-5 | RUNTIME_CODE |
| Internal-only alerting (corroborating) | `docs/PAGAMENTOS_TRACKING.md` | 49 | ARCHITECTURE_DOCUMENTATION |
| Full process() flow | `src/agents/financeiro/index.js` | 1-79 | RUNTIME_CODE |
| No HTTP route exists | `src/routes/index.js` | (absence, full-file review) | RUNTIME_CODE |
| Generic override mechanism | `src/agents/excecoes/index.js` | 10-15 | RUNTIME_CODE |
| No LLM in financeiro/ | repo-wide search | `anthropic\|openai\|gpt-\|claude-` in `src/agents/financeiro/` — 0 matches | RUNTIME_CODE |
| Approved confirmation/release/delivery flow, FIN-DEC-01 through FIN-DEC-21 | `docs/contracts/FINANCEIRO_DECISIONS.md` | full document, dated 2026-09-21 | BUSINESS_DECISION |
