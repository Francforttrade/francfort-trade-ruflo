# CURRENT_REPOSITORY_FACTUAL_BASELINE

**Status:** FROZEN — accepted as factual evidence baseline for ADR-001A / ADR-001B / ADR-007.
**Scope:** This document records only what is verifiably true of the repository as it exists today. It makes no implementation recommendation and authorizes no code change.
**Non-goals:** Not a PoC. Not a migration plan. Not a directory refactor. Historical folder naming (`src/agents/*`) is explicitly NOT treated as architectural classification evidence — see §8/§14 method note.

---

## 1. Current AI/LLM State

```
Active LLM execution in src/: NONE

Current components under src/agents are predominantly
deterministic domain/service components despite the historical
"agent" directory/name.

ANTHROPIC_API_KEY:
placeholder/documentation only.
No active runtime consumption verified.

LLM integration:
NOT CURRENTLY SCHEDULED.

PRD defines conceptual escalation:
Cache → Parser → Regex → PaddleOCR → Lightweight Model → Small LLM → Large LLM

Only earlier deterministic/OCR stages are currently planned.
Small/Large LLM stages are not part of the current implementation plan.
```

**Evidence:**
- Repo-wide search for `anthropic|openai|gpt-|claude-|LLM` under `src/` returns zero executable matches (only the two `.env.example` occurrences below).
- `.env.example:11-12` — `# Anthropic API` / `ANTHROPIC_API_KEY=` — declared, empty, never read.
- `src/config.js:1-38` — the single centralized config object (`CONFIG`); contains `TIMEZONE`, `ALERT_RECIPIENTS`, `TEST_MODE`, `DIGITALIZACAO.CONFIDENCE_*`. No key, model name, or LLM client of any kind.
- `docs/RDIA_PRD.md` §17 ("Política de baixo custo"): pipeline degraus 1-3 marked implemented; degrau 4 (PaddleOCR) marked "chunk 2a, planejado"; degraus 5-7 (modelo leve, small LLM, large LLM) marked verbatim: *"não estão no plano atual"*.
- `docs/ROADMAP.md:107` and `:351` — the only two repository mentions of "Anthropic" are Secret Manager checklist items ("Armazenar: Anthropic API key" / "`francfort-anthropic-api-key` (rotate monthly)"), i.e. provisioning placeholders, not usage.
- `src/agents/digitalizacao/docClassifier.js:1-14` — classification is keyword-set matching (`DOC_TYPE_KEYWORDS`) against filename+text, confidence capped at 0.95 for heuristic match / 0.9 for caller-supplied hint. No vision/model call exists at this decision point.

**Conclusion:** Do not describe the current system as an operational LLM multi-agent system. It is a deterministic, rule/regex-based domain pipeline that happens to use the word "agent" in its directory names.

---

## 2. Persistence Baseline

```
PERSISTENCE ARCHITECTURE

Firestore + Supabase = intentional dual-database architecture.

Firestore: ephemeral/cache/workflow-supporting state according to current architecture.
Supabase: permanent/relational/append-oriented records according to current architecture.

This is NOT currently documented as a migration from one database to another.
```

**Evidence:**
- `docs/FIRESTORE_SUPABASE.md:1-22` — explicit "🎯 DECISÃO ARQUITETURAL" heading; Firestore described as "Cache + Working Memory (EPHEMERAL)" with TTL policies (3-14 days on working collections, 5 years on `audit_log`); Supabase described as "Permanent Records (PERSISTENT)", append-only, FK-constrained.
- `docs/FIRESTORE_SUPABASE.md:657-664` — "MIGRATION STRATEGY (Day 1)" section describes provisioning both stores from day one, not a cutover from one to the other.
- `src/services/firestore.js:8-15` — `COLLECTIONS` = `SESSIONS, FTR_PROCESSING, BOOKING_DRAFT, AUDIT_LOG, TEMP_DOCUMENTS, FALHAS_PROCESSAMENTO`.
- `src/services/supabase.js:5-15` — `TABLES` = `FTR, CUSTOMERS, BOOKINGS, INVOICES, PAYMENTS, BL_DOCUMENTS, COMPLIANCE_EVENTS, COMMISSIONS, DOCUMENT_RELATIONSHIPS`.
- Runtime confirmation both are live: `comunicacao/index.js:22`, `contratos/index.js:36`, `excecoes/index.js:12,38`, `financeiro/index.js:38`, `qualidade/index.js:14-17` write to Firestore; `monitor/kpiQueries.js:6-42`, `comercial/pricingLookup.js`, `digitalizacao/crossValidation.js`, `digitalizacao/entityResolution.js` read/write Supabase.

