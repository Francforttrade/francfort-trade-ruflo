# MONITOR — Normative Component Contract

**Status:** Normative contract, hardened from repository evidence. P0 — the six-KPI producer gap must be explicit, not silently treated as implemented.

---

## Identity

- **Name:** MONITOR
- **Architectural classification:** `MONITOR = ANALYTICS / OBSERVABILITY SERVICE` — Integration/Analytics Service, not a sequential business-decision stage.
- **Domain responsibility:** Aggregate KPI calculation, SLA-threshold alerting, dashboard export.
- **Lifecycle role:** Sits **outside the FTR business sequence** (per this task's own framing and the baseline document). It is one of only two components exempt from the FTR mutex gate — `master.js`'s `AGENTS_WITHOUT_FTR_GATE = new Set(['comunicacao', 'monitor'])` (`master.js:66`) — because it aggregates *across* FTRs, it has no single FTR to gate on.

---

## Invocation

- **Entry conditions:** `master.route({targetAgent: 'monitor', ...})`, no FTR-code requirement (exempt from gate). **Live HTTP route exists:** `POST /digest` (`src/routes/index.js:10-17`).
- **Allowed actions/commands:** none — single unconditional code path (`monitor/index.js:7-35`).
- **Required context:** none enforced by code.
- **Optional context:** `paymentsOnTime`, `paymentsTotal`, `docsOnTime`, `docsTotal`, `agentErrors`, `agentCalls` — all six are read directly off `context` with no default beyond `calculatePercentage`'s own `null`-if-falsy-denominator guard (`slaCalculations.js:10-15`).

---

## Input Contract

| Field | Type | Required/Optional | Source | Validation | Semantic meaning |
|---|---|---|---|---|---|
| `paymentsOnTime` | number | optional | caller — **no verified producer** | none | Numerator for payment SLA % |
| `paymentsTotal` | number | optional | caller — **no verified producer** | none | Denominator for payment SLA % |
| `docsOnTime` | number | optional | caller — **no verified producer** | none | Numerator for documentation SLA % |
| `docsTotal` | number | optional | caller — **no verified producer** | none | Denominator for documentation SLA % |
| `agentErrors` | number | optional | caller — **no verified producer** | none | Numerator for agent error rate % |
| `agentCalls` | number | optional | caller — **no verified producer** | none | Denominator for agent error rate % |

**For every one of these six fields:**
```
CURRENT PRODUCER: NOT VERIFIED
STATUS: IMPLEMENTATION_GAP
```
`POST /digest`'s handler forwards `req.body` verbatim (`src/routes/index.js:10-17`: `master.route({...req.body, targetAgent: 'monitor'})`) — no transformation populates any of the six fields. A repository-wide search for each field name outside `src/agents/monitor/` finds no producer. These fields are **accepted, not produced** — their presence in `context` depends entirely on an external caller (of `POST /digest`) supplying them, and no such caller is verified to exist in this repository.

---

## Output Contract

| Field | Type | Guaranteed/Conditional | Semantic meaning | Downstream consumer |
|---|---|---|---|---|
| `agent` | `'monitor'` | guaranteed | identity | none verified |
| `dashboard.generated_at` | ISO timestamp | guaranteed | — | none |
| `dashboard.ftrs_in_analysis` | number | guaranteed | Live Supabase count — **the one KPI family with a real producer** | none |
| `dashboard.finalized_last_7_days` | `{count, revenue_usd}` | guaranteed | Live Supabase aggregate — **real producer** | none |
| `dashboard.avg_cycle_days` | number or `null` | guaranteed | Live Supabase aggregate — **real producer** (`null` if no finalized FTRs exist yet) | none |
| `dashboard.payment_sla_pct` | number or `null` | guaranteed | `null` whenever `paymentsTotal` is falsy — **in current practice, always `null`, since no producer supplies it** | none |
| `dashboard.documentation_sla_pct` | number or `null` | guaranteed | same gap as above | none |
| `dashboard.agent_error_rate_pct` | number or `null` | guaranteed | same gap as above | none |
| `dashboard.alerts.payment_sla_at_risk` | boolean | guaranteed | `needsPaymentSlaAlert(paymentSlaPct)` — **always `false` in current practice**, since `null < 85` is `false` in JS, and the guard `paymentSlaPct != null` (`slaCalculations.js:18`) additionally short-circuits it | none |
| `dashboard.alerts.agent_error_rate_high` | boolean | guaranteed | same gap as above | none |

No downstream component reads this output — confirmed by repo-wide search: no `require('../monitor')` importing `index.js` exists anywhere. `docs/ROADMAP.md:329-332` describes an intended "TRACKING 2026 (aba KPI)" render target — no corresponding code exists.

---

## Business Rules

1. **SLA targets/thresholds (`slaCalculations.js:1-8`, corroborated by `docs/ROADMAP.md:317-333`):** payment SLA target 95% (alert if < 85%), documentation SLA target 98%, agent error rate alert if > 5%.
2. **Percentage calculation (`slaCalculations.js:10-15`):** `numerator/denominator * 100`, or `null` if denominator is falsy (0, `null`, `undefined`).
3. **KPI aggregation (`kpiQueries.js:6-46`):** `countFtrsInAnalysis` (Supabase `ftr` where `status = 'Em análise'`), `getFinalizedFtrsLast7Days` (`ftr` where `status = 'Final'` and `updated_at >= now-7d`, summed `total_value_usd`), `getAverageCycleDays` (`ftr` where `status = 'Final'`, mean of `updated_at - created_at` in days).

**Distinguishing the three telemetry classes (per this task's requirement):**

```
BUSINESS KPI:
  ftrs_in_analysis, finalized_last_7_days, avg_cycle_days,
  payment_sla_pct, documentation_sla_pct
  — MONITOR is the correct, and currently only, owner of these
    computations (kpiQueries.js's Supabase aggregates) where a producer
    exists at all.

WORKFLOW ENGINE TELEMETRY:
  agent_error_rate_pct / agentErrors / agentCalls, as currently named,
  conflates "business agent produced a domain error" with what a future
  durable workflow engine would call "activity/step failure telemetry."
  MONITOR is NOT automatically the authoritative owner of workflow-engine-
  level telemetry (retries, timeouts, worker health) — that is properly
  the orchestration engine's own observability surface (per ADR-001A),
  distinct from a business KPI. This distinction did not previously exist
  in any repository document; it is introduced here as a target
  clarification, not a description of current code (which does not
  distinguish the two at all).

BUSINESS AUDIT:
  release_documents, override, amendment entries in Firestore AUDIT_LOG
  (written by FINANCEIRO/CONTRATOS/EXCECOES) are a separate concern from
  both of the above — MONITOR does not read, aggregate, or expose
  AUDIT_LOG data in any form (repo-wide check: no COLLECTIONS.AUDIT_LOG
  reference anywhere in src/agents/monitor/).
```
**MONITOR is not automatically authoritative for all three** — per this task's instruction, recorded explicitly: MONITOR today only touches the first class (business KPI), and only 3 of its 5 members have a real producer.

---

## Invariants

- `dashboard.alerts.*` booleans are internally consistent with their corresponding `*_pct` values (both computed by the same pure `slaCalculations` functions from the same inputs) — but this consistency is vacuous today, since the inputs are always absent.
- No invariant found or enforced preventing `POST /digest` from being called with fabricated values for the six ungoverned fields — nothing validates them against any real source.

---

## Authority Boundary

```
MAY_DECIDE:
  - dashboard.alerts.* (deterministic threshold comparison, given real inputs)

MAY_RECOMMEND:
  none identified beyond the alert booleans themselves

MAY_RECORD:
  none — monitor/index.js performs no persistence write of its own

MAY_NOT_DECIDE:
  - Where paymentsOnTime/paymentsTotal/docsOnTime/docsTotal/agentErrors/
    agentCalls come from — MONITOR has no authority over, and no visibility
    into, whatever process would need to exist to produce them

LLM: NO AUTHORITY
```

---

## Side Effects

`logger.warn` only, on SLA-at-risk and error-rate-high conditions (`monitor/index.js:27-32`) — and only when the underlying percentage is non-null, which in current practice for 3 of the 6 KPI fields never occurs. No Firestore/Supabase write, no email, no calendar.

---

## Persistence

- **Reads:** Supabase `ftr` table, 3 queries (`kpiQueries.js:6,18,32`) — the only real I/O this component performs.
- **Writes:** none.
- **Current store:** Supabase, read-only, for the 3 real KPI families.
- **Authoritative ownership:** N/A for reads of `ftr` (Supabase already owns this per the baseline document); `DEFERRED_TO_ADR_007` is not applicable here since no MONITOR-owned data is at stake — the open question is entirely about **missing producers**, not persistence ownership, and is tracked separately below.

---

## Dependencies

- `kpiQueries.js`, `slaCalculations.js`, `dashboard.js` — sibling modules.
- `src/services/supabase.js` (via `kpiQueries.js`).
- No dependency on any other agent's module or `process()`.

---

## Error Model

None. `kpiQueries.js`'s three functions each `throw error` on a Supabase query failure (`kpiQueries.js:9,21,35`) with no catch in `monitor/index.js` — an unhandled promise rejection would propagate out of `process()` entirely on a Supabase outage. **No typed/domain error exists; this is a bare re-throw of whatever the Supabase client returns.**

---

## Retry Semantics

```
RETRYABLE:       UNKNOWN — no retry/backoff wiring exists; a Supabase query
                 failure is a bare, unhandled throw (see Error Model)
NON_RETRYABLE:   not established
REQUIRES_REVIEW: not established
UNKNOWN:         everything else
```

---

## Idempotency

Trivially idempotent for reads (no mutation performed). Calling `process()` repeatedly is safe and produces a fresh snapshot each time — there is no "duplicate processing" concept applicable to a read-only aggregator.

---

## Human Review / Approval

None. This component is purely observational.

---

## Security / Permissions

Not documented, not implemented beyond the shared webhook-secret gate on `POST /digest` (same mechanism as every route in `src/routes/index.js`, not MONITOR-specific — see COMUNICACAO.md for that control's detail).

---

## Audit / Observability

MONITOR is itself meant to be the system's observability surface (per its own domain responsibility) but is not currently the *subject* of any observability — no metric tracks MONITOR's own call latency, failure rate, or the staleness of its Supabase queries.

---

## Workflow Boundary

- **Valid predecessor/event:** per `docs/ROADMAP.md:20` — "All agents, KPI data, SLA tracking," intended to run hourly. Not code-enforced (no scheduler/cron exists in this repository for `POST /digest` — it is purely request-driven).
- **Successful exit:** N/A — this component does not gate anything; every call succeeds unless the Supabase query itself throws.
- **Failure exit:** unhandled Supabase-query exception (see Error Model).
- **Wait/review state:** N/A.
- **Downstream capability:** `docs/ROADMAP.md:326-327` describes emailing Rodrigo on SLA-at-risk — no corresponding code exists; only a `logger.warn` call.

---

## ADR-001A Minimum Adapter Contract

```
invoke('monitor', 'get_dashboard', context)
  → success:            { dashboard: {ftrs_in_analysis, finalized_last_7_days,
                           avg_cycle_days, payment_sla_pct, documentation_sla_pct,
                           agent_error_rate_pct, alerts} }
  → deterministic_gate:  N/A — MONITOR never gates anything
  → retryable_failure:   a Supabase query failure — currently an unhandled
                          throw; an adapter should treat this as retryable
                          (a transient DB read failure), pending a real
                          error-classification decision
  → permanent_failure:   not established
  → review_required:     N/A
  → correlation:         none — this component has no FTR-scoped identity at
                          all (it is explicitly FTR-gate-exempt)
```
**Per this task's instruction, MONITOR sits OUTSIDE the ADR-001A business sequence** (consistent with `docs/adr/ADR-001A-durable-workflow-engine.md`'s adapter diagram) — this adapter contract is recorded for completeness, not because MONITOR is expected to be wired into the durable FTR workflow itself.

---

## Current Implementation Mapping

No task-suggested target state progression was specified for MONITOR (unlike FINANCEIRO). This contract instead records, per the task's explicit instruction, that the six-KPI producer gap must not be described as operationally complete — done above in Input Contract and Business Rules.

## Implementation Gaps

1. `paymentsOnTime`/`paymentsTotal`/`docsOnTime`/`docsTotal`/`agentErrors`/`agentCalls` have no verified producer anywhere in the repository. `MONITOR-KPI-PRODUCER-GAP` (first raised in the prior documentation-coverage audit) is reaffirmed here as the component's primary implementation gap.
2. `kpiQueries.js` has no test file (`kpiQueries.test.js` does not exist, unlike `dashboard.test.js`/`index.test.js`/`slaCalculations.test.js`) — the one module doing live external I/O is the one module without test coverage.
3. Supabase query failures propagate as unhandled exceptions, with no typed error, no retry, no escalation to EXCECOES.
4. `docs/ROADMAP.md`'s intended TRACKING-2026-sheet render and Rodrigo email alert have no corresponding code.

## Open Decisions

- Who/what is responsible for computing and supplying the three missing KPI numerator/denominator pairs, and on what cadence?
- Should "agent error rate" be redefined to mean workflow-engine telemetry (once ADR-001A's engine exists) rather than a business KPI, per the three-way distinction above? `TBD` pending ADR-001A's outcome.
- Should MONITOR gain a scheduled trigger (cron/Cloud Scheduler) instead of remaining purely request-driven?

---

## Evidence Index

| Claim | File | Symbol/Lines | Type |
|---|---|---|---|
| FTR-gate exemption | `src/orchestrator/master.js` | 66 | RUNTIME_CODE |
| Live HTTP route | `src/routes/index.js` | 10-17 | RUNTIME_CODE |
| Six input fields, no producer | `src/agents/monitor/index.js` | 14-16 | RUNTIME_CODE |
| Three real KPI producers | `src/agents/monitor/kpiQueries.js` | 6,18,32 | RUNTIME_CODE |
| SLA thresholds | `src/agents/monitor/slaCalculations.js` | 1-8 | RUNTIME_CODE |
| SLA thresholds (corroborating) | `docs/ROADMAP.md` | 317-333 | ROADMAP |
| Dashboard shape | `src/agents/monitor/dashboard.js` | 4-18 | RUNTIME_CODE |
| No producer exists (absence) | repo-wide search for the 6 field names outside `monitor/` | — | RUNTIME_CODE |
| `kpiQueries.js` untested (absence) | directory listing of `src/agents/monitor/` | no `kpiQueries.test.js` | TEST (absence) |
| Bare re-throw on Supabase failure | `src/agents/monitor/kpiQueries.js` | 9,21,35 | RUNTIME_CODE |
