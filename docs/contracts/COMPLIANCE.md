# COMPLIANCE — Normative Component Contract

**Status:** Normative contract, hardened from repository evidence. P0 — regulatory-authority component; its threshold ownership relative to QUALIDADE must be unambiguous.

---

## Identity

- **Name:** COMPLIANCE
- **Architectural classification:** Domain Service / Rule Engine (deterministic; zero LLM — confirmed, no `anthropic|openai|gpt-|claude-` match in `src/agents/compliance/`).
- **Domain responsibility:** `COMPLIANCE = REGULATORY RULE/GATE AUTHORITY`. Owns the market-requirements ruleset (required documents + aflatoxin limit per destination market), evaluates a supplied lab result against that ruleset, tracks document-expiry alerts.
- **Lifecycle role:** Sequential FTR lifecycle stage (`test/integration/ftr-end-to-end.test.js:95`, `targetAgent: 'compliance'`), FTR-gated like all non-transversal agents.

---

## Invocation

- **Entry conditions:** `master.route({targetAgent: 'compliance', ftrCode, market, ...})`. **No live HTTP route** — absent from `src/routes/index.js`'s 6 routes (RUNTIME_CODE, absence verified). Reachable only via direct `master.route()`.
- **Allowed actions/commands:** None — single unconditional code path in `process(context)` (`compliance/index.js:8-51`).
- **Required context:** `market` — every downstream call (`getAflatoxinLimitPpb`, `buildComplianceChecklist`) is keyed on it; an unrecognized market throws (see Error Model). CODE_ONLY (no doc states this is required).
- **Optional context:** `labResultPpb`, `presentDocuments`, `expiryDates` — each has a `?? null` / `|| {}` fallback (`compliance/index.js:9,14,18,20`).

---

## Input Contract

| Field | Type | Required/Optional | Source | Validation | Semantic meaning |
|---|---|---|---|---|---|
| `ftrCode` | string | required (orchestrator gate) | caller | non-empty only | FTR under evaluation |
| `market` | string | **required by this component**, one of `Egypt`/`Algeria`/`Russia` only | caller — presumably `ftr.market`/`config/schemas.json` Compliance.market enum | **Only 3 of the 7 markets in `config/schemas.json`'s `Compliance.market` enum are recognized** (`Egypt, Algeria, Russia, Ukraine, Poland, South Africa, Tunisia` in schema vs. `Egypt, Algeria, Russia` in `marketRequirements.js:8-12`) — see Implementation Gaps | Selects the applicable ruleset |
| `labResultPpb` | number or null | optional | caller (presumably QUALIDADE's parsed result, though no verified wiring connects them — see Dependencies) | none | Compared against the market's aflatoxin limit |
| `presentDocuments` | object (map of document-name → boolean) | optional, default `{}` | caller | none | Checklist input |
| `expiryDates` | object (map of document-name → ISO date string) | optional, default `{}` | caller | none | Alert-calendar input |

---

## Output Contract

| Field | Type | Guaranteed/Conditional | Semantic meaning | Downstream consumer |
|---|---|---|---|---|
| `agent` | `'compliance'` | guaranteed | identity tag | none verified |
| `ftr_code` | string or undefined | guaranteed (echo) | — | none verified |
| `market` | string | guaranteed (echo) | — | none verified |
| `aflatoxin_check` | `{limit_ppb, result_ppb, within_limit}` | guaranteed | `within_limit` is **tri-state**: `true`/`false`/`null` (null when either input is missing — `aflatoxinCheck.js:1-6`) | none verified |
| `checklist` | `{market, items: [{document, present}], complete}` | guaranteed **only if `market` is recognized** — throws otherwise (see Error Model) | Required-document gate result | none verified |
| `alerts` | array of `{document, days_until_expiry, needs_alert}` | guaranteed (empty array if `expiryDates` empty) | Expiry-alert list | none verified |

**No downstream component is verified to read any field of this output** — confirmed by repo-wide search: no `require('../compliance')` importing `index.js`'s `process` exists anywhere (only sibling *modules* — `marketRequirements.js`, `aflatoxinCheck.js` — are imported directly by `qualidade/index.js` and `digitalizacao/crossValidation.js`, never the agent's `process()` itself).

