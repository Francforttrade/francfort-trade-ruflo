# COMUNICACAO — Normative Component Contract

**Status:** Normative contract, hardened from repository evidence. P0 — its documented output contract conflicts with runtime behavior; this document resolves the conflict explicitly rather than silently picking a side.

---

## Identity

- **Name:** COMUNICACAO
- **Architectural classification:** Domain Service / Rule Engine (deterministic; zero LLM — confirmed, no match for `anthropic|openai|gpt-|claude-` in `src/agents/comunicacao/`).
- **Domain responsibility:** Parse free-form email/WhatsApp/manual-entry text, extract FTR/booking/invoice/BL references and shipment fields, classify intent, persist a session record.
- **Lifecycle role:** Intake stage. **Special condition, FROZEN per this task: FTR MAY BE UNKNOWN AT ENTRY.** COMUNICACAO is one of only two components exempt from the FTR mutex gate (`master.js:66`, `AGENTS_WITHOUT_FTR_GATE = new Set(['comunicacao', 'monitor'])`) — the code comment directly justifying this (`master.js:62-65`, RUNTIME_CODE) states: *"COMUNICACAO is the intake step that extracts the FTR code from raw text in the first place... [it has] no one FTR to gate on yet."*

---

## Invocation

- **Entry conditions:** `master.route({targetAgent: 'comunicacao', ...})`, **no FTR-code requirement** (exempt from gate — this is the component's defining trait). **Live HTTP routes:** `POST /webhook-whatsapp`, `POST /webhook-gmail` (`src/routes/index.js:46-70`), both behind the shared-secret middleware (see Security).
- **Allowed actions/commands:** none distinguished by an `action` field — single unconditional code path (`comunicacao/index.js:7-36`). The Gmail route has one special-cased sub-behavior: a `{ping: true}` body short-circuits to `{pong: true}` **before** reaching `comunicacao.process()` at all (`routes/index.js:61-63`) — this is routing-layer behavior, not part of the component's own contract.
- **Required context:** none strictly required — `context.subject`/`context.body` are joined and may both be absent (`comunicacao/index.js:8`: `[context.subject, context.body].filter(Boolean).join('\n')` — an empty string is a valid, non-throwing input).
- **Optional context:** `channel`, `from`, `threadId` — each defaults (`|| 'unknown'`, `|| null`, `|| \`sess-${Date.now()}\``).

---

## Input Contract

| Field | Type | Required/Optional | Source | Validation | Semantic meaning |
|---|---|---|---|---|---|
| `subject` | string | optional | caller (Gmail/WhatsApp webhook body) | none | Joined with `body` before parsing |
| `body` | string | optional | caller | none | Joined with `subject` before parsing |
| `channel` | string | optional, default `'unknown'` | caller | none | `'whatsapp'`/`'gmail'`, set by the routing layer (`routes/index.js:48,65`), not validated against an enum |
| `from` | string | optional | caller | none | Sender identity, stored verbatim |
| `threadId` | string | optional, default `sess-${Date.now()}` when absent | caller | none | Used as the Firestore session document id |

---

## Output Contract — Conflict Resolution

**The conflict, stated precisely (per this task's requirement — not silently choosing one shape):**

```
LEGACY_DOCUMENTED_OUTPUT   (docs/ROADMAP.md:127, ROADMAP type, unchecked
                            planning item under "Endpoint /webhook-whatsapp"):
  { from, subject, body, extracted_ftr_code, intent }

CURRENT_RUNTIME_OUTPUT     (comunicacao/index.js:30-35 + parser.js's
                            parseMessage, RUNTIME_CODE):
  {
    agent: 'comunicacao',
    session_id,
    response_template,
    intent,
    ftr_code,
    ftr_code_normalized,
    ftr_ambiguous,
    invoice_number,
    booking_number,
    bl_number,
    product: { type, grade },
    quantity: { mt },
    seller,
    buyer,
    shipment: { origin_port, destination_port, vessel, voyage, etd, eta,
                 container_quantity },
    change_signals: { booking_amendment, eta_change, split_shipment }
  }
```

**Where they actually conflict vs. where they don't:** `from`/`subject`/`body` are **absent from the HTTP response** (`process()`'s return value) but **are present in the persisted Firestore `sessions` document** (`comunicacao/index.js:12-20`: `{session_id, channel, from, subject, body, ...parsed, received_at}`). So the ROADMAP's intended fields are satisfied in the *persistence layer*, not in the *return value* — the two documents are not describing the same artifact, but neither document says so. The genuine naming conflict is narrower than "everything is wrong": `extracted_ftr_code` (ROADMAP) vs. `ftr_code` (runtime) is the one field name that actually differs for the same concept.

**TEST evidence (`comunicacao/index.test.js:19-48`) only anchors 4 fields as stable:** `result.agent`, `result.session_id`, `result.intent`, `result.response_template`, plus the Firestore-write assertion checking `session_id`/`channel`/`intent`/`quantity` are present in the persisted document. **No test asserts the full field list** — the richer shape (`ftr_code_normalized`, `ftr_ambiguous`, `shipment.*`, `change_signals.*`) is CODE_ONLY, unverified by any test as a stable contract.

**NORMATIVE_OUTPUT (derived per this task's 5-step method):**
1. *Downstream requirements:* no verified consumer reads `process()`'s return value as structured data — `POST /webhook-whatsapp`/`/webhook-gmail`'s only external caller (WhatsApp platform, Apps Script gmail-sync) is confirmed by `apps-script/gmail-sync/README.md` to only care about HTTP status / the `{pong: true}` ping response, never the JSON body of a real message post. **No strict downstream schema requirement exists today.**
2. *Architectural role:* intake + FTR discovery — the response's job is to confirm receipt and, where useful, echo back what was understood.
3. *Current runtime:* the full rich shape above.
4. *Tests:* only 4 fields are anchored.
5. *Least-surprise migration path:* since nothing consumes the extra fields today, and no test would break, **the current runtime shape is adopted as the normative output**, with the following two corrections recorded as the actual normative delta from today's code:
   - `extracted_ftr_code` is retired as a name — `ftr_code` (already the runtime name, already the name used across the rest of the codebase, e.g. `FTR_CODE_REGEX`-derived fields elsewhere) is the normative field name. `docs/ROADMAP.md:127`'s naming is superseded, not the code.
   - The **persisted Firestore session document** (not the HTTP response) is the normative home for `from`/`subject`/`body` — this matches current runtime behavior exactly (`comunicacao/index.js:12-20`) and requires no code change.

```
NORMATIVE_OUTPUT = CURRENT_RUNTIME_OUTPUT (comunicacao/index.js:30-35 shape),
with `ftr_code` (not `extracted_ftr_code`) as the canonical field name, and
`from`/`subject`/`body` normatively scoped to the persisted session document,
not the HTTP response.

MIGRATION_GAP: docs/ROADMAP.md:127 itself is not corrected by this contract
(per this task's prohibition on modifying existing documentation) — a future
documentation pass should update or annotate that line to point here.
```

**Full field table (normative, = current runtime, per above):**

| Field | Type | Guaranteed/Conditional | Semantic meaning | Downstream consumer |
|---|---|---|---|---|
| `agent` | `'comunicacao'` | guaranteed | identity | none verified |
| `session_id` | string | guaranteed | `threadId` if given, else `sess-${Date.now()}` | Firestore document id (self-consumed) |
| `response_template` | string | guaranteed | Canned acknowledgment text keyed by `intent` (`templates.js`) — fixed 6-entry table, default `'unknown'` fallback text | none verified downstream (presumably intended for a reply channel, but no code sends it anywhere) |
| `intent` | string | guaranteed | One of `booking`/`invoice`/`bl_document`/`quote_offer`/`ftr_reference`/`unknown` (`parser.js:31-37`, first-match order) | selects `response_template` |
| `ftr_code` | string or `null` | guaranteed | Bare 5-digit-dash-2-digit match (`FTR_CODE_REGEX`) — **narrower** than `ftr_code_normalized` (no missing-leading-zero/prefix handling) | routing elsewhere (per code comment `parser.js:69-75`) |
| `ftr_code_normalized` | string or `null` | guaranteed | Permissive normalizer (`ftrNormalization.js`) — handles missing leading zero, "FTR" prefix, "/" separator | none verified |
| `ftr_ambiguous` | boolean | guaranteed | `true` when 2+ distinct FTR codes are mentioned | signals REVISÃO MANUAL per code comment, but no code path acts on it within this component |
| `invoice_number`, `booking_number`, `bl_number` | string or `null` | guaranteed | Label-anchored extraction (`documentNumbers.js`) | none verified |
| `product.type`, `product.grade` | string or `null` | guaranteed | Keyword/regex match | none verified |
| `quantity.mt` | number or `null` | guaranteed | Regex match | none verified |
| `seller`, `buyer` | string or `null` | guaranteed | Label-anchored (`seller:`/`buyer:`/`vendedor:`/`comprador:`) | none verified |
| `shipment.*` (7 sub-fields) | mixed | guaranteed | Ports/vessel/voyage/ETD/ETA/container count | none verified |
| `change_signals.*` (3 sub-fields) | boolean | guaranteed | Presence-only keyword detection, does not itself diff against an existing record | none verified |

---

## Special Lifecycle Conditions (required by this task)

```
FTR found:
  ftr_code (and/or ftr_code_normalized) is non-null, ftr_ambiguous is false.
  No code path in COMUNICACAO itself acts differently based on this — the
  distinction matters only to whichever caller decides the next
  master.route() invocation (consistent with the orchestration-gap finding
  in the baseline document: COMUNICACAO does not itself call another agent).

FTR not found:
  ftr_code and ftr_code_normalized both null. No error, no rejection — a
  valid, successful result is still returned (intent may still resolve to
  something other than 'unknown' from other cues).

FTR ambiguous:
  ftr_ambiguous: true (2+ distinct FTR codes mentioned). Per
  ftrNormalization.js's own comment (lines 47-50), "callers that need to
  know 'which, if any' should use extractAllFtrCandidates and the ambiguity
  flag themselves instead of guessing" — COMUNICACAO surfaces the flag,
  it does NOT itself route to a manual-review queue. No code path in this
  component writes to payment_manual_review or any equivalent queue.

Malformed message:
  Not modeled as a distinct case — there is no message shape that causes
  a throw or a validation failure. Every regex in every sub-module
  degrades to null/false on non-match; the joined subject+body may even be
  an empty string with no special-cased response.

Unsupported input:
  Not modeled. No mimeType/format check exists in this component (contrast
  with DIGITALIZACAO's isStructuredMimeType) — COMUNICACAO only ever
  receives already-decoded text fields (subject/body), never a raw
  attachment; attachment handling is out of this component's scope
  entirely (per apps-script/gmail-sync/README.md, attachments are forwarded
  but there is no verified Node-side code that COMUNICACAO itself consumes
  them — see DIGITALIZACAO for document-shaped input instead).

Duplicate message:
  Not modeled. session_id defaults to a timestamp-derived value only when
  threadId is absent — two calls with the SAME threadId will overwrite the
  same Firestore document (Firestore .doc(id).set(...) is a full overwrite,
  not a merge or a reject-on-exists), so a duplicate webhook delivery for
  the same thread silently replaces the prior session record rather than
  being detected or rejected as a duplicate. IMPLEMENTATION_GAP.
```
**Per this task's explicit instruction: no automatic business decision is invented here for any of these five conditions.** Where no code path exists, this contract states that plainly rather than proposing one.

---

## Business Rules

1. **Intent classification order matters (`parser.js:31-37`, DOCUMENTED in its own comment):** `booking` → `invoice` → `bl_document` → `quote_offer` → `ftr_reference` → `unknown`, first match wins.
2. **FTR code canonical shape (DOCUMENTED across 3 independent sources — `ftrNormalization.js:1-8`, `config/schemas.json` FTR.ftr_code pattern, `supabase/migrations/0001_init_schema.sql`):** `\d{5}-\d{2}(-\d)?`, no "FTR-" prefix, 5-digit code padded with leading zeros.
3. **Ambiguity is never silently resolved (DOCUMENTED, `ftrNormalization.js:47-60`):** when 2+ distinct FTR codes are found, `normalizeFtr` returns `null` rather than guessing, and `isFtrAmbiguous` flags it separately.
4. **Never invent missing information (DOCUMENTED, code comment, `shipmentExtraction.js:1-5`):** every extraction function returns `null` rather than a best-guess when no labeled value is found.

---

## Invariants

- `ftr_code_normalized` is `null` whenever more than one distinct FTR candidate exists, even if one of them is a stronger/more obvious match — `normalizeFtr`'s single-value convenience deliberately refuses to pick (`ftrNormalization.js:51-54`).
- The Firestore session write happens **unconditionally** on every call (`comunicacao/index.js:22`) — there is no branch that skips persistence, even for an empty/unparseable message.

---

## Authority Boundary

```
MAY_DECIDE:
  - intent classification (deterministic, first-match keyword order)
  - all field extractions (deterministic regex/label matching)
  - ftr_ambiguous (deterministic count of distinct candidates)

MAY_RECOMMEND:
  - response_template (canned text keyed by intent — a suggested
    acknowledgment, not sent by this component itself)

MAY_RECORD:
  - the Firestore sessions document (unconditional write)

MAY_NOT_DECIDE:
  - Which FTR a message belongs to when ambiguous (correctly refuses,
    per Invariants)
  - Whether a message requires manual review as a persisted, queryable fact
    (the flag is computed, but no queue entry is created — see Implementation
    Gaps)

LLM: NO AUTHORITY
```

---

## Side Effects

Firestore write: `COLLECTIONS.SESSIONS`, unconditional, on every call (`comunicacao/index.js:22`). `logger.info` only, no email, no calendar, no Supabase.

---

## Persistence

- **Reads:** none.
- **Writes:** `COLLECTIONS.SESSIONS` (Firestore), keyed by `session_id` (= `threadId` if given).
- **Current store:** Firestore.
- **Authoritative ownership:** the `sessions` collection is uncontested as Firestore's (no Supabase equivalent exists) — no ADR-007 conflict for this specific collection, unlike the FTR-status conflict recorded in the baseline document.

---

## Dependencies

- `parser.js` (which itself imports `ftrNormalization.js`, `documentNumbers.js`, `shipmentExtraction.js`, `changeDetection.js` — all sibling modules), `templates.js`.
- `src/services/firestore.js`.
- **Consumed by** (reverse direction): `contratos/index.js` imports `comunicacao/parser.js`'s `extractQuantityMt`/`extractGrade` directly (cross-agent sibling-module reuse, same pattern as elsewhere in this repository) — but `contratos` does not call `comunicacao`'s `process()` itself.
- `confidenceScoring.js` (`CONFIDENCE_LEVELS`/`calculateMatchConfidence`) exists as a sibling module but **is not imported by `index.js` at all** — same "implemented, tested, but not wired into the entry point" pattern found in FINANCEIRO's `alertService.js`. IMPLEMENTATION_GAP.

---

## Error Model

None. No exception is thrown for any input shape — every extraction degrades to `null`/`false`. **No error codes are invented here for completeness.**

---

## Retry Semantics

```
RETRYABLE:       UNKNOWN — no excecoes.process call exists in this component
NON_RETRYABLE:   N/A — no failure mode exists
REQUIRES_REVIEW: ftr_ambiguous: true is the closest signal, but nothing
                 consumes it within this component (see Implementation Gaps)
UNKNOWN:         everything else
```

---

## Idempotency

**Not idempotent for a repeated delivery of the same message with the same `threadId`** — see "Duplicate message" above: the Firestore write is a full overwrite (`.set()`), not a merge or reject-on-exists, so redelivery silently replaces the prior record. This is a genuine gap, not a documented, intentional design choice.

---

## Human Review / Approval

`ftr_ambiguous: true` is described (in code comments only, `parser.js:74`) as intended to route the message to "REVISÃO MANUAL" — **no code path in this component creates a manual-review queue entry** (contrast with the payment-tracking feature's `payment_manual_review` Supabase table, which IS written to by other parts of the payment-tracking flow per `docs/PAGAMENTOS_TRACKING.md`, but never by `comunicacao/index.js` itself).

---

## Security / Permissions

**DOCUMENTED — the strongest security dimension of any P0 component, 4 independent sources agree:**
- `src/middleware/webhookAuth.js:1-28` — HMAC-timing-safe shared-secret check (`X-Webhook-Secret` header vs. `WEBHOOK_SHARED_SECRET` env var), applied to every route including COMUNICACAO's two.
- `docs/ARQUITETURA.md` — names this control in its security subgraph.
- `docs/DEPLOY.md:70-78` — explains why (`--allow-unauthenticated` Cloud Run deploy, since WhatsApp/Apps Script can't mint a Google identity token) and how the secret maps to Secret Manager.
- `apps-script/gmail-sync/README.md` — documents the client-side configuration of the same secret.

---

## Audit / Observability

`logger.info` on every processed message (`comunicacao/index.js:24-28`), including `sessionId`/`intent`/`ftrCode`. No structured audit-log entry (unlike FINANCEIRO/CONTRATOS/EXCECOES, which write to `COLLECTIONS.AUDIT_LOG`) — the Firestore `sessions` write is itself the only trace of a processed message, and (per Idempotency above) can be silently overwritten.

---

## Workflow Boundary

- **Valid predecessor/event:** an inbound Gmail/WhatsApp message — this is genuinely the entry point (no predecessor within the FTR lifecycle).
- **Successful exit:** always, for any well-formed HTTP body (no code path returns a failure shape).
- **Failure exit:** none modeled (see Error Model).
- **Wait/review state:** `ftr_ambiguous: true`, informational only (see Human Review / Approval).
- **Downstream capability:** per `docs/ROADMAP.md`'s phase diagram, MASTER validates and routes next — **no verified code wiring** connects `comunicacao.process()`'s output to any subsequent `master.route()` call; this is, again, the orchestration gap already recorded in the baseline document, here specifically at the very first handoff of the entire system.

---

## ADR-001A Minimum Adapter Contract

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
**A workflow engine wrapping this component as its FTR-discovery entry point must supply its own duplicate-delivery protection** — this component's own idempotency gap (Idempotency, above) means the engine cannot assume the adapter itself prevents a duplicate session overwrite.

---

## Current Implementation Mapping

No task-suggested target progression was specified for COMUNICACAO beyond the output-contract conflict, resolved above.

## Implementation Gaps

1. Firestore session write is a full overwrite, not idempotent against redelivered messages with the same `threadId`.
2. `ftr_ambiguous: true` and the ROADMAP-described "REVISÃO MANUAL" routing have no corresponding queue/persistence.
3. `confidenceScoring.js` is implemented and tested but not imported by `index.js` — dead relative to this entry point (same pattern as FINANCEIRO's `alertService.js`).
4. No wiring exists from this component's output to any subsequent `master.route()` call — the very first handoff in the documented lifecycle has no code connecting it to the next stage.

## Open Decisions

- Should `session_id` collisions (same `threadId` redelivered) merge instead of overwrite, or should a separate dedup check reject the redelivery outright?
- Should `ftr_ambiguous`/low-confidence matches (via the unwired `confidenceScoring.js`) write to a manual-review queue, and if so, is that queue `payment_manual_review` (Supabase, currently scoped to the payment-tracking feature) or a new, general-purpose one? `DEFERRED_TO_ADR_007` for the persistence-location half of this question.

---

## Reconciliation: channel role and proposed flow

**Status:** documentary correction and technical proposal. RUNTIME_CODE establishes current behavior; BUSINESS_DECISION establishes approved intent, not implementation. `FINANCEIRO_DECISIONS.md`'s FIN-DEC-01 through FIN-DEC-21 authorize a financial confirmation, partial-payment and delivery-authorization flow for FINANCEIRO; they assign no new authority to COMUNICACAO, do not change this component's output contract, and do not approve any WhatsApp-group intake/parsing as implemented behavior.

### Authority and scope

FIN-DEC-04/05 approve a **dedicated per-operation WhatsApp group** ("grupo de WhatsApp da operação com o agente") as the confirmation channel — this is a different message source from the existing `POST /webhook-whatsapp` intake this component actually implements, which parses arbitrary inbound messages against a fixed `booking/invoice/bl_document/quote_offer/ftr_reference/unknown` intent set (Business Rules #1). None of those six intents represents "bank credit confirmation," "partial-payment authorization," "document selection," or "physical-delivery confirmation" (FIN-DEC-01/02/12/13/15/16/18/19/20/21) — `parser.js` has no code path that would classify a message into any of these. Whether the approved per-operation group is meant to be additional traffic through this same webhook/parser, or an entirely separate integration, is not established by any FIN-DEC record or by this component's code.

**Necessary but not sufficient (same correction as FINANCEIRO.md/QUALIDADE.md):** even where this component's existing pattern could be extended — regex/keyword classification returning `null` on non-match — a keyword match (e.g. a message containing "confirmado") is not, by itself, the affirmative, version-bound confirmation FIN-DEC-01/02/13 require. `parser.js`'s functions are deliberately non-committal (Business Rules #4, "never invent missing information") but they are also not built to distinguish an affirmative reply from a negative or ambiguous one — that distinction does not exist anywhere in this component today, for any intent.

### Statelessness and order independence

Every `process()` call handles one message in isolation; nothing in this component correlates a reply back to a specific outstanding request, waits for a second, independent signal, or tracks whether a confirmation or a document selection is still pending. The corrected design in `FINANCEIRO.md`'s "Approved Confirmation & Release Flow" requires exactly that — receiving confirmation and selection in either order and dispatching only once both are present — and that coordination cannot live in this component as currently built: `session_id` keys one *message's* persisted record, not one *pending request's* aggregate state. This is not a defect in the existing contract (COMUNICACAO was never designed to hold multi-message state); it is a scope boundary this reconciliation makes explicit rather than blurring.

### Sending is out of scope today

FIN-DEC-08/09/10/17 approve a single authorization dispatched via two channels (email and WhatsApp) with a shared identifier and per-channel/recipient delivery tracking. This component has no outbound send path at all: `response_template` is described in its own Authority Boundary as "a suggested acknowledgment, not sent by this component itself" — the same gap (computed text, no dispatch) would apply to any notification COMUNICACAO might eventually be asked to carry. No FIN-DEC record assigns COMUNICACAO the sending role, and this document does not assume it either.

### Proposed technical division (PROPOSAL — not approved, not implemented)

Consistent with the same proposal already recorded in `FINANCEIRO.md`, `COMPLIANCE.md` and `QUALIDADE.md`: COMUNICACAO would handle channel transport, sender-identity capture, reply-to-message binding and message normalization for the approved WhatsApp group, **without** itself deciding whether a classified message satisfies the financial gate; FINANCEIRO would interpret the resulting structured event in business terms and compute `release_flag`; the durable orchestrator would coordinate the wait for both independent signals (confirmation, selection) and sequence the authorization dispatch. This is a technical proposal, not an implemented workflow or a change in any component's existing authority — COMUNICACAO's `MAY_NOT_DECIDE` boundary (which FTR a message belongs to when ambiguous) would extend, under this proposal, to also not deciding whether a classified reply satisfies FINANCEIRO's gate.

### Open business decisions

- Whether the per-operation WhatsApp group (FIN-DEC-04/05/18) is served by this component at all, by a new dedicated integration, or by an extension of the existing `/webhook-whatsapp` route — not decided.
- Retention policy for confirmation/selection/delivery messages and their metadata (FIN-DEC-14/20 leave this "a definir").
- Whether COMUNICACAO is ever asked to carry outbound notifications (authorization, delivery confirmation acknowledgment) — not requested by any FIN-DEC record.

### Technical work pending

An intent/classification path (or a separate module) for confirmation/negative/ambiguous, partial-payment wording, document selection, and physical-delivery confirmation; a correlation mechanism binding a reply to a specific pending request/version, independent of `session_id`'s per-message scope; identity binding beyond WhatsApp display name (same gap recorded in `FINANCEIRO.md`); resolving whether the existing Firestore-overwrite idempotency gap (Implementation Gap #1 above) is acceptable for confirmation-carrying messages, where a silent overwrite would be materially worse than for a generic intake message.

### Proposed acceptance criteria — not executed

1. A message that merely contains a confirmation-shaped keyword, without being bound to the correct pending request/version, must not be classified as a valid confirmation.
2. A negative, doubtful, or textually ambiguous reply must be classified distinctly from an affirmative one — not collapsed into a generic "unknown" intent that a downstream consumer might misinterpret as silence.
3. Confirmation-shaped and selection-shaped messages for the same operation, received in either order, must both be preserved and correlated to the same pending request — neither is discarded because it arrived "out of sequence."
4. A duplicate delivery of the same confirmation/selection/delivery message (same `threadId` or equivalent) must not silently overwrite a distinct, later message for the same operation the way today's unconditional `.set()` does (Idempotency, above).
5. If this component is ever wired to send notifications, channel failure must be tracked per channel/recipient and must not be conflated with the underlying business decision succeeding or failing.

Evidence: `src/agents/comunicacao/index.js`, `parser.js` and `ftrNormalization.js` were reread for this revision. No runtime, test, or webhook configuration was changed or executed.

---

## Evidence Index

| Claim | File | Symbol/Lines | Type |
|---|---|---|---|
| FTR-gate exemption + rationale | `src/orchestrator/master.js` | 62-66 | RUNTIME_CODE |
| Live HTTP routes | `src/routes/index.js` | 46-70 | RUNTIME_CODE |
| Legacy documented output shape | `docs/ROADMAP.md` | 127 | ROADMAP |
| Current runtime output shape | `src/agents/comunicacao/index.js` | 30-35 | RUNTIME_CODE |
| Full parsed-field shape | `src/agents/comunicacao/parser.js` | 76-107 | RUNTIME_CODE |
| Test-anchored fields only | `src/agents/comunicacao/index.test.js` | 19-48 | TEST |
| FTR canonical shape (3 sources) | `src/agents/comunicacao/ftrNormalization.js`, `config/schemas.json`, `supabase/migrations/0001_init_schema.sql` | 1-8 (ftrNormalization.js) | RUNTIME_CODE + CONFIGURATION |
| Ambiguity never silently resolved | `src/agents/comunicacao/ftrNormalization.js` | 47-60 | RUNTIME_CODE |
| Never invent missing info | `src/agents/comunicacao/shipmentExtraction.js` | 1-5 | RUNTIME_CODE |
| Webhook secret control (4 sources) | `src/middleware/webhookAuth.js`, `docs/ARQUITETURA.md`, `docs/DEPLOY.md:70-78`, `apps-script/gmail-sync/README.md` | 1-28 (webhookAuth.js) | RUNTIME_CODE + ARCHITECTURE_DOCUMENTATION ×2 + COMPONENT_DOCUMENTATION |
| `confidenceScoring.js` unwired | `src/agents/comunicacao/index.js` | 1-6 (import list, absence of confidenceScoring) | RUNTIME_CODE |
| Cross-agent reuse of parser.js | `src/agents/contratos/parser.js` | 1 | RUNTIME_CODE |
| Approved financial confirmation/delivery flow, FIN-DEC-01 through FIN-DEC-21 (no channel-handling authority assigned to COMUNICACAO) | `docs/contracts/FINANCEIRO_DECISIONS.md` | full document, dated 2026-09-21 | BUSINESS_DECISION |