**Standing note (does not eliminate ADR-007):** This baseline records *intent*, not *ownership formalization*. ADR-007 must still define authoritative ownership per data class and prevent dual-authority ambiguity — e.g., `ftr_processing` (Firestore) and `ftr` (Supabase) both hold a `status`/`current_status` field for the same FTR with no verified reconciliation rule in code.

---

## 3. Production Entry Points

```
ENTRY POINT A — COMUNICACAO
POST /webhook-whatsapp
POST /webhook-gmail
Role: message ingestion, structural parsing, FTR identification, normalization.
COMUNICACAO is allowed to operate before FTR gate because it may be
responsible for discovering the FTR identifier.
```

```
ENTRY POINT B — DIGITALIZACAO
POST /digitalizar-doc
Role: document intelligence pipeline.
Current constraint: requires FTR context on entry because it is not exempt from FTR gate.
ROUTED_TO_BY_DOC_TYPE currently expresses routing intent only.
It does NOT execute downstream orchestration.
```

**Evidence:**
- `src/routes/index.js:46-70` — `POST /webhook-whatsapp` and `POST /webhook-gmail` both route with `targetAgent: 'comunicacao'`.
- `src/routes/index.js:28-35` — `POST /digitalizar-doc` routes with `targetAgent: 'digitalizacao'`.
- `src/orchestrator/master.js:66` — `AGENTS_WITHOUT_FTR_GATE = new Set(['comunicacao', 'monitor'])`; comment at `master.js:62-65` states the reason: comunicacao extracts the FTR code from raw text and has none yet to gate on.
- `src/agents/digitalizacao/index.js:85` — `process(context)` destructures `ftrCode` directly from input; no exemption entry exists for it in `AGENTS_WITHOUT_FTR_GATE`, so `master.route()` enforces `isValidFtr()` (`master.js:58-60`) before invoking it.
- `src/agents/digitalizacao/index.js:21-31` — `ROUTED_TO_BY_DOC_TYPE` object comment (`index.js:16-20`): *"Informational only — DIGITALIZACAO never calls these agents itself... The caller uses this to decide the next master.route() call, once this one has returned and released its lock."* Confirmed no code reads this map to invoke another agent — it is only assigned to `result.routed_to` and returned (`index.js:179`).
- Other 4 routes for completeness: `POST /digest`→monitor, `POST /classificar-doc`→documentacao, `GET /rastrear`→logistics (`routes/index.js:10-44`).

**Standing note:** Do not force all FTR workflows to begin through COMUNICACAO — DIGITALIZACAO is a second, parallel, real production entry point for documents arriving independent of email/WhatsApp (e.g. direct upload/API), provided a `ftrCode` is already known to the caller.

---

## 4. Current Orchestration Gap

```
PRODUCTION DURABLE BUSINESS ORCHESTRATION
NOT IMPLEMENTED
```

Current `master.route()` calls are isolated component invocations. No verified production mechanism automatically performs:
```
component A → evaluate result → determine next valid lifecycle transition →
invoke component B → persist durable workflow state → wait → resume → recover after crash
```