---

## Business Rules

1. **Per-market ruleset (RUNTIME_CODE, `marketRequirements.js:8-12`; corroborated by `docs/ROADMAP.md:211-220`):**
   - Egypt: aflatoxin ≤ 2 ppb, requires ACID.
   - Algeria: aflatoxin ≤ 5 ppb, requires Import Permit.
   - Russia: aflatoxin ≤ 5 ppb, requires Phyto + Certificate.
2. **Aflatoxin pass/fail (`aflatoxinCheck.js:1-6`):** `labResultPpb <= limitPpb` → pass; either input missing → `null` (neither pass nor fail — an **unresolved** state, not an implicit pass).
3. **Checklist completeness (`checklist.js:10-15`):** complete only if every required document for the market is marked present in `presentDocuments`.
4. **Expiry alert window (`alerts.js:1-13`; corroborated by `docs/ROADMAP.md:224-230`):** alert fires when `0 <= days_until_expiry <= 7`.
5. **`FROZEN` per this task: LLM OUTPUT MAY NOT OVERRIDE OBJECTIVE REGULATORY RULES.** Trivially true today (zero LLM in this component or anywhere in the repository) — recorded as an explicit invariant for when/if a future LLM stage is added (per `docs/RDIA_PRD.md` §17's roadmap for `digitalizacao`, the only place LLM use is even discussed), so this component's aflatoxin/checklist gates are never overridable by a model's output.

---

## Invariants

- `getAflatoxinLimitPpb`/`getMarketRequirements` return `null` for any market not in the 3-entry table — this null then flows into `isAflatoxinWithinLimit` (also returns `null`) but **into `buildComplianceChecklist`, which throws** (`checklist.js:7`: `throw new Error(`Mercado de compliance desconhecido: ${market}`)`) — an **inconsistent failure mode within the same `process()` call**: the aflatoxin half degrades gracefully to `null`, the checklist half throws an uncaught exception. **IMPLEMENTATION_GAP.**
- `compliance/index.js` does not catch this exception — a call with `market: 'Ukraine'` (a market present in `config/schemas.json`'s own enum) will throw out of `process()` entirely, with no `try/catch`, no `needs_review` flag, no escalation to EXCECOES. This is a genuine crash path, not a graceful degradation, for 4 of the 7 documented markets.
- **REGULATORY THRESHOLD SOURCE OF TRUTH = COMPLIANCE / SHARED MARKET REQUIREMENTS** (per this task's instruction, and consistent with import direction: `qualidade/index.js:6-7` imports `getAflatoxinLimitPpb`/`isAflatoxinWithinLimit` **from** `compliance/`, never the reverse). This is recorded as the target authority principle; RUNTIME_CODE confirms the import direction but no document previously stated this as a rule.

---

## Authority Boundary

```
MAY_DECIDE:
  - aflatoxin_check.within_limit (deterministic comparison, given both inputs)
  - checklist.complete (deterministic, given a recognized market)
  - alerts[].needs_alert (deterministic date-window check)

MAY_RECOMMEND:
  none identified — this component produces flags/checklists, not
  recommended actions (contrast with FINANCEIRO's determineNextAction)

MAY_RECORD:
  none — compliance/index.js performs no persistence write of its own
  (verified: no firestore/supabase import in this file)

MAY_NOT_DECIDE:
  - The aflatoxin limit or required-document list for a market outside the
    3 currently defined (Egypt/Algeria/Russia) — it has no data to decide
    with, and the checklist half throws rather than declining gracefully
  - Whether a QUALIDADE-sourced lab result is itself trustworthy (accredited
    lab verification is QUALIDADE's responsibility, not this component's —
    see QUALIDADE.md)

LLM: NO AUTHORITY (frozen per this task, trivially true today)
```

---

## Side Effects

`logger.warn` calls only (`compliance/index.js:27,35,40`) — on incomplete checklist, aflatoxin over-limit, and any alerts needed. No Firestore/Supabase write, no email, no calendar interaction performed directly by this component.

---

## Persistence

- **Reads:** none — all data (`market`, `labResultPpb`, `presentDocuments`, `expiryDates`) arrives via `context`, supplied by the caller. No `supabase.from('compliance_events')` or similar query exists in `compliance/index.js` despite `compliance_events` being a real Supabase table (`config/schemas.json` Compliance schema, `supabase/migrations/0001_init_schema.sql`).
- **Writes:** none.
- **Current store:** N/A for this component's own code — the conceptual owner of `compliance_events` rows is unverified; no code path writes to that table anywhere in `src/` (repo-wide check).
- **Authoritative ownership:** `DEFERRED_TO_ADR_007` for the market-requirements ruleset itself — currently hardcoded in `marketRequirements.js` (a source-code constant), not persisted in Supabase or Firestore at all, despite `compliance_events`/`config/schemas.json`'s `Compliance` schema implying a per-FTR persisted record. Whether the ruleset should live in a table (queryable, editable without a deploy) or remain a code constant is an open architectural question, not resolved by any document found.

---

## Dependencies

- `marketRequirements.js`, `aflatoxinCheck.js`, `alerts.js`, `checklist.js` — sibling modules (`compliance/index.js:2-5`).
- **Consumed by** (not a dependency of COMPLIANCE, but the reverse direction): `qualidade/index.js:6-7`, `digitalizacao/crossValidation.js:2-3` both import `marketRequirements.js`/`aflatoxinCheck.js` directly — confirming COMPLIANCE's sibling modules are shared, reused functions, while `compliance/index.js`'s own `process()` is not itself called by any other component.

---

## Error Model

No typed error taxonomy. The single failure mode is an uncaught `throw new Error(...)` for an unrecognized market (`checklist.js:7`) — not a structured/typed domain error, a plain JS exception. **No error codes are invented here for completeness** per this task's instruction.

---

## Retry Semantics

```
RETRYABLE:       UNKNOWN — this component never calls excecoes.process itself
NON_RETRYABLE:   the unrecognized-market throw is almost certainly
                 non-retryable in the sense that retrying with the same
                 market will always throw again — but this classification
                 is inferred from code shape, not documented anywhere
REQUIRES_REVIEW: not established as a formal signal — checklist.complete:false
                 and aflatoxin_check.within_limit:false only produce
                 logger.warn calls, no escalation
UNKNOWN:         everything else
```

---

## Idempotency

Trivially idempotent for the happy path — every function is pure, no persistence read/write. Not idempotent in the sense of "prevents duplicate processing" because there is nothing to deduplicate against (no persisted state).

---

## Human Review / Approval

None implemented in this component. `docs/ROADMAP.md:225` ("Import permit pending → escalação") describes an intended escalation that has no corresponding code — `compliance/index.js` only logs a warning, it does not call `excecoes.process()` or any other escalation mechanism.

---

## Security / Permissions

Not documented, not implemented — same as every other P0 component except COMUNICACAO (whose HTTP entry point has a shared-secret control; COMPLIANCE has no HTTP entry point at all).

---

## Audit / Observability

`logger.warn` only (see Side Effects). No structured audit trail, no MONITOR wiring.

---

## Workflow Boundary

- **Valid predecessor/event:** per `docs/ROADMAP.md`'s phase diagram: FTR approved, market known. Not code-enforced.
- **Successful exit:** `checklist.complete === true` and `aflatoxin_check.within_limit !== false`.
- **Failure exit:** unrecognized market → uncaught exception (see Error Model) — this is the component's only true "failure exit," and it is a crash, not a structured result.
- **Wait/review state:** `checklist.complete === false` or `aflatoxin_check.within_limit === false` — advisory only, no gate enforced by this component itself (`docs/ROADMAP.md:13` names it a "BLOCKER: ACID/permit must exist before BL" but no code enforces that block — `documentacao`'s BL generator does not consult `compliance`'s output).
- **Downstream capability:** `docs/ROADMAP.md`'s phase diagram names DOCUMENTACAO as next — **no verified code wiring** exists.

---

## ADR-001A Minimum Adapter Contract

```
invoke('compliance', 'evaluate', context)
  → success:            { checklist: {complete: boolean, items: [...]},
                           aflatoxin_check: {within_limit: boolean|null} }
  → deterministic_gate:  checklist.complete AND aflatoxin_check.within_limit
                          !== false — but note this is NOT enforced as a gate
                          anywhere in current code; a workflow engine choosing
                          to gate on it would be introducing new authority,
                          not reusing an existing one
  → retryable_failure:   UNKNOWN
  → permanent_failure:   unrecognized market → today an uncaught exception;
                          an adapter wrapping this component MUST catch this
                          itself (the component does not) and translate it to
                          a typed failure, since 4 of 7 documented markets
                          will trigger it
  → review_required:     checklist.complete:false OR aflatoxin_check.within_limit:false
  → correlation:         ftr_code (echoed input only)
```

---

## Current Implementation Mapping

No task-suggested state progression was specified for COMPLIANCE (unlike FINANCEIRO) — this section records the actual implemented decision shape only, per Business Rules above. No `NORMATIVE_TARGET` labeling is needed here since no external target was proposed to reconcile against.

## Implementation Gaps

1. Only 3 of 7 `config/schemas.json`-documented markets have a ruleset — the other 4 cause an uncaught exception, not a graceful "unknown market" result.
2. No persistence of the market-requirements ruleset or of a per-FTR compliance record, despite `compliance_events` existing as a Supabase table.
3. No escalation-to-EXCECOES wiring, despite `docs/ROADMAP.md` describing one.
4. The "BLOCKER: ACID/permit must exist before BL" rule named in `docs/ROADMAP.md:13` is not enforced by any code — `documentacao`'s BL generator does not consult this component.

## Open Decisions

- Should the market-requirements ruleset move from a code constant to a persisted, queryable table? `DEFERRED_TO_ADR_007`.
- Should an unrecognized market degrade to a structured "unknown" result (matching `aflatoxinCheck`'s null-tolerant behavior) instead of throwing?
- Should COMPLIANCE call EXCECOES directly (as DIGITALIZACAO does) for `checklist.complete:false`/aflatoxin-fail cases?

---

## Evidence Index

| Claim | File | Symbol/Lines | Type |
|---|---|---|---|
| Per-market ruleset | `src/agents/compliance/marketRequirements.js` | 8-12 | RUNTIME_CODE |
| Per-market ruleset (corroborating) | `docs/ROADMAP.md` | 211-220 | ROADMAP |
| Aflatoxin tri-state comparison | `src/agents/compliance/aflatoxinCheck.js` | 1-6 | RUNTIME_CODE |
| Checklist throws on unknown market | `src/agents/compliance/checklist.js` | 4-8 | RUNTIME_CODE |
| Expiry alert window | `src/agents/compliance/alerts.js` | 1-13 | RUNTIME_CODE |
| 7-market enum | `config/schemas.json` | Compliance.market | CONFIGURATION |
| Full process() flow | `src/agents/compliance/index.js` | 1-53 | RUNTIME_CODE |
| No HTTP route exists | `src/routes/index.js` | absence, full-file review | RUNTIME_CODE |
| Import direction qualidade→compliance | `src/agents/qualidade/index.js` | 6-7 | RUNTIME_CODE |
| Import direction digitalizacao→compliance | `src/agents/digitalizacao/crossValidation.js` | 2-3 | RUNTIME_CODE |
| No escalation wiring exists | repo-wide search | no `excecoes` import in `compliance/` | RUNTIME_CODE |
