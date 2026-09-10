# CURRENT_REPOSITORY_FACTUAL_BASELINE

**Status:** FROZEN — factual evidence baseline only. No architectural decision is made or implied by this document.
**Scope:** Verifiable facts about the repository as it exists at the time of writing. Line numbers below were read directly from the current repository state; none are invented. Where a line range would be unstable (e.g. inside a long prose document where minor edits shift line numbers without changing meaning), the citation uses `symbol/section` instead of a line range, and this is noted explicitly.
**Non-goals:** Not a PoC. Not a migration plan. Not a directory refactor. Not a decision on ADR-001A, ADR-001B, or ADR-007.

## Evidence classification legend

Every evidence entry below is tagged with one of:

```
RUNTIME_CODE            — executable src/ code, proves what actually runs
TEST                     — test files, proves what behavior is actually exercised
CONFIGURATION            — config/env files, proves what is declared, not what runs
ARCHITECTURE_DOCUMENTATION — docs/*.md diagrams and prose describing intended design
PRD                      — docs/RDIA_PRD.md
ROADMAP                  — docs/ROADMAP.md
```

**Conflict rule applied throughout this document:**
```
RUNTIME_CODE > TEST > CONFIGURATION > ARCHITECTURE_DOCUMENTATION > PRD/ROADMAP
```
Where a conflict between sources was found, it is recorded under "CONFLICT" — never silently reconciled.

---

## 1. Current AI/LLM State

**Claim:** No active LLM execution exists in `src/`. The `src/agents/*` directory name is historical and does not by itself indicate LLM-based agent behavior.

Evidence:
- Repo-wide search of `src/` for `anthropic|openai|gpt-|claude-|LLM` (case-insensitive) returns zero executable matches.
  type: RUNTIME_CODE

- file: `.env.example`
  symbol: `ANTHROPIC_API_KEY`
  lines: 11-12
  content: `# Anthropic API` / `ANTHROPIC_API_KEY=` (declared, empty)
  type: CONFIGURATION

- file: `src/config.js`
  symbol: `CONFIG` (module export)
  lines: 10-35
  content: only keys present are `TIMEZONE`, `ALERT_RECIPIENTS`, `TEST_MODE`, `DIGITALIZACAO.CONFIDENCE_AUTO_ACCEPT` (line 31), `DIGITALIZACAO.CONFIDENCE_ACCEPT_FLAGGED` (line 32), `DIGITALIZACAO.CONFIDENCE_REVIEW_REQUIRED` (line 33). No LLM client, key, or model identifier.
  type: RUNTIME_CODE

- file: `src/agents/digitalizacao/docClassifier.js`
  symbol: `DOC_TYPE_KEYWORDS`, `classifyDocument`
  lines: 4 (keyword table start), 25-45 (function body)
  content: document classification is keyword-substring matching against filename+text; confidence formula is `Math.min(0.95, 0.5 + bestScore * 0.25)` for heuristic matches, `0.9` for a caller-supplied `docTypeHint`. No model/vision call at this decision point.
  type: RUNTIME_CODE

- file: `docs/ROADMAP.md`
  lines: 107, 351
  content: `Armazenar: Anthropic API key, Bank credentials, WhatsApp webhook secret` / `` `francfort-anthropic-api-key` (rotate monthly) ``
  type: ROADMAP
  note: these are Secret Manager provisioning checklist items, not evidence of consumption.

- file: `docs/RDIA_PRD.md`
  section: §17 "Política de baixo custo"
  content: pipeline stages 1-3 (Cache/Parser/Regex) marked implemented; stage 4 (PaddleOCR) marked "chunk 2a, planejado"; stages 5-7 (modelo leve, small LLM, large LLM) stated verbatim as *"não estão no plano atual"*.
  type: PRD

**Conclusion:** RUNTIME_CODE and CONFIGURATION agree — no LLM execution path exists. PRD confirms this is intentional design, not an oversight. No conflict found on this point.

---

## 2. Persistence Baseline

**Claim:** Firestore + Supabase dual-database use is intentional architecture, documented as such, not an in-progress migration.

Evidence:
- file: `docs/FIRESTORE_SUPABASE.md`
  lines: 5 (`## 🎯 DECISÃO ARQUITETURAL`), 9 (`**Firestore** = Cache + Working Memory (EPHEMERAL)`), 16 (`**Supabase PostgreSQL** = Permanent Records (PERSISTENT)`), 657 (`## 🚀 MIGRATION STRATEGY (Day 1)` — describes provisioning both stores from day one, not a cutover)
  type: ARCHITECTURE_DOCUMENTATION