**Evidence:**
- `src/orchestrator/master.js:68-89` — `route(message)` in full: resolves `AGENTS[message.targetAgent]`, checks FTR gate, acquires `withFtrLock`, calls `agent.process(message)` once, returns its result. No loop, no state machine, no persistence of "what phase is this FTR in" beyond the transient in-memory lock (`ftrLocks` Map, `master.js:38`, cleared in the `finally` block — not durable, lost on process restart).
- `withFtrLock` (`master.js:40-56`) is a mutual-exclusion primitive (Promise chaining) to serialize concurrent calls for the same FTR — it prevents races, it does not sequence phases or decide what comes next.
- No file in `src/` calls `master.route()` from inside another agent's `process()` — cross-agent calls that do exist (`digitalizacao`→`excecoes`, `contratos`→`comercial/pricing`+`comunicacao/parser`, `financeiro`→`contratos/auditTrail`, `qualidade`→`compliance/*`) are all **direct module-level function imports**, not orchestrated `master.route()` invocations, and none of them decide "what workflow phase is next."
- The only place the full, ordered lifecycle (comunicacao→comercial→contratos→compliance→logistics→documentacao→qualidade→financeiro→comissoes→monitor→excecoes) is exercised end-to-end is `test/integration/ftr-end-to-end.test.js:56-201` — each step is a separate, manually-sequenced `master.route()` call written by the test, not driven by production code.
- `docs/ARQUITETURA.md` (Mermaid diagram) encodes the intended sequence as documentation/diagram edges (`MASTER --> |FTR valid| CONTRATOS`, etc.) — this is design documentation, not executable orchestration.
- `docs/RDIA_PRD.md` §14 confirms the same absence for the document-intelligence sub-pipeline specifically: *"hoje não existe event bus... master.route() é uma chamada síncrona request/response."*

**Conclusion:** Do not describe `master.js` as an existing durable orchestrator. It is a stateless per-call router with a concurrency mutex, not a workflow engine. ADR-001A is selecting the engine that will fill this missing capability — it is not replacing a functioning one.

---

## 5. EXCECOES Classification

```
EXCECOES
CLASSIFICATION: TRANSVERSAL RESILIENCE COMPONENT — LAYER 0
```

Responsibilities evidenced: retry decision, retry schedule, DLQ creation, escalation, manual override audit, routing failure fallback.
It is NOT a normal FTR lifecycle stage. It is NOT an LLM agent.

**Evidence:**
- `src/agents/excecoes/index.js:9-63` — three independent branches keyed on `context.action`, not on FTR lifecycle phase:
  - `action === 'override'` (`index.js:10-15`) — writes an audit entry to `COLLECTIONS.AUDIT_LOG`.
  - `action === 'record_failure'` (`index.js:17-57`) — calls `shouldRetry(retryCount)`/`getBackoffDelayMs(retryCount)` from `backoff.js:1-14` (`BACKOFF_SCHEDULE_MS = [1000, 5000, 30000, 300000, 1800000]`, `MAX_RETRIES = 3`); on retry exhaustion builds a DLQ entry (`dlqEntry.js:1-14`) written to `COLLECTIONS.FALHAS_PROCESSAMENTO`, plus an escalation message (`escalation.js`).
  - fallback (`index.js:59-62`) — logs routing failures (`unknown_agent`/`invalid_ftr`) reported by `master.js` itself.
- Called two structurally different ways, confirming its transversal position: (a) by the orchestrator directly on routing failure (`master.js:72,82` — `AGENTS.excecoes.process(...)`, bypassing `withFtrLock`), and (b) by another domain component calling it directly as a library, not via `master.route()` — `src/agents/digitalizacao/index.js:3-4,44-52` (`const excecoes = require('../excecoes')`, comment at `index.js:39-43` explains why: re-running the same document would reproduce the same result, so `retryCount: MAX_RETRIES` is passed to short-circuit straight to DLQ).
- No HTTP route targets `excecoes` directly (`src/routes/index.js` has no such entry) — it is reached only via the two call paths above, plus test harnesses (`src/agents/excecoes/index.test.js`, `master.test.js:35`).

**Standing instruction:** A future durable orchestrator may consume EXCECOES's policies/functions (backoff schedule, DLQ shape, escalation message), but EXCECOES must not be modeled as a normal sequential workflow phase/step.

---

## 6. MONITOR Data Producer Gap

```
MONITOR
CLASSIFICATION: ANALYTICS / OBSERVABILITY SERVICE
```

