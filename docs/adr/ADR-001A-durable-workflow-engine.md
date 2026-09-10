# ADR-001A — Durable Business Workflow Engine

```
STATUS: POC_REQUIRED

CANDIDATES:
- Temporal — ELIGIBLE
- Google Cloud Workflows — ELIGIBLE
- Custom — CONTROL BASELINE
- Ruflo — NOT PROMOTED TO ADR-001A

WINNER:
NONE

DECISION:
NOT YET AUTHORIZED
```

**Depends on:** `docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` (frozen evidence baseline — all factual claims in this document are sourced from there; this document adds no new factual claims about the repository).

---

## Cross-references (record only — not evaluated in this document)

```
ADR-001B — Agent Orchestration Plane
STATUS: NOT_STARTED
DEPENDENCY: ADR-001A

ADR-007 — Persistence Ownership
STATUS: NOT_STARTED
NOTE: Current Firestore + Supabase dual-database architecture is factual
baseline evidence, but authoritative data ownership remains to be
formalized by ADR-007.
```

No content beyond the blocks above is authorized for ADR-001B or ADR-007 at this time. This ADR does not decide, imply, or pre-empt either.

---

## FACTUAL BASELINE

Restated from `CURRENT_REPOSITORY_FACTUAL_BASELINE.md` (see that document for full evidence citations — not repeated here to avoid drift between the two files):