- file: `src/services/firestore.js`
  symbol: `COLLECTIONS`
  lines: 8-14
  content: `SESSIONS` (9), `AUDIT_LOG` (12), `FALHAS_PROCESSAMENTO` (14), plus `FTR_PROCESSING`, `BOOKING_DRAFT`, `TEMP_DOCUMENTS` (not individually re-verified by line here, present in same object)
  type: RUNTIME_CODE

- file: `src/services/supabase.js`
  symbol: `TABLES`
  lines: 5-14
  content: `FTR` (6), `CUSTOMERS` (7), ... `DOCUMENT_RELATIONSHIPS` (14)
  type: RUNTIME_CODE

- Runtime consumption confirmed for both stores (RUNTIME_CODE):
  - Firestore writes: `src/agents/comunicacao/index.js` (session write), `src/agents/contratos/index.js` (audit on amendment), `src/agents/excecoes/index.js` (audit + DLQ), `src/agents/financeiro/index.js` (audit on release), `src/agents/qualidade/index.js` (buyer-approval session).
  - Supabase reads/writes: `src/agents/monitor/kpiQueries.js`, `src/agents/comercial/pricingLookup.js`, `src/agents/digitalizacao/crossValidation.js`, `src/agents/digitalizacao/entityResolution.js`.

**CONFLICT (documented, not reconciled):** `docs/FIRESTORE_SUPABASE.md` (ARCHITECTURE_DOCUMENTATION) describes an FTR's workflow status as living in Firestore's `ftr_processing.current_status` field, while `src/orchestrator/master.js` (RUNTIME_CODE) defines a separate `FTR_STATUS` constant (lines 30-35: `EM_ANALISE`, `APROVACAO`, `EM_REVISAO`, `FINAL`) mapping to the same conceptual FTR status, evidently intended for the Supabase `ftr.status` field (`src/services/supabase.js` `TABLES.FTR`). No RUNTIME_CODE or TEST evidence was found reconciling these two status fields for the same FTR. This is exactly the dual-authority ambiguity ADR-007 is scoped to resolve — recorded here, not resolved.

---

## 3. Production Entry Points

Evidence — all six live routes:
- file: `src/routes/index.js`
  lines: 10, 12 (`POST /digest` → `targetAgent: 'monitor'`)
  lines: 19, 21 (`POST /classificar-doc` → `targetAgent: 'documentacao'`)
  lines: 28, 30 (`POST /digitalizar-doc` → `targetAgent: 'digitalizacao'`)
  lines: 37, 39 (`GET /rastrear` → `targetAgent: 'logistics'`)
  lines: 46, 48 (`POST /webhook-whatsapp` → `targetAgent: 'comunicacao'`, `channel: 'whatsapp'`)
  lines: 55, 65 (`POST /webhook-gmail` → `targetAgent: 'comunicacao'`, `channel: 'gmail'`)
  type: RUNTIME_CODE

**ENTRY POINT A — COMUNICACAO**
- Role (RUNTIME_CODE, inferred from `src/agents/comunicacao/index.js`): message ingestion, structural parsing (`parseMessage`), FTR identification, normalization.
- Evidence for FTR-gate exemption:
  file: `src/orchestrator/master.js`
  symbol: `AGENTS_WITHOUT_FTR_GATE`
  line: 66
  content: `new Set(['comunicacao', 'monitor'])`
  type: RUNTIME_CODE
  comment (same file, lines 62-65, RUNTIME_CODE inline comment): states the reason — comunicacao extracts the FTR code from raw text and has none yet to gate on.

**ENTRY POINT B — DIGITALIZACAO**
- Role (RUNTIME_CODE): document intelligence pipeline, `src/agents/digitalizacao/index.js`.
- Evidence it is NOT exempt from the FTR gate: `'digitalizacao'` is absent from the `AGENTS_WITHOUT_FTR_GATE` set (`master.js:66`); `process(context)` (`digitalizacao/index.js:85` per prior read) destructures `ftrCode` directly from the caller-supplied context, consistent with `master.js`'s `isValidFtr()` check (line 58) applying to it.
  type: RUNTIME_CODE
