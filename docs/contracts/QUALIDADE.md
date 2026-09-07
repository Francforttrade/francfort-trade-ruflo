# QUALIDADE — Normative Component Contract

**Status:** Normative contract, hardened from repository evidence. P0 — its boundary against COMPLIANCE's regulatory authority must be unambiguous.

---

## Identity

- **Name:** QUALIDADE
- **Architectural classification:** Domain Service / Rule Engine (deterministic; zero LLM — confirmed, no match for `anthropic|openai|gpt-|claude-` in `src/agents/qualidade/`).
- **Domain responsibility:** `QUALIDADE = QUALITY DATA INTERPRETATION / VALIDATION DOMAIN`. Parses lab-report filenames and text, checks laboratory accreditation, records buyer quality-approval decisions. **Does not own regulatory thresholds** — it consumes COMPLIANCE's shared functions (see Authority Boundary).
- **Lifecycle role:** Sequential FTR lifecycle stage (`test/integration/ftr-end-to-end.test.js:146,156`, `targetAgent: 'qualidade'`, invoked twice — once for lab-report evaluation, once for `action: 'buyer_approval'`), FTR-gated.

---

## Invocation

- **Entry conditions:** `master.route({targetAgent: 'qualidade', ftrCode, ...})`. **No live HTTP route** — absent from `src/routes/index.js` (RUNTIME_CODE, absence verified).
- **Allowed actions/commands:** Two distinct paths inside one `process(context)`:
  1. `context.action === 'buyer_approval'` (`qualidade/index.js:12-21`) — records an approval decision.
  2. default path (`qualidade/index.js:23-49`) — lab-report parsing/aflatoxin evaluation.
- **Required context (path 2, CODE_ONLY):** none strictly required — every field has a fallback (`context.filename ? ... : null`, `context.reportText ? ... : {}`).
- **Required context (path 1, CODE_ONLY):** `approved`, implicitly required for `buildApprovalRecord` to be meaningful, though the function itself defaults it via `Boolean(approved)` (`buyerApproval.js:2`) — never throws for a missing value.

---

## Input Contract

**Path 2 — lab-report evaluation:**