**Evidence:**
- `src/agents/monitor/index.js:8-12` — three KPI families have internal Supabase producers, all in `kpiQueries.js`:
  - `countFtrsInAnalysis()` (`kpiQueries.js:7-14`) — `supabase.from(TABLES.FTR).select(...).eq('status', 'Em análise')`.
  - `getFinalizedFtrsLast7Days()` (`kpiQueries.js:17-27`) — Supabase query filtered by `status = 'Final'` and `updated_at >= now-7d`.
  - `getAverageCycleDays()` (`kpiQueries.js:30-42`) — Supabase query over `created_at`/`updated_at` for `status = 'Final'` rows.
- `src/agents/monitor/index.js:14-16` — three additional KPI families are computed purely from `context` fields the caller must already supply, with no internal producer:
  - `paymentsOnTime` / `paymentsTotal` → `calculatePercentage(context.paymentsOnTime, context.paymentsTotal)`
  - `docsOnTime` / `docsTotal` → `calculatePercentage(context.docsOnTime, context.docsTotal)`
  - `agentErrors` / `agentCalls` → `calculatePercentage(context.agentErrors, context.agentCalls)`
- `src/routes/index.js:10-17` — `POST /digest` forwards `req.body` verbatim as `context` (`{ ...req.body, targetAgent: 'monitor' }`). No code anywhere in `src/` (searched across all agents/services) populates `paymentsOnTime`, `paymentsTotal`, `docsOnTime`, `docsTotal`, `agentErrors`, or `agentCalls` before this call.
- `kpiQueries.js` has no matching `.test.js` — it is the one module in `monitor/` (of 3) without test coverage, and it is also the only one doing live external I/O.

**Classification:** These three KPI families are `DATA PRODUCER MISSING / INCOMPLETE`. Per instruction, no producer is invented here.

**Architectural issue to open (tracking only, no implementation now):**
```
MONITOR-KPI-PRODUCER-GAP
paymentsOnTime/paymentsTotal, docsOnTime/docsTotal, agentErrors/agentCalls
have no verified production data producer. POST /digest silently receives
undefined for these fields today. Needs an owning decision: which
component computes and supplies them before /digest is called.
```

---

## 7. Compliance / Quality Boundary

```
QUALIDADE — upstream quality-data interpretation/validation domain
COMPLIANCE — downstream regulatory rule/gate domain
```

Current relationship includes reuse of Compliance threshold functions by Qualidade. Target authority principle:
```
REGULATORY THRESHOLD SOURCE OF TRUTH = COMPLIANCE / SHARED MARKET REQUIREMENTS
```
QUALIDADE may consume the regulatory rule. QUALIDADE must not independently own a competing threshold.

Conceptual pipeline (target, not verified end-to-end in production):
```
LAB DOCUMENT → DIGITALIZACAO → QUALIDADE → normalized quality result → COMPLIANCE regulatory evaluation
```

**Evidence:**
- `src/agents/qualidade/index.js:6-7` — imports `getAflatoxinLimitPpb` from `../compliance/marketRequirements` and `isAflatoxinWithinLimit` from `../compliance/aflatoxinCheck` directly. Confirms reuse, not a competing threshold definition — grep across `src/agents/compliance/*.js` and `src/agents/qualidade/*.js` for `aflatoxin` found the threshold logic defined once (in `compliance/`) and consumed by both.
- `src/agents/qualidade/index.js:11-38` — QUALIDADE's own responsibility: `parseLabReportFilename` (`filenameParser.js`), `isAccreditedLab` (`accreditedLabs.js`), `parseLabReportText` (`labReportParser.js`), plus a distinct `action: 'buyer_approval'` branch (`buyerApproval.js`) writing to `COLLECTIONS.SESSIONS`. None of this exists in `compliance/`.
- `src/agents/compliance/index.js:8-51` — COMPLIANCE's own responsibility, absent from `qualidade/`: `buildComplianceChecklist(market, presentDocuments)` (required-document gate per market, e.g. ACID/Import Permit), and `alert_calendar` expiry alerting (`needsExpiryAlert`/`daysUntilExpiry`). COMPLIANCE receives `labResultPpb` as an already-known input in `context` (`index.js:9`) — it does not extract it itself.
- `src/agents/digitalizacao/index.js:22` — `ROUTED_TO_BY_DOC_TYPE.LabReport = 'qualidade'` — confirms the document-intelligence pipeline's routing *intent* sends lab reports to QUALIDADE first, consistent with the "upstream" framing. As established in §4/§3, this routing map is intent metadata only — the actual dispatch is not implemented.

