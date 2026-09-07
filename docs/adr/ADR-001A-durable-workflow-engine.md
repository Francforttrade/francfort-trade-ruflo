# ADR-001A — Durable Business Workflow Engine PoC Specification

**Status:** DRAFT — PoC assumptions updated against `CURRENT_REPOSITORY_FACTUAL_BASELINE.md`. **Not executed. Not authorized to execute yet.**
**Depends on:** `docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` (frozen evidence baseline).
**Does not depend on / explicitly decided independently of:** ADR-001B (Agent/LLM Orchestration Plane — not started, see baseline §11).

---

## 1. Question this PoC actually answers

**Not this:**
> Can Temporal or GCP Workflows replace the current orchestrator?

There is no current durable orchestrator to replace (`CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §4). Framing it as a replacement misstates both the baseline and the decision being made.

**Actually this:**
> Can Temporal or GCP Workflows become the durable business orchestration plane that coordinates the existing deterministic Francfort domain components — a capability verified absent today?

The existing 12 domain components are treated as **callable domain capabilities/adapters as they exist today**. They are not refactored merely to make the PoC runnable. If a candidate engine cannot call a component's existing `process(context)` signature without modification, that friction is itself a PoC finding — not a license to reshape the component first.

---

## 2. Architectural separation this PoC establishes

```
DURABLE BUSINESS WORKFLOW PLANE  ≠  AGENT / LLM ORCHESTRATION PLANE
```

This is now an explicit principle, not a simplification made for test convenience. Baseline §1 confirms zero active LLM execution in production; therefore ADR-001A can be decided on its own merits, independent of whatever ADR-001B later decides about an agent/LLM plane. Nothing in this PoC's outcome should be read as a decision about ADR-001B, and ADR-001B is explicitly not started by this document.

---

## 3. PoC adapter boundary

Logical boundary only — **no repository directory migration, no module renaming, authorized by this ADR.**

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
        Resilience / EXCECOES           (policy source, never a sequential phase — baseline §5)

OUTSIDE BUSINESS SEQUENCE:
        Monitor / Analytics             (not part of the FTR execution path — baseline §6)
```

Notes:
- `digitalizacao` is intentionally not listed as a sequenced adapter in this diagram: baseline §3/§8 establish it as a second, parallel entry point (not exempt from the FTR gate) whose `ROUTED_TO_BY_DOC_TYPE` output is routing *intent*. Whether/how the PoC invokes it as an adapter, or only reads its output, is left to the candidate implementation to decide and report on — not prescribed here.
- One HTTP endpoint per adapter is **not** required unless the candidate engine's calling convention technically demands it. Default assumption: adapters are called in-process or via the engine's native activity/worker mechanism, reusing each component's existing `process(context)` export directly.

---

## 4. Critical PoC invariant

The PoC must demonstrate **one durable FTR execution** exhibiting all of:

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

Every one of these is verified absent from current production code in `CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §4 — this is precisely the gap the PoC exists to close.

---

## 5. Authority boundary — what the engine owns vs. does not own

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

Those remain explicit domain/data responsibilities, held by the existing adapters (Finance Service Adapter still owns the SWIFT/release gate logic currently in `src/agents/financeiro/releaseGate.js`; Compliance Service Adapter still owns the regulatory threshold source of truth per baseline §7; database authority remains split per the Firestore/Supabase boundary in baseline §2, pending ADR-007's formal ownership rules). The engine sequences and durably tracks calls to these authorities — it does not become a new authority itself.

---

## 6. Zero-LLM scope

```
ZERO LLM
```

This is a factual reflection of the production baseline (§1: no active LLM execution exists to test against), not merely a synthetic constraint chosen for test simplicity. The PoC introduces no LLM call, no LLM-backed adapter, and no dependency on ADR-001B's outcome.

---

## 7. Explicit non-actions for this PoC (per current authorization)

- Do NOT execute the PoC yet.
- Do NOT install dependencies.
- Do NOT provision infrastructure (Temporal cluster, GCP Workflows project config, etc.).
- Do NOT modify any file under `src/`.
- Do NOT start ADR-001B.
- Do NOT move or rename `src/agents/*` directories.
- Do NOT expose new HTTP endpoints in `src/routes/index.js` for adapter purposes unless a later, separately authorized step requires it.

---

## 8. Open evidence gaps this ADR inherits from the baseline

- `MONITOR-KPI-PRODUCER-GAP` (baseline §6) — out of scope for this PoC (Monitor is outside the business sequence), but blocks any later attempt to wire Monitor into the same durable plane until a producer decision is made.
- ADR-007 (data ownership) is not resolved by this document — the PoC must not assume a resolved answer to which store is authoritative for a given field; where the PoC needs to persist workflow-correlated business state, it should treat that as new engine-owned state, not silently write into Firestore/Supabase collections whose ownership is still open.
- `config/schemas.json` is confirmed truncated/invalid JSON (baseline §12) — it cannot be used as a machine-readable contract source for adapter payload validation in the PoC; any payload shape used by the PoC must be derived from the actual `process(context)` signatures in each component's source, not from that file.