- Evidence `ROUTED_TO_BY_DOC_TYPE` is intent-only, not executed dispatch:
  file: `src/agents/digitalizacao/index.js`
  symbol: `ROUTED_TO_BY_DOC_TYPE`
  lines: 21-31 (object definition), preceded by an inline comment at lines 16-20 stating: *"Informational only — DIGITALIZACAO never calls these agents itself... The caller uses this to decide the next master.route() call, once this one has returned and released its lock."*
  Consumption: line 179 (`routed_to: classification.docType ? ROUTED_TO_BY_DOC_TYPE[classification.docType] || null : null`) only assigns the map's value into the returned result object — no call follows.
  type: RUNTIME_CODE

**Note:** Do not force all FTR workflows to begin through COMUNICACAO — DIGITALIZACAO is a second, parallel production entry point, conditioned on the caller already supplying a valid `ftrCode`.

---

## 4. Production Orchestration Gap

**Claim:** `master.js` is a stateless per-call router with a concurrency mutex. It is not a durable workflow engine. No production mechanism performs automatic phase sequencing, durable state persistence, wait/resume, or crash recovery across agent calls.

Evidence:
- file: `src/orchestrator/master.js`
  symbol: `route`
  lines: 68-89 (per prior full read; grep-confirmed anchor lines: `68` `async function route(message) {`, `75` FTR-gate-exemption check, `80` `isValidFtr` check)
  content: resolves `AGENTS[message.targetAgent]`, checks FTR gate, acquires `withFtrLock`, calls `agent.process(message)` exactly once, returns its result. No loop, no phase-transition logic, no external persistence of "what phase this FTR is in."
  type: RUNTIME_CODE

- file: `src/orchestrator/master.js`
  symbol: `withFtrLock`, `ftrLocks`
  lines: 38 (`const ftrLocks = new Map();`), 40-56 (per prior full read)
  content: in-memory `Map`-based Promise-chaining mutex, scoped to the Node process; explicitly NOT durable (lost on process restart, not shared across Cloud Run instances).
  type: RUNTIME_CODE

- Cross-agent calls verified to be **direct module-level function imports**, not `master.route()` invocations, and none of them decide "what workflow phase comes next":
  - `src/agents/digitalizacao/index.js:3-4` → `require('../excecoes')`, `require('../excecoes/backoff')`
  - `src/agents/digitalizacao/crossValidation.js:2-4` → `require('../compliance/marketRequirements')`, `require('../compliance/aflatoxinCheck')`, `require('../qualidade/accreditedLabs')`
  - `src/agents/qualidade/index.js:6-7` → same two `compliance/` imports
  - `src/agents/contratos/index.js` → `require('../comercial/pricing')`, `require('../comunicacao/parser')` (per prior read)
  - `src/agents/financeiro/index.js` → `require('../contratos/auditTrail')` (per prior read)
  type: RUNTIME_CODE

- file: `test/integration/ftr-end-to-end.test.js`
  symbol: `targetAgent` (13 occurrences)
  lines: 56, 68, 83, 95, 105, 118, 137, 146, 156, 166, 179, 189, 201
  content: the only place the full ordered sequence (comunicacao → comercial → contratos → compliance → logistics → documentacao ×2 → qualidade ×2 → financeiro → comissoes → monitor → excecoes) is exercised — each step is a separate, manually-sequenced `master.route()` call written into the test, not driven by production code.
  type: TEST

- file: `docs/ARQUITETURA.md`
  content: Mermaid diagram edges (e.g. `MASTER --> |FTR valid| CONTRATOS`) encode the intended sequence as a diagram, not executable code.
  type: ARCHITECTURE_DOCUMENTATION

- file: `docs/RDIA_PRD.md`
  section: §14
  content: *"hoje não existe event bus... master.route() é uma chamada síncrona request/response."*
  type: PRD

**Conclusion:** RUNTIME_CODE, TEST, and PRD all agree: no durable orchestration exists in production. ARCHITECTURE_DOCUMENTATION describes the intended sequence but does not implement it — not a conflict, since the diagram never claimed to be executable.

---

## 5. EXCECOES — Layer 0 Resilience

**Claim:** EXCECOES is a transversal resilience component, not a sequential FTR lifecycle phase, and not an LLM agent.