**Instruction compliance:** This is recorded as a conceptual target relationship, not a claim that the full automatic chain (DIGITALIZACAO → QUALIDADE → COMPLIANCE) executes today. No such chained invocation exists in `src/` — each of the three components is only ever invoked in isolation via `master.route()` or a direct module call, per §4.

---

## 8. Digitalizacao Integration Maturity

```
DIGITALIZACAO
Most internally integrated current component.

Verified relationships include:
- EXCECOES
- COMPLIANCE
- QUALIDADE
- document-type routing metadata
- confidence logic
- cross-validation
```

```
ROUTED_TO_BY_DOC_TYPE = routing policy metadata / intent
NOT = implemented durable downstream dispatch
```

**Evidence:**
- `src/agents/digitalizacao/index.js:3-4` — direct `require('../excecoes')` and `require('../excecoes/backoff')`; escalation call at `index.js:44-52` and `index.js:197-204`.
- `src/agents/digitalizacao/crossValidation.js:2-4` — imports `getAflatoxinLimitPpb`/`isAflatoxinWithinLimit` from `../compliance/*` and `isAccreditedLab` from `../qualidade/accreditedLabs` — the only module in the repo that pulls from both `compliance` and `qualidade` in the same file.
- `src/agents/digitalizacao/docClassifier.js:1-48` — classification/confidence logic (`DOC_TYPE_KEYWORDS`, `classifyDocument`), consumed by `index.js:132`.
- `src/agents/digitalizacao/entityResolution.js` and `confidenceScoring.js` — entity resolution against Supabase (`document_relationships` table, `supabase/migrations/0003_digitalizacao_relationships.sql`) and 4-band confidence policy (`confidenceScoring.js`, thresholds sourced from `src/config.js:31-33`), both invoked at `index.js:140-161`.
- `index.js:21-31` (`ROUTED_TO_BY_DOC_TYPE`) — comment block at `index.js:16-20` explicitly labels this "Informational only" for a future caller's `master.route()` decision; `index.js:179` only assigns it to the returned `result.routed_to` field — no dispatch call follows.
- Test coverage: 19/19 modules under `digitalizacao/` (including all 9 `extractors/*.js`) have a matching `.test.js` — the highest and only complete test-coverage ratio among the 12 components (cross-referenced against §"Módulos sem `.test.js`" from the prior agent-by-agent audit).

**Method note (applies repo-wide, not just to DIGITALIZACAO):** Historical folder names under `src/agents` do not determine architectural classification. Runtime behavior — verified imports, verified I/O, verified call graph — is the only classification evidence used in this document.

---

## 9. Current FTR Lifecycle Evidence

**What is verified to execute, and where:**

| Stage | Component | Verified trigger |
|---|---|---|
| Message intake / FTR discovery | `comunicacao` | `POST /webhook-whatsapp`, `POST /webhook-gmail` (production) |
| Document intake (parallel) | `digitalizacao` | `POST /digitalizar-doc` (production, requires FTR already known) |
| Quote / pricing | `comercial` | manual `master.route()` only — no production route |
| Contract parse / amendment | `contratos` | manual `master.route()` only — no production route |
| Regulatory checklist / alerts | `compliance` | manual `master.route()` only — no production route |
| Document generation (BL/CO/Phyto/Invoice) | `documentacao` | `POST /classificar-doc` (production) |
| Lab result / buyer approval | `qualidade` | manual `master.route()` only — no production route |
| Container/ETA tracking | `logistics` | `GET /rastrear` (production) |
| SWIFT / release gate | `financeiro` | manual `master.route()` only — no production route |
| Commission accrual | `comissoes` | manual `master.route()` only — no production route |
| KPI dashboard | `monitor` | `POST /digest` (production, with the gap in §6) |
| Retry/DLQ/escalation | `excecoes` | direct call from `master.js` and from `digitalizacao` only (§5) |