- No durable business workflow orchestration exists in production (`CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §4). `src/orchestrator/master.js` is a stateless per-call router with an in-memory, non-durable mutex (`withFtrLock`, lines 38-56).
- 12 domain components exist under `src/agents/`, each exporting an `async function process(context)`. Only 6 have a live HTTP entry point in `src/routes/index.js` (baseline §3, §9); the other 6 are exercised only by `test/integration/ftr-end-to-end.test.js`.
- EXCECOES is a transversal resilience component, not a lifecycle phase (baseline §5).
- MONITOR sits outside the business sequence and has a verified data-producer gap for 3 of 6 KPI families (baseline §6).
- Zero active LLM execution exists anywhere in `src/` (baseline §1).
- Firestore/Supabase dual-database use is intentional, with one documented unreconciled status-field conflict left open for ADR-007 (baseline §2).

---

## EVALUATION EVIDENCE

This section records what is known about each candidate's *fit against the factual baseline above* — not a scored comparison, not a recommendation.

**Temporal — ELIGIBLE**
- Supports the durability properties named in the Critical PoC Invariant (below) as first-class primitives (durable workflow execution, deterministic replay, activities-as-adapters model).
- No Temporal SDK, client, or infrastructure reference exists anywhere in this repository today — eligibility is asserted on the basis of the engine's published capability model, not on any repository evidence, because no repository evidence exists yet. This absence is itself factual and is recorded, not filled in with an external claim presented as repository fact.

**Google Cloud Workflows — ELIGIBLE**
- Same status as Temporal: no reference exists in this repository. The project already runs on Google Cloud (`cloudbuild.yaml`, `firebase.json`, `@google-cloud/firestore` dependency in `package.json`) — this is a factual adjacency (existing GCP footprint), not an evaluation of fit, and is recorded as such.

**Custom — CONTROL BASELINE**
- A hand-built durability layer on top of `master.js` is included only as a control baseline for comparison. No design for this exists in the repository today.

**Ruflo — NOT PROMOTED TO ADR-001A**
- `Ruflo`/`RDIA` in this repository refers to the Rúflo Document Intelligence Agent (`docs/RDIA_PRD.md`, implemented as `src/agents/digitalizacao/`), a deterministic document-classification/extraction component, not a workflow engine. It is not a candidate for the durable-orchestration role this ADR evaluates, and is excluded from the candidate list on that basis — its own maturity is recorded separately in `CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §8.

**No PoC has been executed.** No benchmark, spike, or integration test against any candidate exists in this repository as of this document. This section will be updated with actual evaluation evidence only after a PoC is separately authorized and executed.

---

## POC REQUIREMENTS

**Question the PoC must answer** (not: *"can Temporal/GCP Workflows replace the current orchestrator"* — baseline §4 establishes there is no current orchestrator to replace):

> Can Temporal or GCP Workflows become the durable business orchestration plane coordinating the existing deterministic Francfort domain components, verified absent today?

**Adapter boundary** (logical only — no repository directory migration, no module renaming authorized by this ADR):

```
DURABLE WORKFLOW ENGINE
        │
        ├── Communication Adapter        (wraps comunicacao/process)
        ├── Commercial Service Adapter   (wraps comercial/process)
        ├── Contract Service Adapter     (wraps contratos/process)
        ├── Compliance Service Adapter   (wraps compliance/process)
        ├── Documentation Service Adapter(wraps documentacao/process)
        ├── Quality Service Adapter      (wraps qualidade/process)
        ├── Finance Service Adapter      (wraps financeiro/process)
        ├── Logistics Service Adapter    (wraps logistics/process)
        └── Commission Service Adapter   (wraps comissoes/process)

TRANSVERSAL:
        Resilience / EXCECOES           (policy source, never a sequential phase)

OUTSIDE BUSINESS SEQUENCE:
        Monitor / Analytics             (not part of the FTR execution path)
```

`digitalizacao` is deliberately not placed in this sequenced diagram: it is a second, parallel entry point (baseline §3), not exempt from the FTR gate, whose downstream routing is intent-only (baseline §3, §8). Whether/how a PoC invokes it is left to the candidate implementation to propose and report on — not prescribed here.

The 9 domain components should be treated as callable capabilities/adapters **as they exist today**; they are not refactored merely to make a PoC runnable. One HTTP endpoint per adapter is not required unless a candidate engine's calling convention technically demands it.

**Critical PoC invariant** — a PoC must demonstrate one durable FTR execution exhibiting all of:
```
persistent workflow identity
valid state transitions
wait/resume
failure recovery
retry
HITL (human-in-the-loop)
duplicate protection
financial gate
audit correlation
version evolution
```
Every one of these is verified absent from current production code (`CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §4).

**Authority boundary** — what the engine owns vs. does not own:
```
The orchestration engine owns: workflow execution durability.

The orchestration engine does NOT automatically own:
    financial authority
    compliance authority
    quality authority
    business audit authority
    database authority
    LLM authority
```
These remain explicit domain/data responsibilities held by the existing adapters (e.g. the Finance Service Adapter still owns the SWIFT/release-gate logic in `src/agents/financeiro/releaseGate.js`; database authority remains split per the Firestore/Supabase boundary pending ADR-007).

**Zero-LLM scope:**
```
ZERO LLM
```
This reflects the factual production baseline (§1 of the baseline document: no active LLM execution exists to test against) — it is not a synthetic simplification chosen for test convenience. This scoping lets ADR-001A be decided independently of ADR-001B.

**Explicit non-actions for any future PoC execution (not authorized by this document):**
- Do not execute the PoC.
- Do not install dependencies (Temporal SDK, GCP Workflows client libraries, etc.).
- Do not provision infrastructure (Temporal cluster, GCP Workflows project config, etc.).
- Do not modify any file under `src/` or `test/`.
- Do not move or rename `src/agents/*` directories.
- Do not expose new HTTP endpoints for adapter purposes unless a later, separately authorized step requires it.
- Do not start ADR-001B.
- Do not decide ADR-007.

---

## OPEN QUESTIONS

1. Which of the two eligible candidates (Temporal, GCP Workflows) better fits the existing GCP-centric deployment footprint (`cloudbuild.yaml`, Cloud Run, Firestore) — unanswered without a PoC.
2. How does a candidate engine's activity/worker model map onto the 9 adapters' existing `async function process(context)` signature without modification — unanswered without a PoC.
3. How does `digitalizacao`'s parallel-entry-point status (baseline §3) get represented in a durable workflow model — a separate workflow instance correlated to the same FTR, or a signal into an existing one? Unanswered; explicitly out of this ADR's current scope to prescribe.
4. Which store (Firestore or Supabase) becomes authoritative for durable workflow-correlated state, given the open status-field conflict recorded in baseline §2? Blocked on ADR-007, not answered here.
5. How does `MONITOR-KPI-PRODUCER-GAP` (baseline §6) get resolved before Monitor could ever be safely wired into any future orchestrated flow? Out of scope for this ADR (Monitor is outside the business sequence) but listed as a known downstream blocker.

---

## PROPOSED DECISION

Not yet formed. No PoC evidence exists (see EVALUATION EVIDENCE above — all candidates are ELIGIBLE by capability model only, none by demonstrated fit against this repository). A proposed decision requires PoC execution results, which are not authorized by this document.

---

## FINAL DECISION

```
NOT DECIDED
```