Evidence:
- file: `src/agents/excecoes/index.js`
  symbol: `process`
  lines: 65 total lines in file
  branch 1 — line 10: `if (context.action === 'override')`; audit write at line 12 (`COLLECTIONS.AUDIT_LOG`)
  branch 2 — line 17: `if (context.action === 'record_failure')`; retry check line 20 (`shouldRetry(retryCount)`), delay line 21 (`getBackoffDelayMs(retryCount)`); DLQ build line 31 (`buildDlqEntry`), DLQ write line 38 (`COLLECTIONS.FALHAS_PROCESSAMENTO`)
  fallback — line 61: `logger.warn('Exceção de roteamento recebida', context)` for `unknown_agent`/`invalid_ftr` cases reported by the orchestrator
  type: RUNTIME_CODE

- file: `src/agents/excecoes/backoff.js`
  symbol: `BACKOFF_SCHEDULE_MS`, `MAX_RETRIES`, `shouldRetry`, `getBackoffDelayMs`
  lines: 2 (`[1000, 5000, 30000, 5 * 60 * 1000, 30 * 60 * 1000]`), 3 (`MAX_RETRIES = 3`), 5-8, 10-12
  type: RUNTIME_CODE

- Two distinct call paths confirming its transversal position (both RUNTIME_CODE):
  - Called directly by the orchestrator on routing failure — no `.test.js` line needed here, this is the same `master.js` `route()` function cited in §4, which calls `AGENTS.excecoes.process(...)` on the unknown-agent/invalid-FTR branches (not routed through `withFtrLock`).
  - Called directly by another domain component as a plain library import — `src/agents/digitalizacao/index.js:3` (`const excecoes = require('../excecoes')`), invoked at `escalate()` (line 44), with an inline comment (lines 39-43) explaining that re-running the same document would reproduce the same failure, so `retryCount: MAX_RETRIES` is passed to short-circuit straight to DLQ.

- No HTTP route targets `excecoes` directly — absent from `src/routes/index.js` (§3 evidence covers all 6 existing routes; none target `excecoes`).
  type: RUNTIME_CODE (absence verified by full-file review)

**Conclusion:** No conflicting evidence found. EXCECOES's dual invocation pattern (orchestrator-internal + agent-to-agent direct call) is consistent across all sources checked.

---

## 6. MONITOR KPI Producer Gap

Evidence:
- file: `src/agents/monitor/index.js`
  lines: 2 (import), 8-11 (`Promise.all([countFtrsInAnalysis(), getFinalizedFtrsLast7Days(), getAverageCycleDays()])`)
  content: 3 KPI families with an internal Supabase-backed producer.
  type: RUNTIME_CODE

- file: `src/agents/monitor/kpiQueries.js`
  symbol: `countFtrsInAnalysis` (line 6), `getFinalizedFtrsLast7Days` (line 18), `getAverageCycleDays` (line 32)
  content: direct `supabase.from(TABLES.FTR)` queries.
  type: RUNTIME_CODE

- file: `src/agents/monitor/index.js`
  lines: 14 (`calculatePercentage(context.paymentsOnTime, context.paymentsTotal)`), 15 (`calculatePercentage(context.docsOnTime, context.docsTotal)`), 16 (`calculatePercentage(context.agentErrors, context.agentCalls)`)
  content: 3 additional KPI families computed purely from `context` fields; no internal producer exists for them in this file or in `kpiQueries.js`.
  type: RUNTIME_CODE

- file: `src/routes/index.js`
  lines: 10, 12
  content: `POST /digest` forwards `req.body` verbatim as the routed message (`{ ...req.body, targetAgent: 'monitor' }`); no transformation adds `paymentsOnTime`/`docsOnTime`/`agentErrors` or their `*Total`/`*Calls` counterparts.
  type: RUNTIME_CODE

- Repo-wide search for `paymentsOnTime|paymentsTotal|docsOnTime|docsTotal|agentErrors|agentCalls` outside `monitor/` finds no producer.
  type: RUNTIME_CODE (absence)

- file: `src/agents/monitor/kpiQueries.js`
  note: no matching `kpiQueries.test.js` exists in `src/agents/monitor/` (confirmed against directory listing — `dashboard.test.js`, `index.test.js`, `slaCalculations.test.js` exist; `kpiQueries.test.js` does not). This is the only module in `monitor/` doing live external I/O and the only one without test coverage.
  type: TEST (absence)

