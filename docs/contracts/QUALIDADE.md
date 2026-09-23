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

No typed error taxonomy is implemented. Expected unmatched string patterns can return null, but arbitrary input shapes are not safe: labReportParser uses text.match, and Firestore writes can reject. Exceptions propagate because process() has no catch. Therefore neither 'no failure mode' nor 'all inputs degrade to null' is a valid guarantee.

---

## Retry Semantics

```
RETRYABLE:       UNKNOWN — no excecoes.process call exists in this component
NON_RETRYABLE:   classification not implemented; invalid inputs require correction
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
- **Current return, not verified approval:** path 2 can return within_limit:null; this is unresolved, not a successful quality verdict. Path 1 returns a Boolean-coerced approved field; true alone is not evidence of authenticated buyer approval.
- **Negative/error outcomes:** path 2 can signal needs_escalation:true or return unresolved values; path 1 coerces arbitrary approved values and can fail during persistence. These are distinct from an authenticated buyer rejection.
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
  → permanent_failure:   untyped input/storage failures may propagate
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

## Reconciliation: human approval and proposed flow

**Status:** documentary correction and technical proposal. Current code, approved business intent and proposed engineering are separate. FIN-DEC-01 through FIN-DEC-21 authorize financial and original-document-delivery decisions only. They do not replace the buyer as quality decision-maker, authorize Rodrigo/Leonardo to approve quality on the buyer's behalf, choose a quality channel or dispense with quality evidence.

### Explicit approval and authority

QUALIDADE interprets laboratory evidence and records a buyer decision; COMPLIANCE owns shared regulatory thresholds. The buyer's decision and the software comparison are separate facts. Sender identity and response correlation are necessary but insufficient: a valid affirmative decision must concern the correct lot/report/request version. Negative, doubtful or ambiguous messages must not become approval.

Current buyerApproval.js uses Boolean(approved): the string 'false' becomes true, while missing input becomes false. This is coercion, not semantic validation. Proposed handling distinguishes APPROVED, REJECTED and UNRESOLVED rather than treating absence as rejection or a nonempty string as approval. No mandatory wording or channel has been approved for quality.

### Proposed coordination

Track laboratory evidence and buyer decision independently; they may be received in either order. If a decision arrives first, retain its scoped evidence but do not infer a missing lab result or regulatory pass. The required inputs and prerequisites for progression must be explicitly defined. READY_TO_EVALUATE is distinct from quality acceptance or permission for downstream action. Unknown accreditation or within_limit:null is not automatic approval.

COMUNICACAO may handle channel/identity metadata and normalize messages; QUALIDADE validates scope and records the decision; COMPLIANCE supplies regulatory evaluation; the durable orchestrator coordinates prerequisites and proceeds only on an eligible outcome. This is a technical proposal, not an implemented workflow or a change in who approves.

### Repetition and notification

Allow repeated calculations; prevent duplicate decision records and downstream effects using an operation/request/lot/report version and event identity. A correction or revocation is a new event, not a duplicate to discard. Timestamp-only IDs currently do not enforce uniqueness and can also collide within the same millisecond. Preserve decision history rather than overwriting contradictory replies.

Any future notification needs one logical identity and results per destination/channel. Delivery success does not prove buyer approval or physical delivery. The financial rule accepting one successful channel is not automatically applicable here.

### Open business decisions

- Authorized buyer representatives, channel and how their identity is established.
- Required laboratory/lot evidence, approved laboratories and buyer specifications.
- Rejection, new analysis, conflicting decisions, revocation and report changes.
- Notification policy, retention, review responsibility and deadlines.
- Evidence required for acceptance; financial no-attachment decisions do not answer this.

### Technical work pending

Strict boolean/schema validation; authentication and message correlation; lot/report/version model; separate pending/rejected/approved states; durable storage under ADR-007; idempotent event handling, source-linked audit and error taxonomy. The currently accepted override labResultPpb versus parsed report requires conflict detection rather than silently treating precedence as verified truth.

### Proposed acceptance criteria — not executed

1. 'false', 'ok', a negative, uncertainty or missing input cannot become authenticated approval through Boolean coercion.
2. Sender authorization alone does not approve a lot; wrong request/report version remains unresolved.
3. Buyer reply and report in either order preserve both facts and wait for required evidence before progression.
4. Duplicate messages do not duplicate effects; recalculation remains allowed.
5. Buyer acceptance does not override a failed regulatory comparison; missing result remains unresolved.
6. Storage failures are reported as failures, not successful recorded decisions; retry reconciles possible prior writes.
7. Notification failure/success is independent of buyer decision and tracked per channel if notifications are implemented.
8. A new report or conflicting decision is preserved and routed through the defined review policy, without automatically reusing prior approval.

Evidence: src/agents/qualidade/index.js, buyerApproval.js and labReportParser.js were reread for this revision. No runtime or tests were changed or executed.

---

## Conduct Procedures Incorporated (Fonte A/B — Critical Quality Complaints)

**Status:** BUSINESS_DECISION (adoption + Fonte-B precedence on deadline/responsible party) reconciliation. TECHNICAL_PROPOSAL for agent participation — not approved, not implemented. Sources preserved verbatim: `CONDUTA_FONTE_A.txt`, `CONDUTA_FONTE_B.txt`; precedence recorded in `PROCEDIMENTOS_CONDUTA.md`. Where Fonte B diverges from Fonte A on prazo (deadline) or responsável (responsible party), Fonte B prevails, per the user's decision of 2026-09-22. Action/evidence differences between the sources are **not** resolved by that precedence and are flagged as pendência below. **Vendedor/Comprador remain the human responsible parties named in the sources — QUALIDADE does not replace them, and this section does not transfer COMPLIANCE's regulatory-threshold authority (Business Rules #4, Boundary vs. COMPLIANCE above) to a "responsável" field below: "responsável" here is commercial/dispute-resolution ownership of the complaint, not regulatory pass/fail authority.**

### Adopted rules (deadline/responsible — Fonte B prevails where it diverges from Fonte A)

| Complaint | Trigger | Deadline (adopted) | Responsible (adopted) | Source |
|---|---|---|---|---|
| Divergência de Peso | Buyer disputes shipped weight | 1 dia | Vendedor | CONDUTA_FONTE_A.txt:30-32; CONDUTA_FONTE_B.txt:31-33 (identical in both — no divergence) |
| Infestação (insetos vivos/mortos) | Buyer reports live/dead insect infestation | 2 dias (Fonte B prevails; Fonte A said 1 dia) | Vendedor e Comprador (same in both) | CONDUTA_FONTE_A.txt:41-43; CONDUTA_FONTE_B.txt:41-43 |
| Produto Danificado por Insetos | Buyer reports insect damage | 2 dias (Fonte B prevails) | Vendedor e Comprador | CONDUTA_FONTE_A.txt:45-47; CONDUTA_FONTE_B.txt:45-47 |
| FFA (Acidez) | Buyer disputes free fatty acid result | 2 dias (Fonte B prevails) | Vendedor e Comprador | CONDUTA_FONTE_A.txt:52-54; CONDUTA_FONTE_B.txt:50-52 |
| PV (Peróxido) | Buyer disputes peroxide value | 2 dias (Fonte B prevails) | Vendedor e Comprador | CONDUTA_FONTE_A.txt:56-58; CONDUTA_FONTE_B.txt:54-56 |
| Sacos Rasgados | Buyer reports torn bags | 2 dias (Fonte B prevails) | Vendedor e Comprador | CONDUTA_FONTE_A.txt:60-62; CONDUTA_FONTE_B.txt:58-60 |
| Grãos Rachados | Buyer reports cracked grains | 2 dias (Fonte B prevails) | Vendedor e Comprador | CONDUTA_FONTE_A.txt:65-67; CONDUTA_FONTE_B.txt:63-65 |
| Grão Descascados | Buyer reports dehusked grains | 2 dias (Fonte B prevails) | Vendedor e Comprador | CONDUTA_FONTE_A.txt:69-71; CONDUTA_FONTE_B.txt:67-69 |
| Aflatoxina | Buyer disputes aflatoxin result | 2 dias (Fonte B prevails; Fonte A said 1 dia) | Vendedor e Comprador (Fonte B prevails; Fonte A said Vendedor only) | CONDUTA_FONTE_A.txt:77-79; CONDUTA_FONTE_B.txt:75-77 |
| Aflatoxina — EUROPA (rejeição na UE) | Cargo rejected on arrival in an EU destination | Imediato (identical in both — carved out of the general 2-dias bucket) | Vendedor | CONDUTA_FONTE_A.txt:81-83; CONDUTA_FONTE_B.txt:79-81 |
| Sacos Molhados e Mofados | Buyer reports wet/moldy bags | 2 dias (Fonte B prevails; Fonte A said 1 dia) | Vendedor (same in both) | CONDUTA_FONTE_A.txt:85-87; CONDUTA_FONTE_B.txt:83-85 |

For every row except Infestação, the approved action text is identical between Fonte A and Fonte B (only the deadline, and for Aflatoxina also the responsible party, diverge) — the action itself is not in dispute, so no pendência is recorded for it. `Aflatoxina — EUROPA`'s action ("procurar outro comprador em destinos próximos que não seja de países da UE ou solicitar a reexportação pelo vendedor") is identical in both sources.

### Ação divergence not resolved by precedence (pendência)

**Infestação (insetos vivos/mortos):** Fonte A — request photo evidence from the buyer, await the vendor's response and a proposal. Fonte B — request photo **and video** evidence, forward it to the vendor for supporting/refuting documents, then propose a solution once received. This is an action/evidence difference, not a deadline/responsible difference — Fonte B's extra verification step is **not** adopted by inference; both versions are registered, and which one governs remains an open business decision.

### Aflatoxina and reexportação — no presumption of regulatory waiver

Adopting this conduct procedure records the *commercial* dispute-handling sequence (request evidence, await vendor response, propose a solution, or for EU rejections, seek an alternative non-EU buyer or request reexport by the vendor). It does **not**: (a) waive or substitute COMPLIANCE's regulatory aflatoxin threshold (`marketRequirements.js`, per this contract's own Boundary vs. COMPLIANCE section) — a buyer complaint being handled commercially says nothing about whether the shipment passes the regulatory limit; (b) authorize QUALIDADE or any agent to approve reexport, contact an alternative buyer, or take any external action automatically; or (c) presume any destination authority accepts a reexported or redirected cargo. FIN-DEC-01–21 do not address aflatoxin disputes or reexport and do not change anything here. Who is authorized to actually execute a reexport or contact an alternative buyer, and under what commercial terms, remains an open business decision — not decided by this registration.

### Proposed agent participation for QUALIDADE (TECHNICAL_PROPOSAL — not approved, not implemented)

`qualidade/index.js`'s existing `aflatoxin_check`/`needs_escalation` computation (Output Contract, above) already produces a pass/fail/unresolved signal from lab evidence — but nothing in current code triggers on a *buyer complaint* (these conduct procedures are reactive to a buyer report, not to a lab report QUALIDADE parses today). Proposed, unimplemented: QUALIDADE could record a complaint-received event (trigger, complaint type, buyer evidence reference) using the same non-deciding posture as `buyerApproval.js` — recording, not adjudicating, whether the complaint is upheld. This would not compute or override `aflatoxin_check.within_limit`, would not decide the commercial proposal/solution, and would not authorize reexport. No code exists for any of this today.

### Acceptance criteria proposed — conduct procedures (not executed)

1. Every complaint above keeps Vendedor/Comprador (as adopted per row) as the responsible party and the adopted deadline, regardless of which source's action text is consulted.
2. Aflatoxina's commercial dispute-handling deadline/responsible-party change (per Fonte B) does not alter `aflatoxin_check.within_limit`'s regulatory computation, which remains COMPLIANCE's threshold applied by this component (Business Rules #4).
3. Infestação's action/evidence pendência (photos vs. photos+video, extra vendor-verification step) is not silently resolved — a future implementation must record which version was actually followed, not assume one.
4. No procedure above is treated as authorizing reexport, an alternative-buyer contact, or any external action without separate, explicit authorization.
5. Comprador and Vendedor are never replaced by an agent identifier in any record derived from this section.

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
| Conduct procedures — quality complaints (Fonte A/B), adopted with Fonte-B precedence on deadline/responsible | `docs/contracts/CONDUTA_FONTE_A.txt`, `docs/contracts/CONDUTA_FONTE_B.txt`, `docs/contracts/PROCEDIMENTOS_CONDUTA.md` | full documents, registered 2026-09-22 | BUSINESS_DECISION |