| Field | Type | Required/Optional | Source | Validation | Semantic meaning |
|---|---|---|---|---|---|
| `ftrCode` | string | required (orchestrator gate) | caller | non-empty | FTR under evaluation |
| `market` | string | optional (passed straight to `compliance/marketRequirements.getAflatoxinLimitPpb`, which returns `null` for unrecognized markets — no throw here, unlike COMPLIANCE's own checklist path) | caller | none | Selects the aflatoxin limit |
| `filename` | string | optional | caller | matched against `FILENAME_REGEX = /^FTR_(\d{5}-\d{2}(?:-\d)?)_([A-Za-z]+)_(\d{4}-\d{2}-\d{2})\.pdf$/i` (`filenameParser.js:2`) — **case-insensitive on the whole filename, but the lab-name capture group itself is letters-only** | Drives `filename_info`/`lab_accredited` — returns `null` entirely if the convention isn't matched |
| `reportText` | string | optional | caller | none | Parsed by 3 independent regexes for aflatoxin/moisture/purity (`labReportParser.js:1-3`) |
| `labResultPpb` | number or null | optional, **takes precedence over `reportText`'s parsed value** (`qualidade/index.js:27`: `context.labResultPpb ?? parsedReport.aflatoxin_ppb ?? null`) | caller | none | Compared against the market limit |

**Path 1 — buyer approval:**

| Field | Type | Required/Optional | Source | Validation | Semantic meaning |
|---|---|---|---|---|---|
| `action` | `'buyer_approval'` | required to select this path | caller | exact string match | Path selector |
| `approved` | boolean | optional, coerced via `Boolean()` — **any truthy value, including a non-boolean, is accepted and coerced without a type-mismatch signal** | caller — **CODE_ONLY, unverified origin**: no endpoint, no UI, no message-parsing path was found anywhere in the repository that produces this value — see Human Review / Approval | none — coercion, not validation | The actual yes/no decision |
| `approvedBy` | string or null | optional | caller | none | Attribution only |
| `approvedAt` | ISO timestamp, default `new Date().toISOString()` | optional | caller | none | Timestamp |

---

## Output Contract

**Path 2:**

| Field | Type | Guaranteed/Conditional | Semantic meaning | Downstream consumer |
|---|---|---|---|---|
| `agent` | `'qualidade'` | guaranteed | identity | none verified |
| `ftr_code` | string or undefined | guaranteed (echo) | — | none |
| `filename_info` | `{ftrCode, labName, date}` or `null` | guaranteed | `null` whenever the strict filename convention isn't matched — **not an error, a silent non-match** | none |
| `lab_accredited` | boolean or `null` | guaranteed; `null` whenever `filename_info` is `null` (no filename to check a lab name from) | Accreditation result — **checked against the filename-derived lab name only, never against `reportText` content** | none |
| `aflatoxin_check` | `{result_ppb, limit_ppb, within_limit}` | guaranteed | `within_limit` tri-state (`true`/`false`/`null`, delegated to `compliance.isAflatoxinWithinLimit`) | none |
| `moisture_pct`, `purity_pct` | number or `null` | guaranteed | Parsed from `reportText` only — **no caller-supplied override exists for these two, unlike `labResultPpb`** | none |
| `needs_escalation` | boolean | guaranteed, `true` iff `within_limit === false` | Signal only — see Implementation Gaps for what (nothing) currently acts on it | none |

**Path 1:**

| Field | Type | Guaranteed | Semantic meaning |
|---|---|---|---|
| `agent` | `'qualidade'` | guaranteed | identity |
| `ftr_code` | string | guaranteed (echo) | — |
| `approval` | `{approved, approved_by, approved_at}` | guaranteed | Persisted verbatim to Firestore (see Persistence) |

No downstream component reads either output shape — confirmed by repo-wide search (no `require('../qualidade')` importing `index.js` anywhere).

---

## Business Rules

1. **Filename convention (`filenameParser.js:2`, corroborated by `docs/ROADMAP.md:267`):** `FTR_<ftrCode>_<LABNAME>_<YYYY-MM-DD>.pdf`.
2. **Accreditation whitelist (`accreditedLabs.js:2`, corroborated by `docs/ROADMAP.md:269`):** exactly one lab, `Eurofins`, case-insensitive exact match — **not a substring/domain check** despite the ROADMAP phrasing it as "eurofins.com?" (a domain-shaped question the code does not actually implement as a domain check).
3. **Aflatoxin/moisture/purity extraction (`labReportParser.js:1-17`):** independent regexes, each returns `null` if not found — no cross-field validation (e.g. no check that moisture_pct is within a plausible 0-100 range).
4. **`FROZEN` per this task's boundary: QUALIDADE may call shared Compliance rule functions; that does not make QUALIDADE the regulatory authority.** Confirmed by import direction (`qualidade/index.js:6-7`): `getAflatoxinLimitPpb`/`isAflatoxinWithinLimit` are imported **from** `compliance/`, never redefined here. QUALIDADE does not duplicate the market→limit table.
5. **Buyer approval is recorded, not decided (`buyerApproval.js:1-3`):** `buildApprovalRecord` is a pure record-shaper — it accepts whatever `approved` boolean it is given and returns a timestamped record. **It contains no decision logic whatsoever.**

---

## Boundary vs. COMPLIANCE (explicit, per this task's requirement)

```
QUALIDADE
  produces/normalizes quality evidence:
    - parses raw lab-report text/filename into structured values
      (aflatoxin_ppb, moisture_pct, purity_pct, lab identity)
    - checks whether the reporting lab is on the accreditation whitelist
    - records (never decides) a buyer's quality-approval verdict

COMPLIANCE
  applies authoritative regulatory requirement:
    - owns the market → aflatoxin-limit / required-document table
      (marketRequirements.js)
    - is the sole place this table is defined — QUALIDADE imports it,
      never redefines or overrides it
```
**Regulatory threshold source of truth = COMPLIANCE / `marketRequirements.js`.** This is confirmed by RUNTIME_CODE (import direction) but was not previously stated as an explicit rule in any document — recorded here as the target authority principle per this task's instruction.

**Downstream regulatory evaluation is NOT verified to occur as a distinct step.** The task's suggested pipeline —
```
LAB DOCUMENT → DIGITALIZACAO → QUALIDADE → normalized quality result → COMPLIANCE regulatory evaluation
```
— is `NORMATIVE_TARGET`, not current behavior. In the current code, QUALIDADE **itself** calls `compliance.isAflatoxinWithinLimit` inline (`qualidade/index.js:7,29`) to produce its own `aflatoxin_check.within_limit` field — there is no separate, later invocation of COMPLIANCE's own `process()` that re-evaluates QUALIDADE's normalized result. The "COMPLIANCE regulatory evaluation" step in the target pipeline **already happens, function-call-inline, inside QUALIDADE's own process() — not as a distinct workflow step.** This is an important nuance: the *authority* (whose threshold table is used) is correctly COMPLIANCE's, but the *invocation* is QUALIDADE calling into COMPLIANCE's module, not an orchestrator calling COMPLIANCE's agent after QUALIDADE finishes.

---

## Invariants

- `lab_accredited` and `filename_info` are always both `null` together, or both non-null together (`qualidade/index.js:23-24`) — a documented-by-code coupling, not stated elsewhere.
- `aflatoxin_check.within_limit` is `null`, not `false`, when data is missing — QUALIDADE never treats "unknown" as "fail." This mirrors COMPLIANCE's own tri-state discipline (shared function).
- No invariant found or enforced preventing the same lab report (same `filename`) from being processed twice, producing two independent, undeduplicated results.

---

## Authority Boundary

```
MAY_DECIDE:
  - lab_accredited (deterministic whitelist check, given a parseable filename)
  - aflatoxin_check.within_limit (delegated computation, using COMPLIANCE's
    threshold — QUALIDADE decides the comparison, not the threshold itself)
  - needs_escalation (deterministic function of within_limit)

MAY_RECOMMEND:
  none identified

MAY_RECORD:
  - approval (Firestore SESSIONS document) — records, does not decide,
    the buyer's approval verdict (see Business Rules #5)

MAY_NOT_DECIDE:
  - The aflatoxin limit for a market (owned by COMPLIANCE)
  - Whether a buyer approves a lot (the actual decision-maker is external —
    a human, via a channel not modeled anywhere in this repository's code;
    see Human Review / Approval)
  - Lab accreditation beyond the single hardcoded whitelist entry — cannot
    add/recognize a new accredited lab without a code change

LLM: NO AUTHORITY
```

---

## Side Effects

- Firestore write: `COLLECTIONS.SESSIONS`, only on the `buyer_approval` path (`qualidade/index.js:14-17`), document id `quality-${ftrCode}-${Date.now()}`.
- `logger.warn` on aflatoxin over-limit (`qualidade/index.js:31-37`) and `logger.info` on approval recorded (`qualidade/index.js:19`).
- No Supabase write, no email, no calendar interaction.

---

## Persistence

- **Reads:** none — all inputs arrive via `context`.
- **Writes:** `COLLECTIONS.SESSIONS` (Firestore), buyer-approval path only.
- **Current store:** Firestore, for the approval record only. No write to `compliance_events`/`quality_approval` fields described in `config/schemas.json`'s `Compliance.quality_approval` sub-schema — that Supabase-shaped field is never populated by this component.
- **Authoritative ownership:** `DEFERRED_TO_ADR_007` — `config/schemas.json` models `quality_approval` as part of the `Compliance` Supabase entity, but the only code that actually records an approval writes to a Firestore `sessions` document instead, under a different shape (`{approved, approved_by, approved_at}` vs. the schema's `{buyer_approved, approval_date, approved_by}`). Two different shapes, two different stores, for the same conceptual fact — unreconciled.

---

## Dependencies

- `filenameParser.js`, `accreditedLabs.js`, `labReportParser.js`, `buyerApproval.js` — sibling modules.
- `compliance/marketRequirements.js`, `compliance/aflatoxinCheck.js` — cross-agent direct import (`qualidade/index.js:6-7`), consistent with the repository-wide "direct module import" cross-agent pattern.
- `src/services/firestore.js`.

---

## Error Model

None. No exception is thrown anywhere in this component's code for any input shape, including a malformed filename or unparseable report text — every such case degrades to `null` fields rather than a typed error or a thrown exception. This is the opposite failure posture from COMPLIANCE's checklist (which throws on an unrecognized market) — **an inconsistency across the two components that share a domain**, worth noting even though neither behavior is individually wrong.

---

## Retry Semantics

```
RETRYABLE:       UNKNOWN — no excecoes.process call exists in this component
NON_RETRYABLE:   N/A — no failure mode exists to classify (see Error Model)
REQUIRES_REVIEW: needs_escalation:true is the closest signal, but nothing
                 consumes it (no escalation call, no EXCECOES wiring)
UNKNOWN:         everything else
```

---

## Idempotency

Not established. Calling `process()` twice with the same `filename`/`reportText` produces the same deterministic output (pure functions), but nothing deduplicates two separate calls, and the buyer-approval Firestore document id (`quality-${ftrCode}-${Date.now()}`) is **timestamp-suffixed**, meaning two approval calls for the same FTR in quick succession create two separate documents rather than one being an idempotent update of the other.

---

## Human Review / Approval

**This entire component's second action path (`buyer_approval`) exists to record a human decision, but no code anywhere produces that decision.** No endpoint, UI, email-parsing rule, or WhatsApp intent classification was found in the repository that sets `context.approved` for this path. `docs/ROADMAP.md:275-278` describes an intended "Endpoint para buyer: 'Aceitar lote?' → yes/no" that has no corresponding code — **this is the component's single largest implementation gap**, more fundamental than a missing field: the human-approval mechanism itself does not exist yet, only the record-keeping shape that would receive its output.

---

## Security / Permissions

Not documented, not implemented. `approvedBy` is a free-text string with no validation against any identity/permission system.

---

## Audit / Observability

`logger.warn`/`logger.info` only, plus the Firestore `SESSIONS` write (which is itself the only audit trail for an approval decision — no `AUDIT_LOG`-collection entry is created for it, unlike FINANCEIRO's release or CONTRATOS' amendment, both of which write to `COLLECTIONS.AUDIT_LOG` specifically).

---

## Workflow Boundary

- **Valid predecessor/event:** per `docs/ROADMAP.md`'s phase diagram: lab report uploaded (path 2) or buyer quality request outstanding (path 1). Not code-enforced — either path can be invoked at any time with any input.
- **Successful exit:** path 2 — `aflatoxin_check.within_limit !== false`; path 1 — `approval.approved === true`.
- **Failure exit:** path 2 — `needs_escalation: true` (advisory only, no hard stop); path 1 — none (any `approved` value is accepted).
- **Wait/review state:** not modeled — there is no "pending buyer decision" state persisted anywhere; the approval either has been recorded (a document exists) or has not (no document, indistinguishable from "not yet asked" vs. "asked but no response yet").
- **Downstream capability:** `docs/ROADMAP.md:16` names FINANCEIRO as the next phase after QA sign-off — **no verified code wiring**.

---

## ADR-001A Minimum Adapter Contract

```
invoke('qualidade', 'evaluate_lab_report', context)
  → success:            { aflatoxin_check: {within_limit: boolean|null},
                           lab_accredited: boolean|null, needs_escalation: boolean }
  → deterministic_gate:  NOT a gate today — needs_escalation is informational,
                          nothing currently blocks on it
  → retryable_failure:   UNKNOWN
  → permanent_failure:   none (no throw path exists)
  → review_required:     needs_escalation: true
  → correlation:         ftr_code (echoed input only)

invoke('qualidade', 'record_buyer_approval', context)
  → success:            { approval: {approved, approved_by, approved_at} }
  → NOTE: this action only records a decision already made elsewhere; the
    workflow engine must not treat invoking this action as itself producing
    the decision — the decision's source is an unmodeled human process
    (see Human Review / Approval)
```

---

## Current Implementation Mapping

No task-suggested target state progression was specified for QUALIDADE. Recorded instead: the task's suggested pipeline (`LAB DOCUMENT → DIGITALIZACAO → QUALIDADE → COMPLIANCE`) is `NORMATIVE_TARGET`; current behavior collapses the last step into an inline function call within QUALIDADE itself (see Boundary vs. COMPLIANCE above).

## Implementation Gaps

1. No code produces the `approved` boolean for the buyer-approval path — the human-decision mechanism itself is missing, not just unwired.
2. Buyer-approval Firestore document id is timestamp-suffixed, not idempotent per FTR.
3. `quality_approval`/`compliance_events` Supabase fields (`config/schemas.json`) are never populated — approval is recorded to Firestore only, in a different shape.
4. No escalation-to-EXCECOES wiring despite `needs_escalation: true` being computed.
5. Error-handling posture (silent-null vs. throw) is inconsistent with COMPLIANCE's for the same domain.

## Open Decisions

- What is the actual mechanism by which a buyer's yes/no reaches this component (email reply parsing via COMUNICACAO? a dedicated endpoint? manual entry by Rodrigo)? Entirely unresolved.
- Should the buyer-approval Firestore write become an idempotent upsert (keyed by `ftrCode` alone, or `ftrCode` + a review-request id) instead of timestamp-suffixed?
- Should `quality_approval` be written to Supabase (matching `config/schemas.json`) in addition to or instead of Firestore? `DEFERRED_TO_ADR_007`.

---

## Evidence Index

| Claim | File | Symbol/Lines | Type |
|---|---|---|---|
| Filename convention | `src/agents/qualidade/filenameParser.js` | 2 | RUNTIME_CODE |
| Filename convention (corroborating) | `docs/ROADMAP.md` | 267 | ROADMAP |
| Accreditation whitelist | `src/agents/qualidade/accreditedLabs.js` | 2 | RUNTIME_CODE |
| Accreditation whitelist (corroborating) | `docs/ROADMAP.md` | 269 | ROADMAP |
| Lab report field extraction | `src/agents/qualidade/labReportParser.js` | 1-17 | RUNTIME_CODE |
| Buyer approval is record-only | `src/agents/qualidade/buyerApproval.js` | 1-3 | RUNTIME_CODE |
| Import direction qualidade→compliance | `src/agents/qualidade/index.js` | 6-7 | RUNTIME_CODE |
| Full process() flow | `src/agents/qualidade/index.js` | 1-53 | RUNTIME_CODE |
| Buyer-approval endpoint never implemented | `docs/ROADMAP.md` | 275-278 (unchecked) vs. repo-wide search (no matching endpoint/parser) | ROADMAP + RUNTIME_CODE (absence) |
| `quality_approval` schema shape mismatch | `config/schemas.json` | Compliance.quality_approval | CONFIGURATION |
| No HTTP route exists | `src/routes/index.js` | absence, full-file review | RUNTIME_CODE |