**Classification:** `paymentsOnTime/paymentsTotal`, `docsOnTime/docsTotal`, `agentErrors/agentCalls` = **DATA PRODUCER MISSING / INCOMPLETE**.

**Architectural issue recorded (tracking only, no implementation authorized):**
```
MONITOR-KPI-PRODUCER-GAP
No verified production component populates paymentsOnTime/paymentsTotal,
docsOnTime/docsTotal, or agentErrors/agentCalls before POST /digest is
invoked. These fields are silently undefined in the current call path.
```

---

## 7. COMPLIANCE / QUALIDADE Boundary

**Claim:** QUALIDADE (upstream quality-data interpretation) and COMPLIANCE (downstream regulatory rule/gate) share a threshold function by direct reuse, not by duplicated/competing logic.

Evidence:
- file: `src/agents/qualidade/index.js`
  lines: 6 (`const { getAflatoxinLimitPpb } = require('../compliance/marketRequirements');`), 7 (`const { isAflatoxinWithinLimit } = require('../compliance/aflatoxinCheck');`)
  type: RUNTIME_CODE

- file: `src/agents/compliance/index.js`
  lines: 9 (`const { ftrCode, market, labResultPpb, presentDocuments, expiryDates } = context;`), 14-15 (`result_ppb: labResultPpb ?? null`, `within_limit: isAflatoxinWithinLimit(...)`), 18 (`buildComplianceChecklist(market, presentDocuments)`), 38 (`alerts.filter((alert) => alert.needs_alert)`)
  content: COMPLIANCE receives `labResultPpb` as an already-known input — it does not extract it. Its own, non-shared responsibilities: document checklist per market and expiry-alert calendar.
  type: RUNTIME_CODE

- file: `src/agents/qualidade/index.js`
  lines: 12 (`if (context.action === 'buyer_approval')`), 15 (`.collection(COLLECTIONS.SESSIONS)`)
  content: QUALIDADE's own, non-shared responsibilities: filename/report parsing (`filenameParser.js`, `labReportParser.js`), accredited-lab check (`accreditedLabs.js`), and a distinct buyer-approval workflow persisted to Firestore. None of this exists in `compliance/`.
  type: RUNTIME_CODE

- file: `src/agents/digitalizacao/index.js`
  symbol: `ROUTED_TO_BY_DOC_TYPE.LabReport`
  line: 22 (`LabReport: 'qualidade',`)
  content: confirms routing *intent* sends lab reports to QUALIDADE first — consistent with the upstream framing, but per §3/§4 this is metadata only, not executed dispatch.
  type: RUNTIME_CODE

**Target authority principle (recorded as target, not verified production behavior):**
```
REGULATORY THRESHOLD SOURCE OF TRUTH = COMPLIANCE / SHARED MARKET REQUIREMENTS
```
QUALIDADE consumes the regulatory rule; it does not own a competing threshold. This is supported by the RUNTIME_CODE import direction above (qualidade → compliance, never the reverse).

**Conceptual pipeline (NOT verified as an executing chain in production — no code invokes these three in sequence; see §4):**
```
LAB DOCUMENT → DIGITALIZACAO → QUALIDADE → normalized quality result → COMPLIANCE regulatory evaluation
```

---

## 8. DIGITALIZACAO Integration Maturity

**Claim:** DIGITALIZACAO is the most internally integrated component by verified import/call count, while its downstream routing remains metadata-only.

Evidence:
- file: `src/agents/digitalizacao/index.js`
  lines: 3-4 (excecoes imports), 44 (`async function escalate`), 127 and 198 (call sites, per prior full read)
  type: RUNTIME_CODE

- file: `src/agents/digitalizacao/crossValidation.js`
  lines: 2-4 (imports from both `compliance/` and `qualidade/` in the same file — the only module in the repo confirmed to do so)
  type: RUNTIME_CODE

- file: `src/agents/digitalizacao/docClassifier.js`
  lines: 4, 25-45 (classification/confidence logic, §1)
  consumed at: `src/agents/digitalizacao/index.js` (per prior read, line 132: `classifyDocument({...})`)
  type: RUNTIME_CODE

- file: `src/agents/digitalizacao/entityResolution.js`, `confidenceScoring.js`
  content: entity resolution against Supabase `document_relationships` table (`supabase/migrations/0003_digitalizacao_relationships.sql`) and 4-band confidence policy sourced from `src/config.js` lines 31-33.
  type: RUNTIME_CODE

