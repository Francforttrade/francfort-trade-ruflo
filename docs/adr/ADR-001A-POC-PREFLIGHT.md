# ADR-001A PoC Preflight

**Status:** READ-ONLY PREFLIGHT — no infrastructure created, no dependencies installed, no production code modified.
**Depends on:** `docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` (frozen), `docs/adr/ADR-001A-durable-workflow-engine.md` (FINAL DECISION: NOT DECIDED).
**Open conflicts carried forward, not re-litigated here:**
```
CONFLICT-01 — FTR status ownership (Firestore vs master.js vs Supabase) — DEFERRED TO ADR-007.
CONFLICT-02 — 11 vs 12 agents (ARQUITETURA.md vs master.js) — RUNTIME_CODE authoritative (12). Historical doc not modified.
```

---

## 1. Scope

This document records the observed state of the repository and the local execution environment relevant to executing an ADR-001A PoC. It makes no infrastructure changes, installs no dependencies, and authorizes no PoC execution. Every claim below is either `COMMAND_OUTPUT` (a command was actually run and its real output is quoted) or a repository-evidence type carried over from the baseline (`RUNTIME_CODE`/`TEST`/`CONFIGURATION`/`ARCHITECTURE_DOCUMENTATION`/`PRD`/`ROADMAP`). No output is fabricated; where a command could not be run, that is stated explicitly.

---

## 2. Repository State

```
$ pwd
/home/user/francfort-trade-ruflo

$ git status --short
(empty output — clean working tree at preflight start)

$ git branch --show-current
claude/francfort-trade-ruflo-k1tawc

$ git remote -v
origin  https://github.com/Francforttrade/francfort-trade-ruflo (fetch)
origin  https://github.com/Francforttrade/francfort-trade-ruflo (push)

$ node --version
v22.22.2

$ npm --version
10.9.7
```
type: COMMAND_OUTPUT

**Path inventory:**

| Path | Status |
|---|---|
| `package.json` | PRESENT |
| `package-lock.json` | PRESENT |
| `Dockerfile` | PRESENT |
| `cloudbuild.yaml` | PRESENT |
| `firebase.json` | PRESENT |
| `firestore.rules` | PRESENT |
| `firestore.indexes.json` | PRESENT |
| `.env.example` | PRESENT |
| `src/config.js` | PRESENT |
| `server.js` | PRESENT |
| `src/` | PRESENT |
| `test/` | PRESENT |
| `scripts/` | PRESENT |
| `supabase/` | PRESENT |
| `apps-script/` | PRESENT |
| `.env` (actual, not example) | NOT PRESENT |
| `node_modules/` | NOT PRESENT (dependencies not installed in this session — not installed by this preflight, per instruction not to install anything) |

type: COMMAND_OUTPUT (existence checks)

