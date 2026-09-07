# FINANCEIRO — Normative Component Contract

**Status:** Normative contract, hardened from repository evidence. This is a P0 contract — FINANCEIRO gates the release of original shipping documents, the single highest-stakes deterministic decision in the system.
**Evidence precedence used:** RUNTIME_CODE > TEST > CONFIGURATION > ARCHITECTURE_DOCUMENTATION > PRD > ROADMAP. Where the task's suggested state progression is not yet established in the repository, it is labeled `NORMATIVE_TARGET`, not treated as current fact.

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
- **IMPLEMENTATION_GAP — the gate's evidentiary basis is currently a mock, not real bank confirmation.** `bankQuery.js:5-7` (`queryBankCreditConfirmation`) unconditionally returns `{confirmed: true, ...}` for **any** syntactically valid SWIFT reference — it performs no actual bank API call (its own comment states this explicitly: *"no real bank API integration exists yet; this simulates confirmation for any syntactically valid SWIFT reference"*). Consequence: today, in the runtime as it exists, supplying any string matching the SWIFT regex and leaving `bankCreditConfirmed` unset will cause `bankCreditConfirmed` to resolve to `true` unconditionally. The invariant "no release without financial gate" is currently a **structural** guarantee (the code path is always consulted) but **not an evidentiary** one (the consulted source is a stub that always says yes). This is the single most important finding in this contract and must not be silently smoothed over.
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
  - Whether to actually release documents to a courier — release_flag is
    computed but no verified code acts on it (see Output Contract)

LLM: NO AUTHORITY (zero LLM anywhere in src/, confirmed repo-wide)
```

**Human override:** `src/agents/excecoes/index.js`'s generic `action: 'override'` branch (`excecoes/index.js:10-15`) writes an audited override record for **any** `ftrCode`/`approvedBy` pair — but this is a shared, cross-agent mechanism, not FINANCEIRO-specific, and **no verified code path connects an EXCECOES override to `canReleaseOriginalDocuments`'s three-condition gate**. **OPEN_DECISION:** whether a Rodrigo override is intended to bypass the release gate, and if so how, is not established in any document or code path found.

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

## Open Decisions

- Is `SWIFT_REFERENCE_REGEX` meant to validate a real BIC/SWIFT code, or an internal reference convention? Format doesn't match ISO 9362.
- Should `payment_tracking.status` ever influence `release_flag`, or are they deliberately independent?
- Is EXCECOES's generic manual override intended to ever bypass `canReleaseOriginalDocuments`, and if so, through what mechanism?
- Who/what is responsible for eventually replacing the bank-query mock with a real integration, and what does "real evidence" mean operationally (bank statement parsing? bank API? manual confirmation by a human with audit trail)?

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