- file: `src/agents/digitalizacao/index.js`
  symbol: `ROUTED_TO_BY_DOC_TYPE`
  lines: 16-20 (comment), 21-31 (object), 179 (consumption)
  content: reconfirmed as routing policy metadata, not dispatch — see §3.
  type: RUNTIME_CODE

- Test coverage: every module under `src/agents/digitalizacao/` (9 top-level modules + 9 `extractors/*.js` + `extractors/index.js`) has a matching `.test.js` — verified against the full directory listing gathered earlier in this session; this is the only agent directory in the repository with 100% file-level test-file parity.
  type: TEST

**Method note (applies repo-wide):** Historical folder naming under `src/agents/` is explicitly excluded as classification evidence. Only verified imports, verified I/O, and verified call graphs are used above.

---

## 9. Current FTR Lifecycle Evidence

| Stage | Component | Verified production trigger | Evidence type |
|---|---|---|---|
| Message intake / FTR discovery | comunicacao | `POST /webhook-whatsapp`, `POST /webhook-gmail` | RUNTIME_CODE |
| Document intake (parallel) | digitalizacao | `POST /digitalizar-doc` (requires FTR already known) | RUNTIME_CODE |
| Quote / pricing | comercial | none — `master.route()` only in TEST | TEST only |
| Contract parse / amendment | contratos | none — `master.route()` only in TEST | TEST only |
| Regulatory checklist / alerts | compliance | none — `master.route()` only in TEST | TEST only |
| Document generation | documentacao | `POST /classificar-doc` | RUNTIME_CODE |
| Lab result / buyer approval | qualidade | none — `master.route()` only in TEST | TEST only |
| Container/ETA tracking | logistics | `GET /rastrear` | RUNTIME_CODE |
| SWIFT / release gate | financeiro | none — `master.route()` only in TEST | TEST only |
| Commission accrual | comissoes | none — `master.route()` only in TEST | TEST only |
| KPI dashboard | monitor | `POST /digest` (with §6 gap) | RUNTIME_CODE |
| Retry/DLQ/escalation | excecoes | direct call from master.js + digitalizacao only | RUNTIME_CODE |

Evidence for the ordered sequence: `test/integration/ftr-end-to-end.test.js` lines 56-201 (§4); `docs/ARQUITETURA.md` Mermaid edges (ARCHITECTURE_DOCUMENTATION, §4). Neither is production-executing code.

**CONFLICT (documented, not reconciled):** `docs/ARQUITETURA.md` line 12 titles its agent subgraph `"🤖 CAMADA AGENTES (11 AGENTS)"` (ARCHITECTURE_DOCUMENTATION), and its diagram omits `digitalizacao` entirely. `src/orchestrator/master.js` (RUNTIME_CODE) requires and registers 12 agent modules: lines 2-13 (`require` statements) and lines 15-28 (`AGENTS` object), explicitly including `digitalizacao` (line 13 require, line 27 object entry). Per the conflict-resolution rule (RUNTIME_CODE > ARCHITECTURE_DOCUMENTATION), the factual agent count is **12**, not 11. The architecture diagram is out of date relative to the code.

**Conclusion:** 6 of 12 components have a live HTTP entry point today; 6 (`comercial`, `comissoes`, `compliance`, `contratos`, `financeiro`, `qualidade`) are reachable only via direct `master.route()` calls made by the integration test, not by any production trigger.

---

## 10. ADR-001A Implications

1. §4 establishes there is no current durable orchestrator — ADR-001A evaluates filling a verified absence, not replacing a working system.
2. The 12 domain components (§9 table) are usable as callable domain capabilities/adapters as they exist today (RUNTIME_CODE signatures unchanged).
3. §5/§6 constrain scope: EXCECOES must not be modeled as a sequential phase; MONITOR sits outside the business sequence and its producer gap is separately tracked, not solved by this baseline.
4. §1 makes zero-LLM a factual constraint, not a synthetic simplification.
5. §2's unresolved conflict (Firestore `current_status` vs. Supabase `status`/`FTR_STATUS`) means any new durably-tracked workflow state must not silently assume either field is authoritative — that is ADR-007's open question, not answered here.

---

## 11. Future ADR-001B Implications