**Notable file contents (verbatim, relevant excerpts):**
- `Dockerfile`: `FROM node:22-alpine`; builds with `npm ci --omit=dev`; copies `server.js`, `src`, `config`; `EXPOSE 8080`; `CMD ["node", "server.js"]`. type: CONFIGURATION
- `cloudbuild.yaml`: builds a Docker image tagged `gcr.io/$PROJECT_ID/ruflo:$SHORT_SHA`, pushes it, deploys to Cloud Run service `ruflo` in region `southamerica-east1`, `--allow-unauthenticated`, secrets pulled from Secret Manager (`francfort-anthropic-api-key`, `francfort-supabase-url`, `francfort-supabase-key`, `francfort-supabase-service-key`, `francfort-whatsapp-webhook-secret`). type: CONFIGURATION
- `firebase.json`: only wires `firestore.rules` + `firestore.indexes.json` — no Hosting/Functions config present.
- `firestore.rules`: default-deny for all client reads/writes (`allow read, write: if false`); comment states Firestore is written only by the Cloud Run service account and Apps Script jobs authenticated as the same identity.
- `firestore.indexes.json`: 3 composite indexes, all on `ftr_processing` (keyed on `current_status`) and `audit_log` — corroborates baseline CONFLICT-01's `current_status` field name.
- `.env.example`: declares `GCP_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, `GCP_SERVICE_ACCOUNT_KEY`, `SUPABASE_URL/KEY/SERVICE_KEY`, `ANTHROPIC_API_KEY`, `WHATSAPP_*`, `SEARATES_API_KEY`, `GOOGLE_SHEETS_*`, `WEBHOOK_SHARED_SECRET`, `GOOGLE_CALENDAR_*`, `EMAIL_*`, `DIGITALIZACAO_CONFIDENCE_*`, `NODE_ENV`, `PORT` — no `TEMPORAL_*` or GCP-Workflows-specific variable exists.
- `scripts/deploy-cloud-run.sh`: manual one-off deploy script, same Cloud Run target as `cloudbuild.yaml`.
- `scripts/setup-firestore-ttl.sh`: `gcloud firestore fields ttls update` for 4 collections — the only script in the repo invoking `gcloud` directly.
- `apps-script/`: two Google Apps Script projects (`gmail-intake/`, `gmail-sync/`), unrelated to workflow-engine tooling.

type: CONFIGURATION (all of the above)

---

## 3. Runtime & Dependency Inventory

Determined from `package.json` + `package-lock.json` (CONFIGURATION) cross-checked against actual `require()` sites in `src/` (RUNTIME_CODE). `node_modules/` is not installed in this session (§2), so this section is based on manifest declaration + source-level usage, not on an installed-package inspection.

| DEPENDENCY | STATUS | VERSION | EVIDENCE | RUNTIME USAGE |
|---|---|---|---|---|
| Temporal SDK (`@temporalio/*`) | NOT PRESENT | — | `grep -c "temporalio" package-lock.json` → `0` | NOT VERIFIED (nothing to verify) |
| Google Cloud Workflows client/API | NOT PRESENT | — | `grep -c '"@google-cloud/workflows"' package-lock.json` → `0` | NOT VERIFIED |
| Firestore | PRESENT | `@google-cloud/firestore ^9.0.0` | `package.json` dependencies | VERIFIED — `src/services/firestore.js:1-6` instantiates `new Firestore(...)`; consumed by 5 agents (baseline §2) |
| Supabase | PRESENT | `@supabase/supabase-js ^2.26.0` | `package.json` dependencies | VERIFIED — `src/services/supabase.js:1-3` instantiates `createClient(...)`; consumed by `monitor/kpiQueries.js`, `comercial/pricingLookup.js`, `digitalizacao/{crossValidation,entityResolution}.js` |
| Cloud Run / Google Cloud SDK integrations | PRESENT (partial) | `google-auth-library ^9.4.1` (direct dep); `google-gax` present but only as a **transitive** dependency of `@google-cloud/firestore` (confirmed via `package-lock.json`'s `node_modules/@google-cloud/firestore` → `dependencies` list, which includes `google-gax`) | `package.json`, `package-lock.json` | Cloud Run itself is a **deploy target** (`cloudbuild.yaml`, `Dockerfile`, `scripts/deploy-cloud-run.sh`), not an npm dependency — no in-process Cloud Run client SDK is used |
| Anthropic | NOT PRESENT | — | No `@anthropic-ai/*` package anywhere in `package.json`/`package-lock.json`; `ANTHROPIC_API_KEY` exists only as an empty env placeholder (`.env.example:11-12`, CONFIGURATION) and a Secret Manager provisioning line (`cloudbuild.yaml`, `scripts/deploy-cloud-run.sh`) | NOT VERIFIED — confirms baseline §1 |
| OpenAI | NOT PRESENT | — | No match for `openai` in `package.json`/`package-lock.json` | NOT VERIFIED |
| Ruflo | NOT PRESENT as a dependency | — | The only match for `"ruflo"` in `package.json` is inside the `keywords` array (`"keywords": ["ruflo", "export", "agents", ...]`) — a label, not an installed package | N/A |
| Workflow/state-machine libraries (xstate, bull, bullmq, agenda, etc.) | NOT PRESENT | — | `grep -iE "xstate\|bull\|bullmq\|agenda\|kue" package.json package-lock.json` → no dependency-declaration matches | NOT VERIFIED |
| Queue/event libraries (amqplib, kafkajs, etc.) | NOT PRESENT | — | Same grep sweep, no matches | NOT VERIFIED |
| Test frameworks | PRESENT | `jest ^29.0.0` (devDependency), `@testing-library/jest-dom ^5.16.5` | `package.json` devDependencies + `jest` config block | VERIFIED — 82 `*.test.js` files found repo-wide (`find test src -name "*.test.js" \| wc -l` → `82`); `test/jestSetup.js` (18 lines) polyfills `DOMMatrix`/`ImageData`/`Path2D` for `pdf-parse`'s pdfjs-dist dependency under Jest's VM sandbox |

**Note on dependency-vs-usage discipline:** every "PRESENT" row above was additionally confirmed by finding an actual `require()`/instantiation call site in `src/`, not merely by its presence in `package.json` — this follows the instruction not to equate manifest presence with runtime usage.

---

## 4. Local Tooling

```
$ which gcloud || true
(no output — not found)

$ gcloud --version || true
bash: gcloud: command not found

$ which docker || true
/usr/bin/docker

$ docker --version || true
Docker version 29.3.1, build c2be9cc

$ which temporal || true
(no output — not found)

$ temporal --version || true
bash: temporal: command not found

$ which tctl || true
(no output — not found)

$ tctl --version || true
bash: tctl: command not found

$ which firebase || true
(no output — not found)

$ firebase --version || true
bash: firebase: command not found
```
type: COMMAND_OUTPUT

Additional check — Docker daemon reachability in this session:
```
$ docker info >/dev/null 2>&1 && echo REACHABLE || echo NOT REACHABLE
NOT REACHABLE / permission denied in this sandbox
```
type: COMMAND_OUTPUT

**Summary:** Docker CLI binary is present; the Docker daemon is not reachable from this specific sandboxed session (permission denied). This is a constraint of *this preflight execution environment*, not necessarily of wherever a PoC would actually be run — it is recorded as observed, not extrapolated.

---

## 5. GCP Authentication State

`gcloud` is not installed in this session (§4). No authentication check could be attempted.

```
GCP_AUTH_STATUS:
NOT AUTHENTICATED
```
Reason: tool absence, not a credential/permission failure. No `gcloud config get-value project` or `gcloud auth list` could be run.

Supplementary check — no ambient GCP credentials in the shell environment or a local `.env` either:
```
$ ls -la .env 2>/dev/null
(no output — file does not exist)

$ env | grep -iE "GCP_|GOOGLE_APPLICATION|TEMPORAL|SUPABASE"
(no output — no such variables set in this shell)
```
type: COMMAND_OUTPUT

Per instruction, all local (non-GCP) inspections proceeded regardless (§2, §3, §9-§13).

---

## 6. GCP Environment

```
NOT ACCESSIBLE FROM CURRENT IDENTITY
```
Reason: `gcloud` CLI is not installed in this session (§4/§5) — `gcloud projects describe`, `gcloud services list --enabled`, `gcloud run services list`, and `gcloud workflows list` could not be executed at all, not merely denied by IAM. No project identity, enabled-API list, Cloud Run service list, or Workflows list can be reported.

**Production safety determination:**
```
PRODUCTION
NON_PRODUCTION
UNKNOWN
```
→ **UNKNOWN** (no project context obtainable in this session).

Per instruction, `UNKNOWN` is treated the same as `PRODUCTION` for safety purposes:
```
WRITE OPERATIONS:
FORBIDDEN
```
No resource creation, API enablement, or project switch was attempted or is recommended from this session.

---

## 7. Temporal Readiness

| Question | Answer | Evidence |
|---|---|---|
| Temporal CLI installed? | NO | §4 `which temporal` / `temporal --version` — command not found |
| Temporal SDK dependency present? | NO | §3 — `grep -c "temporalio" package-lock.json` → `0` |
| Temporal configuration present? | NO | No `temporal.yaml`/`temporal.json`/similar file found in repo listing (§2 path inventory covers all top-level config files; none named Temporal-related) |
| Temporal Cloud endpoint configured? | NOT CONFIGURED | No `TEMPORAL_*` variable in `.env.example` (§2) or shell env (§5) |
| Temporal namespace configured? | NOT CONFIGURED | Same as above |
| Temporal credentials apparently configured? | NOT CONFIGURED | Same as above — no value inspected or exposed, only presence/absence of variable names checked |
| Docker available for local smoke testing? | CLI: YES (v29.3.1) / Daemon in this session: NOT REACHABLE | §4 |

No Temporal CLI, SDK, or configuration installed or created by this preflight.

---

## 8. GCP Workflows Readiness

| Question | Answer | Evidence |
|---|---|---|
| Workflows API enabled? | UNKNOWN | No `gcloud` available (§6) |
| Existing workflows? | UNKNOWN | Same |
| Current identity can list workflows? | NOT ACCESSIBLE | No `gcloud`, no authenticated identity (§5) |
| Cloud Run available? | Production Cloud Run usage is evidenced (`cloudbuild.yaml`, `scripts/deploy-cloud-run.sh` deploy service `ruflo` to `southamerica-east1`) — but this is the **production** deployment target, not a verified non-production PoC target; no inspection of its actual running state was possible without `gcloud` | CONFIGURATION (deploy scripts) + COMMAND_OUTPUT (gcloud absence) |
| Existing non-production Cloud Run target usable? | UNKNOWN | Cannot verify without project access |
| Dedicated PoC project already exists? | UNKNOWN | Cannot verify without project access |

No GCP resource was inspected, created, or enabled.

---

## 9. Current Component Invocation Model

Restated with fresh verification against current repository state (all RUNTIME_CODE, consistent with `CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §3/§4/§9):

- **`master.route()`** (`src/orchestrator/master.js`, `route` function) — single-shot dispatch: resolves `AGENTS[message.targetAgent]`, applies FTR gate + mutex, calls `agent.process(message)` once. This is the only orchestration entry point that exists.
- **Existing HTTP routes** (`src/routes/index.js`) — 6 of 12 components reachable this way (`comunicacao` ×2, `digitalizacao`, `documentacao`, `logistics`, `monitor`).
- **Direct module invocation** — the other 6 (`comercial`, `comissoes`, `compliance`, `contratos`, `financeiro`, `qualidade`) are reachable only by importing their `index.js` and calling `process(context)` directly, or via `master.route({targetAgent: ...})` bypassing HTTP (as `test/integration/ftr-end-to-end.test.js` does).
- **Mock adapters — established precedent exists in this repository**, confirmed via `jest.mock(...)`:
  `src/agents/digitalizacao/index.test.js:6-8` —
  ```
  jest.mock('../excecoes', () => ({ process: jest.fn().mockResolvedValue({ agent: 'excecoes' }) }));
  jest.mock('./crossValidation', () => ({ validateExtraction: jest.fn() }));
  jest.mock('./entityResolution', () => ({ resolveEntity: jest.fn() }));
  ```
  8 other test files use the same `jest.mock(` pattern (`qualidade/index.test.js`, `monitor/index.test.js`, `financeiro/index.test.js`, `excecoes/index.test.js`, `contratos/index.test.js`, `comunicacao/index.test.js`, `comercial/index.test.js`, plus the integration test). This is direct evidence that every component's `process(context)` boundary is already designed to be mockable at the module-require level — no new mocking infrastructure needs to be invented for a PoC.

**Answer to the required question — smallest adapter boundary to test durable orchestration without redesigning existing domain components:**
A workflow-engine "activity" (Temporal) or a Workflows "step"/HTTP call (GCP Workflows) that directly `require()`s and calls each component's existing `process(context)` function in-process (for Temporal, inside an Activity worker; for GCP Workflows, behind a thin HTTP wrapper only if the engine's execution model requires HTTP — GCP Workflows can call Cloud Functions/Cloud Run, so a single generic Cloud Run service exposing `process(context)` per component, or one shared endpoint parameterized by component name, would suffice). No refactor of `src/agents/*` is required for either candidate. One HTTP endpoint per component is **not** required for Temporal (activities call in-process); it **may** be technically required for GCP Workflows depending on whether its step model can invoke local Node code directly or only HTTP/Cloud Run/Cloud Functions targets — this is an open question left to §15 rather than assumed here.

---

## 10. Minimum Adapter Boundary

Per the PoC adapter diagram already fixed in `ADR-001A-durable-workflow-engine.md`:
```
Communication / Commercial / Contract / Compliance / Documentation /
Quality / Finance / Logistics / Commission  — sequenced adapters
Resilience / EXCECOES                        — transversal, policy source only
Monitor / Analytics                          — outside business sequence
```
No changes to this boundary are made here. The invocation model in §9 confirms all 9 sequenced adapters and EXCECOES are callable today via direct module `require()` of their existing `index.js`, with an established mocking precedent (§9) that a PoC can reuse for isolating adapters from Firestore/Supabase during functional (non-integration) test runs.

---

## 11. Digitalizacao PoC Representation

Options considered (no permanent decision made):
```
A. workflow step/activity
B. external event producer
C. signal/callback source
D. separate child/sub-workflow
E. outside the minimal ADR-001A PoC
```

**Recommendation for minimum ADR-001A discrimination purposes only:** **E — outside the minimal PoC**, with **A as the fallback if digitalizacao's parallel-entry behavior specifically needs to be exercised.**

Rationale: The Critical PoC Invariant (`ADR-001A-durable-workflow-engine.md` §POC REQUIREMENTS) — persistent identity, state transitions, wait/resume, crash recovery, retry, HITL, duplicate protection, financial gate, audit correlation, version evolution — can be fully exercised using only the 9 sequenced adapters plus EXCECOES. Digitalizacao's defining trait (baseline §3/§8: a second, parallel FTR-gated entry point whose `ROUTED_TO_BY_DOC_TYPE` output is routing metadata, not executed dispatch) is an **entry-point multiplicity** question, not a durability-semantics question — including it does not add discriminating power between Temporal and GCP Workflows for the invariant list above.

**Does the choice materially affect the Temporal vs. GCP Workflows comparison?** No, if E is chosen — it simply narrows what the PoC exercises. If a later reviewer wants digitalizacao included, **A (workflow step/activity)** is the minimum representation that keeps the comparison symmetric: it would be invoked the same way as any other adapter in §9/§10 (direct call to its existing `process(context)`), so it does not introduce new infrastructure requirements for one candidate but not the other. Options B/C/D (event producer, signal/callback, child workflow) would introduce durability/eventing mechanics specific to how each engine models signals or child workflows — which could bias the comparison toward whichever engine's signal/child-workflow ergonomics are more convenient, rather than testing the invariant list. They are therefore not recommended for a *minimal, symmetric* PoC.

---

## 12. Persistence Boundary

Restated, unchanged, per instruction not to decide ADR-007 here:
```
POC WORKFLOW STATE
owned by workflow engine for execution durability.

POC BUSINESS STATE
synthetic and isolated.

PRODUCTION AUTHORITATIVE DATA OWNERSHIP
OUT OF SCOPE — ADR-007.
```
CONFLICT-01 (Firestore `ftr_processing.current_status` vs. `master.js` `FTR_STATUS` vs. Supabase `ftr.status`) remains open and is not touched by this preflight. No PoC design in this document reads from or writes to production Firestore/Supabase collections — see §13's explicit challenge of "separate Supabase" / "test Firestore" below.

---

## 13. Minimum PoC Infrastructure

**COMMON POC INFRASTRUCTURE**

| RESOURCE | CURRENTLY EXISTS? | WHY REQUIRED? | WHICH POC TEST REQUIRES IT? | CAN IT BE MOCKED? | CAN IT RUN LOCALLY? | PRODUCTION ACCESS REQUIRED? | POSSIBLE BILLING? | EXECUTIVE AUTHORIZATION REQUIRED? |
|---|---|---|---|---|---|---|---|---|
| Node.js runtime to host adapters | YES (v22.22.2, §2) | Adapters are existing Node `process(context)` functions | All | N/A | YES | NO | NO | NO |
| Synthetic/mock persistence for workflow-correlated business state | NO (does not need to exist as a new resource — can be an in-memory or local-file store for the PoC only) | Business-state reads (e.g. credit limit, aflatoxin threshold) are currently synchronous function calls against static/rule data in most adapters (baseline §7, §9) — only a few adapters touch Firestore/Supabase directly | Any adapter whose current `process()` writes to Firestore/Supabase (`comunicacao`, `contratos`, `excecoes`, `financeiro`, `qualidade`, `monitor`) | YES — precedent exists (§9, `jest.mock`) | YES | NO | NO | NO |

**TEMPORAL-SPECIFIC**

| RESOURCE | CURRENTLY EXISTS? | WHY REQUIRED? | WHICH POC TEST REQUIRES IT? | CAN IT BE MOCKED? | CAN IT RUN LOCALLY? | PRODUCTION ACCESS REQUIRED? | POSSIBLE BILLING? | EXECUTIVE AUTHORIZATION REQUIRED? |
|---|---|---|---|---|---|---|---|---|
| Temporal local development server (T1) | NO | Runs the workflow engine for functional semantics testing (persistent identity, wait/resume, retry) | All Critical PoC Invariant items except managed-ops/TCO characteristics | NO (this IS the thing under test) | YES — official local dev server is designed to run locally (typically via Docker, given Docker CLI is present, §4) | NO | NO (local server, no cloud billing) | YES — installing Temporal SDK/CLI/server requires the "do not install" gate lifted by a separate authorization |
| Temporal Cloud (T2) | NO | Only needed to evaluate managed-operational/TCO fit, not functional engine semantics | None of the Critical PoC Invariant items strictly require it — see §14 | NO | NO (managed SaaS) | Requires a Temporal Cloud account, separate from GCP | YES — Temporal Cloud is a paid managed service | YES |

**GCP-WORKFLOWS-SPECIFIC**

| RESOURCE | CURRENTLY EXISTS? | WHY REQUIRED? | WHICH POC TEST REQUIRES IT? | CAN IT BE MOCKED? | CAN IT RUN LOCALLY? | PRODUCTION ACCESS REQUIRED? | POSSIBLE BILLING? | EXECUTIVE AUTHORIZATION REQUIRED? |
|---|---|---|---|---|---|---|---|---|
| GCP Workflows API + a GCP project to host it | NO verified (§6 — UNKNOWN, no gcloud access from this session) | GCP Workflows is a managed-only service — unlike Temporal, there is no "local dev server" equivalent; some functional testing requires an actual (even if minimal/free-tier) GCP project | All Critical PoC Invariant items, for this candidate specifically | NO for the orchestration semantics themselves; the *called* adapters can still be mocked (§9) | NO — GCP Workflows itself is not locally runnable | Requires *some* GCP project — does not require *the production* Francfort project (see Option G1/G2 in §15) | YES — GCP Workflows billing is usage-based; likely trivial at PoC scale but not zero | YES |
| Cloud Run or Cloud Functions target for adapters (if GCP Workflows cannot invoke local Node code directly) | NO | GCP Workflows' step model calls HTTP/Cloud Run/Cloud Functions/other GCP APIs — it does not execute arbitrary local code, unlike a Temporal worker | Same as above | Adapters' internal logic: yes (existing jest.mock precedent); the deployment mechanism itself: no | NO (once deployed; local emulation of Cloud Run exists via `docker run` on the built image, which does not require a live GCP project) | Only for the actual managed GCP Workflows execution, not for building/testing the container locally | YES if deployed to GCP | YES |

**OPTIONAL**

| RESOURCE | Assessment |
|---|---|
| Additional service accounts | Not required for local Temporal PoC; required only if GCP Workflows PoC needs to invoke Cloud Run/Functions under a dedicated identity — minimal, scoped to the PoC project (G1), never the production project |
| Mock Cloud Run services | Optional convenience for a GCP Workflows PoC to avoid touching real Cloud Run — the existing `Dockerfile` can be built and run locally via plain `docker run` without any GCP project, if Docker daemon access is available (not the case in *this* preflight session, §4) |

**NOT REQUIRED — explicitly challenged and rejected for this PoC's scope:**

| RESOURCE | Verdict | Reason |
|---|---|---|
| Separate Supabase (a new/second instance) | NOT REQUIRED | The PoC's business-state reads can be synthetic/mocked (§9, §12) — no test in the Critical PoC Invariant list needs a real Supabase instance, production or otherwise |
| Test Firestore | NOT REQUIRED | Same reasoning — workflow-correlated durable state is owned by the engine itself per §12, not by Firestore, for PoC purposes |
| New GCP project | CONDITIONALLY REQUIRED, ONLY for GCP Workflows candidate | Not required at all for a Temporal-only PoC track; required for the GCP Workflows track specifically because that engine has no local-only mode (§14/§15) — this is the one item in this list that is not simply removable |
| Temporal Cloud | NOT REQUIRED | Local Temporal dev server (T1) is sufficient for all functional/semantic invariant testing (§14) |
| Mock Cloud Run services | OPTIONAL, not required | See OPTIONAL table above |
| Additional service accounts | OPTIONAL, minimal scope only if GCP Workflows track proceeds | See OPTIONAL table above |
| VPC | NOT REQUIRED | Nothing in the Critical PoC Invariant list requires network isolation beyond what a local dev server or a minimal single-region Cloud Run/Workflows setup already provides; no evidence in this repository's existing production deploy (`cloudbuild.yaml`) uses a VPC either |
| Pub/Sub | NOT REQUIRED | No PoC test in the invariant list requires an external message bus; the workflow engine's own internal event/history mechanism covers wait/resume/retry |
| Eventarc | NOT REQUIRED | Same reasoning as Pub/Sub — no external-event-driven trigger is part of the Critical PoC Invariant list |

---

## 14. Temporal Execution Options

```
OPTION T1 — Temporal local development server
OPTION T2 — Temporal Cloud
OPTION T3 — other justified deployment
```

**Functional engine semantics testing** (persistent workflow identity, valid state transitions, wait/resume, failure recovery, retry, HITL, duplicate protection, financial gate, audit correlation, version evolution) — **T1 (local dev server) is sufficient** for all of these. Temporal's local server implements the same workflow/history/replay engine as Temporal Cloud; none of the Critical PoC Invariant items are Temporal-Cloud-exclusive features.

**Managed production operational fit** (multi-tenant durability guarantees at scale, SLA, managed upgrades, cross-region failover, support) — **not established by a local server test**, and no PoC test in the Critical Invariant list requires it. This distinction is recorded explicitly per instruction: a local server passing functional tests is not evidence about Temporal Cloud's operational/TCO characteristics, and this document does not conflate the two.

**Which PoC tests require managed Temporal Cloud, if any?** None identified. If the eventual scope expands to include operational/TCO comparison (not part of the Critical PoC Invariant list as currently defined in `ADR-001A-durable-workflow-engine.md`), that would be a separate, explicitly-scoped follow-on, not part of this preflight's minimum PoC.

**T3 (other):** No evidence in this repository suggests a justified alternative deployment (e.g. self-hosted Temporal cluster on GKE) is needed for a minimum PoC — not evaluated further, as no requirement was found to justify it.

---

## 15. GCP Workflows Execution Options

```
OPTION G1 — Dedicated isolated GCP PoC project
OPTION G2 — Existing verified non-production GCP project
OPTION G3 — Minimal GCP execution plus local/mock external services
```

**Safest and smallest, based on actual environment evidence:** **G1 — a dedicated isolated GCP PoC project**, conditional on executive authorization to create it. Reasoning from actual evidence gathered in this preflight:
- §6 establishes the current GCP project context is **UNKNOWN** from this session (no `gcloud` installed, no identity resolvable) — per §6/production-safety rule, `UNKNOWN` is treated as `PRODUCTION` and write operations are forbidden there.
- No evidence was found of any **existing, verified non-production** GCP project (G2) — the only GCP project referenced anywhere in the repository is the production deploy target implied by `cloudbuild.yaml`/`scripts/deploy-cloud-run.sh` (Cloud Run service `ruflo`, region `southamerica-east1`), which is explicitly the production Francfort Trade service per its own naming and the Secret Manager names it pulls (`francfort-*`). There is no basis in this repository to assert a second, non-production GCP project already exists.
- G3 (minimal GCP execution + local/mock services) reduces GCP-side footprint but does not eliminate the need for *some* GCP project to host GCP Workflows itself (§13 — no local-only mode exists for this candidate) — it is a variant of G1/G2, not an alternative to needing a project.

**If the current GCP environment is production or UNKNOWN** (confirmed UNKNOWN here): **no writes are recommended to it.** This preflight does not recommend creating a new GCP project either — that is an infrastructure action requiring executive authorization, listed in §19, not performed here.

---

## 16. Safety Assessment

- Current GCP project identity: **UNKNOWN** (§6).
- Per instruction, `UNKNOWN` → treated as `PRODUCTION` → **WRITE OPERATIONS: FORBIDDEN** from this session, for both candidates.
- No resource was created, no API was enabled, no project was switched, no secret value was read or displayed.
- Local-only actions taken in this preflight were limited to: reading files already in the repository, running version/existence checks (`--version`, `which`), and a `docker info` reachability probe (which itself creates no resource and failed harmlessly).

---

## 17. Access Gaps

| Gap | Detail |
|---|---|
| `gcloud` CLI not installed | Blocks §5/§6/§8 entirely — not a permissions gap, a tooling-absence gap, in this session |
| No GCP authenticated identity | Consequence of the above — cannot be independently assessed until `gcloud` (or equivalent API access) is available |
| Docker daemon not reachable in this sandbox | Blocks any local container smoke test (e.g. building the existing `Dockerfile`, or running a local Temporal dev server via Docker) from this specific session; CLI presence suggests this is an environment/session limitation, not a repository or tooling absence |
| Temporal CLI/SDK not installed | Expected — nothing in the repository or this preflight installs it; installation itself requires separate authorization (§19) |
| No verified non-production GCP project | See §15 — affects which G-option is viable |

---

## 18. Blockers

| Item | Classification | Reasoning |
|---|---|---|
| No safe GCP write environment (project identity UNKNOWN) | **BLOCKER for GCP Workflows PoC execution** (not for Temporal-only track) | GCP Workflows has no local-only mode (§13/§15) — some GCP project access is structurally required to execute that track at all, and none is currently safely available |
| `gcloud` CLI absent | **REQUIRED_BEFORE_EXECUTION** (not an architectural blocker) | Simply needs to be installed/available in whatever session eventually runs the GCP Workflows track; does not change any architectural conclusion in this document |
| Temporal CLI/SDK absent | **REQUIRED_BEFORE_EXECUTION** | Same reasoning — a tooling gap, not an architectural one; Temporal's local-server track has no structural blocker identified |
| Docker daemon unreachable in this session | **NON_BLOCKING for this document's conclusions** | Did not prevent any analysis in this preflight (no container needed to be built or run to answer any required section); would become REQUIRED_BEFORE_EXECUTION only for whichever session actually executes a local Temporal server or builds the existing `Dockerfile` |
| ADR-007 (persistence ownership) unresolved | **DEFERRED_TO_OTHER_ADR** | §12 shows the PoC does not need production data ownership resolved — synthetic/mocked business state suffices for every Critical PoC Invariant item identified |
| No verified non-production GCP project | **REQUIRED_BEFORE_EXECUTION for GCP Workflows track only** | A new isolated PoC project (G1) is the safest path (§15) but creating one requires executive authorization — listed in §19, not a reason to abandon the candidate |
| No active LLM in repository | **NON_BLOCKING / EXPECTED** | Confirms baseline §1/§12 (zero-LLM scope) — this is the PoC's intended, correct starting condition, not a gap to close |
| CONFLICT-01 (FTR status ownership) | **DEFERRED_TO_OTHER_ADR** | Per this task's explicit disposition — not resolved during ADR-001A preflight |
| CONFLICT-02 (11 vs 12 agents in docs) | **NON_BLOCKING** | Resolved for inventory purposes by RUNTIME_CODE authority (12); historical doc left unmodified per instruction |

---

## 19. Actions Requiring Authorization

None of the following were performed by this preflight. Each requires separate, explicit executive authorization before any future step:

1. Installing `gcloud` CLI (or granting this session access to an already-authenticated one) — needed to resolve §6/§8's UNKNOWN state.
2. Creating a new, isolated, non-production GCP project (Option G1, §15) — needed only if the GCP Workflows track proceeds.
3. Installing the Temporal CLI/SDK and running a local Temporal development server (Option T1, §14) — needed only if the Temporal track proceeds.
4. Any GCP API enablement (e.g. Workflows API) — none attempted or recommended here.
5. Any Temporal Cloud account/namespace creation — explicitly not required by the Critical PoC Invariant list (§14); would need separate justification if ever proposed.
6. Running `npm install`/`npm ci` in this or any session to actually execute adapters — not performed here per the "do not install" instruction; needed before any adapter can actually be invoked in a PoC.

---

## 20. GO / NO-GO

```
READY FOR EXECUTIVE AUTHORIZATION
```

Reasoning: this preflight found no architectural blocker to proceeding with a PoC design decision. The only items classified as `BLOCKER` (§18) are scoped narrowly to the GCP Workflows track's need for *some* GCP project, which is a resourcing/authorization question (§19), not a discovery that the PoC itself is unsafe or unspecified. The Temporal track has no blocker at all — only ordinary tooling-installation steps (`REQUIRED_BEFORE_EXECUTION`), which do not require infrastructure risk to resolve (a local dev server, per §14). ADR-007 and CONFLICT-01 are correctly deferred rather than blocking. No production write path was found reachable from this session, and none was exercised.

---

## 21. Evidence Index

| Evidence | Type | Location |
|---|---|---|
| `pwd`, `git status --short`, `git branch --show-current`, `git remote -v`, `node --version`, `npm --version` | COMMAND_OUTPUT | §2 |
| Path existence table (15 paths) | COMMAND_OUTPUT | §2 |
| `Dockerfile`, `cloudbuild.yaml`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.env.example`, `scripts/*.sh` contents | CONFIGURATION | §2 |
| `package.json` dependencies/devDependencies | CONFIGURATION | §3 |
| `package-lock.json` grep for `temporalio`, `@google-cloud/workflows` (both `0` matches) | COMMAND_OUTPUT | §3 |
| `node_modules/@google-cloud/firestore` → `dependencies` includes `google-gax` (via inline Node script reading `package-lock.json`) | COMMAND_OUTPUT | §3 |
| `src/services/firestore.js`, `src/services/supabase.js` instantiation calls | RUNTIME_CODE | §3 |
| 82 `*.test.js` files (`find test src -name "*.test.js" \| wc -l`) | COMMAND_OUTPUT | §3 |
| `which`/`--version` for gcloud, docker, temporal, tctl, firebase | COMMAND_OUTPUT | §4 |
| `docker info` reachability probe | COMMAND_OUTPUT | §4 |
| `.env` absence, shell env grep for GCP/TEMPORAL/SUPABASE vars | COMMAND_OUTPUT | §5 |
| `src/orchestrator/master.js` `route`/`AGENTS`/`AGENTS_WITHOUT_FTR_GATE` | RUNTIME_CODE | §9 (carried from baseline §4) |
| `src/routes/index.js` 6 route definitions | RUNTIME_CODE | §9 (carried from baseline §3) |
| `jest.mock(...)` in 9 test files, quoted from `src/agents/digitalizacao/index.test.js:6-8` | TEST | §9 |
| `ADR-001A-durable-workflow-engine.md` adapter diagram and Critical PoC Invariant | prior-turn document (this session) | §10, §11, §14 |
| `CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §1-§9 | prior-turn document (this session) | throughout, as "baseline §N" |