**Evidence for the full documented order (comunicacao → comercial → contratos → compliance → logistics → documentacao → qualidade → financeiro → comissoes → monitor, with excecoes transversal):** `test/integration/ftr-end-to-end.test.js:56-201` (each `targetAgent` call listed in that literal sequence) and `docs/ARQUITETURA.md` Mermaid edges. Neither is production-executing code — see §4.

**Conclusion:** 6 of 12 components have a live HTTP entry point in `src/routes/index.js` today; 6 do not (`comercial`, `comissoes`, `compliance`, `contratos`, `financeiro`, `qualidade`) and are reachable only through direct `master.route()` calls made by tests. This is the exact set of components a durable orchestrator would need to newly invoke in sequence — they are not currently dead code, but they are currently unreachable from any production trigger.

---

## 10. Implications for ADR-001A

1. ADR-001A is not being asked *"can Temporal/GCP Workflows replace the current orchestrator"* — §4 establishes there is no current orchestrator to replace. It is being asked whether a durable workflow engine can become the orchestration plane that fills a **verified absence**.
2. The 12 domain components (§9 table) should be treated, for PoC purposes, as callable domain capabilities/adapters as they exist today. §1/§8 confirm they are deterministic, side-effect-bearing (Firestore/Supabase/PDF/Calendar) functions — suitable as workflow activities without modification.
3. The PoC's job is proving durability properties absent today (§4): persistent workflow identity, valid state transitions, wait/resume, crash recovery, retry, HITL, duplicate protection, financial gate enforcement, audit correlation, version evolution — none of which `master.js`'s stateless per-call routing + in-memory mutex (§4) currently provides.
4. §5 and §6 are hard constraints on PoC scope: EXCECOES is consumed as a resilience *policy source*, never modeled as a sequential phase; MONITOR sits outside the business sequence entirely and its data-producer gap is out of scope for this PoC.
5. §1 makes the zero-LLM constraint a factual reflection of production, not an arbitrary test simplification (see §12 below).

---

## 11. Implications for Future ADR-001B

```
CURRENT AGENT PLANE: NOT IMPLEMENTED AS ACTIVE LLM RUNTIME
```

ADR-001B therefore evaluates whether/how to **add** an Agent/LLM Orchestration Plane on top of the domain components documented here — it is not replacing, migrating, or wrapping an existing operational LLM agent platform, because §1 confirms none exists. This document supplies ADR-001B's future starting baseline; ADR-001B itself is explicitly **not started** by this baseline update.

---

## 12. Evidence References Index

All file/line/test references cited above are repeated here for traceability:

- `src/config.js` (whole file, 38 lines)
- `.env.example:11-12`
- `docs/RDIA_PRD.md` §14, §17
- `docs/ROADMAP.md:107,351`
- `src/agents/digitalizacao/docClassifier.js` (whole file)
- `docs/FIRESTORE_SUPABASE.md:1-22, 657-664`
- `src/services/firestore.js:8-15`
- `src/services/supabase.js:5-15`
- `src/agents/comunicacao/index.js:22`, `contratos/index.js:36`, `excecoes/index.js:12,38`, `financeiro/index.js:38`, `qualidade/index.js:14-17`
- `src/agents/monitor/kpiQueries.js`, `comercial/pricingLookup.js`, `digitalizacao/crossValidation.js`, `digitalizacao/entityResolution.js`
- `src/routes/index.js` (whole file, 78 lines)
- `src/orchestrator/master.js` (whole file, 92 lines)
- `src/agents/digitalizacao/index.js` (whole file, 211 lines)
- `test/integration/ftr-end-to-end.test.js:56-201`
- `src/orchestrator/master.test.js:35`
- `src/agents/excecoes/index.js`, `backoff.js`, `dlqEntry.js`
- `src/agents/monitor/index.js`, `slaCalculations.js`
- `src/agents/qualidade/index.js`, `compliance/index.js`, `compliance/marketRequirements.js`, `compliance/aflatoxinCheck.js`
- `supabase/migrations/0003_digitalizacao_relationships.sql`
- `config/schemas.json` — noted separately: file is truncated/invalid JSON (ends mid-string at line 546), independently confirming it is never `require()`d at runtime (established in the prior audit turn of this session).