```
CURRENT AGENT PLANE: NOT IMPLEMENTED AS ACTIVE LLM RUNTIME
```
ADR-001B, when started, evaluates whether/how to **add** an Agent/LLM Orchestration Plane on top of the domain components documented here. It does not replace an existing operational LLM agent platform — §1 confirms none exists. ADR-001B is **NOT_STARTED** as of this document (see cross-reference stub in `ADR-001A-durable-workflow-engine.md`).

---

## 12. Evidence Index

All citations above, consolidated:

| File | Symbol/Section | Lines | Type |
|---|---|---|---|
| `.env.example` | `ANTHROPIC_API_KEY` | 11-12 | CONFIGURATION |
| `src/config.js` | `CONFIG` | 10-35 | RUNTIME_CODE |
| `src/agents/digitalizacao/docClassifier.js` | `DOC_TYPE_KEYWORDS`, `classifyDocument` | 4, 25-45 | RUNTIME_CODE |
| `docs/ROADMAP.md` | Secret Manager checklist | 107, 351 | ROADMAP |
| `docs/RDIA_PRD.md` | §17, §14 | n/a (prose) | PRD |
| `docs/FIRESTORE_SUPABASE.md` | DECISÃO ARQUITETURAL / MIGRATION STRATEGY | 5, 9, 16, 657 | ARCHITECTURE_DOCUMENTATION |
| `src/services/firestore.js` | `COLLECTIONS` | 8-14 | RUNTIME_CODE |
| `src/services/supabase.js` | `TABLES` | 5-14 | RUNTIME_CODE |
| `src/orchestrator/master.js` | `FTR_STATUS` | 30-35 | RUNTIME_CODE |
| `src/routes/index.js` | 6 route handlers | 10,12,19,21,28,30,37,39,46,48,55,65 | RUNTIME_CODE |
| `src/orchestrator/master.js` | `AGENTS_WITHOUT_FTR_GATE` | 66 | RUNTIME_CODE |
| `src/orchestrator/master.js` | `route`, `isValidFtr` | 58, 68-89 | RUNTIME_CODE |
| `src/orchestrator/master.js` | `withFtrLock`, `ftrLocks` | 38, 40-56 | RUNTIME_CODE |
| `src/agents/digitalizacao/index.js` | `ROUTED_TO_BY_DOC_TYPE` | 16-31, 179 | RUNTIME_CODE |
| `src/agents/digitalizacao/index.js` | excecoes import/escalate | 3-4, 44, 127, 198 | RUNTIME_CODE |
| `test/integration/ftr-end-to-end.test.js` | `targetAgent` sequence | 56,68,83,95,105,118,137,146,156,166,179,189,201 | TEST |
| `docs/ARQUITETURA.md` | subgraph title / diagram edges | 12 | ARCHITECTURE_DOCUMENTATION |
| `src/agents/excecoes/index.js` | `process` branches | 10,12,17,20,21,31,38,61 | RUNTIME_CODE |
| `src/agents/excecoes/backoff.js` | `BACKOFF_SCHEDULE_MS`, `MAX_RETRIES` | 2,3,5-8,10-12 | RUNTIME_CODE |
| `src/agents/monitor/index.js` | KPI producer calls | 2,8-11,14-16 | RUNTIME_CODE |
| `src/agents/monitor/kpiQueries.js` | 3 producer functions | 6,18,32 | RUNTIME_CODE |
| `src/agents/qualidade/index.js` | compliance imports, buyer_approval | 6-7,12,15 | RUNTIME_CODE |
| `src/agents/compliance/index.js` | context fields, checklist, alerts | 9,14-15,18,38 | RUNTIME_CODE |
| `src/agents/digitalizacao/crossValidation.js` | compliance + qualidade imports | 2-4 | RUNTIME_CODE |
| `config/schemas.json` | file truncation | 546 (`"descriptio`, unterminated) | CONFIGURATION |

**Standing note on `config/schemas.json`:** confirmed truncated/invalid JSON — file ends mid-string at line 546 with no closing quote/braces (`wc -l` = 546, last content: `"descriptio`). Independently confirms it cannot be `require()`d at runtime; no RUNTIME_CODE anywhere in `src/` attempts to load it (verified by repo-wide search — the only two source-file matches, `src/agents/contratos/versioning.js` and `src/agents/comunicacao/ftrNormalization.js`, are code comments referencing the FTR-code regex pattern, not `require()` calls).
