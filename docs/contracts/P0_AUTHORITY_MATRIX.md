# P0 Cross-Component Authority Matrix

**Status:** Normative, derived from the five P0 contracts in this directory (`FINANCEIRO.md`, `COMPLIANCE.md`, `QUALIDADE.md`, `MONITOR.md`, `COMUNICACAO.md`). No cell in this matrix asserts ownership beyond what those documents individually establish from repository evidence — where no component of the five holds real authority (the decision belongs to a component outside this P0 set, to an unmodeled human process, or to an unresolved cross-cutting ADR), the cell says so rather than defaulting to whichever component merely touches the data.

**Legend:**
```
AUTHORITATIVE  — this component is the designed, sole owner of the decision/
                 computation, independent of how complete its current
                 implementation is (implementation gaps are tracked in the
                 component's own contract, not reflected as a lesser value here)
PRODUCER       — this component generates/supplies the underlying data or
                 artifact, without itself holding decision authority over it
CONSUMER       — this component reads/uses a value whose authority lives
                 elsewhere (in or out of this P0 set)
ADVISORY       — this component produces a non-binding signal/recommendation
NONE           — this component has no verified relationship to this row
TBD_ADR_007    — persistence/authoritative-data-ownership question, open
TBD_ADR_008    — reserved value; ADR-008 is not defined or scoped anywhere in
                 this repository or in any instruction seen so far, so no
                 cell in this matrix is assigned to it — doing so would be
                 inventing a topic, which this task forbids
```

| Decision / Data | COMUNICACAO | FINANCEIRO | COMPLIANCE | QUALIDADE | MONITOR |
|---|---|---|---|---|---|
| FTR identification | PRODUCER | NONE | NONE | NONE | NONE |
| Message normalization | AUTHORITATIVE | NONE | NONE | NONE | NONE |
| Payment evidence | NONE | PRODUCER | NONE | NONE | NONE |
| Bank credit confirmation | NONE | AUTHORITATIVE¹ | NONE | NONE | NONE |
| Release eligibility | NONE | AUTHORITATIVE | NONE | NONE | NONE |
| Market requirement | NONE | NONE | AUTHORITATIVE² | CONSUMER | NONE |
| Aflatoxin evidence | NONE | NONE | CONSUMER | PRODUCER | NONE |
| Regulatory compliance (pass/fail) | NONE | NONE | AUTHORITATIVE | CONSUMER | NONE |
| Buyer quality approval | NONE | NONE | NONE | PRODUCER³ | NONE |
| KPI calculation | NONE | NONE | NONE | NONE | AUTHORITATIVE⁴ |
| Business audit | NONE | PRODUCER⁵ | NONE | NONE | NONE |
| Workflow execution state | NONE | NONE | NONE | NONE | CONSUMER⁶ |

**Footnotes (no cell above is compound — every nuance lives here, not smuggled into the table):**

1. FINANCEIRO is the *designed* authority for bank credit confirmation, but its current sole producer (`bankQuery.queryBankCreditConfirmation`) is a mock that unconditionally confirms — see `FINANCEIRO.md` Implementation Gaps #1. This cell records design intent, not evidentiary completeness.
2. COMPLIANCE's market-requirements ruleset is a source-code constant (`marketRequirements.js`), not a persisted table, despite `config/schemas.json`'s `Compliance` schema implying one. Whether it should move to persisted storage is `TBD_ADR_007` (see `COMPLIANCE.md` Persistence).
3. QUALIDADE *records* buyer approval; it does not hold decision authority over it — the actual approve/reject decision is made by an unmodeled external human process (the buyer, via a mechanism that does not exist in code anywhere — see `QUALIDADE.md` Human Review / Approval). No component in this P0 set is `AUTHORITATIVE` for this row; the true authority is outside the audited system entirely.
4. MONITOR is `AUTHORITATIVE` for the KPI-calculation function itself; 3 of its 6 required inputs have no verified producer anywhere in the repository (`MONITOR-KPI-PRODUCER-GAP`, see `MONITOR.md`). This cell records the designed computational authority, not input completeness.
5. FINANCEIRO produces one class of business-audit entry (release-document `AUDIT_LOG` writes). Overall business-audit authority spans components outside this P0 set (`CONTRATOS`, `EXCECOES` — both also write `COLLECTIONS.AUDIT_LOG`, per the repository-wide review in earlier turns of this session) — no single component in this P0 set is `AUTHORITATIVE` for the row as a whole, and this matrix does not invent one.
6. MONITOR only reads (`CONSUMER`) the Supabase `ftr.status` field via `kpiQueries.js`. Authoritative ownership of "workflow execution state" as a whole is the open conflict already recorded in `docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §2 (Firestore `ftr_processing.current_status` vs. Supabase `ftr.status` vs. `master.js`'s `FTR_STATUS` constant) — `TBD_ADR_007` at the system level, not assignable to any one of these 5 components.

---

## Authority conflicts found while building this matrix

- **None of the 5 P0 components is `AUTHORITATIVE` for "workflow execution state"** — confirming, from a different angle, the same gap the baseline document already recorded. This matrix does not resolve it; it only confirms none of these 5 falsely claims it either.
- **"Business audit" has no single P0 owner** — FINANCEIRO's `AUDIT_LOG` write is one instance of a pattern shared with two components outside this P0 set. A future durable orchestrator should not assume any single P0 adapter is the audit authority.
- **"Buyer quality approval" has no owner inside the audited system at all** — the decision-maker (the buyer) is not a component in this repository. This is the most significant authority-boundary finding in this matrix: a future workflow engine's "human-in-the-loop" step for this decision has no existing code path to attach to (see `QUALIDADE.md`).

---

## ADR-001A Minimum Adapter Contract — cross-component summary

Each P0 component's own contract document already specifies its individual `invoke(component, action, context)` shape (see each file's "ADR-001A Minimum Adapter Contract" section). This section only states the properties that hold **across** all five, derived from the individual contracts — it does not restate them.

```
invoke(component, action, context)
  → typed result   | typed failure
```

Cross-component invariants for any PoC adapter built against these five:

1. **None of the five components' `release`/`compliance`/`approval` outputs should be treated by the workflow engine as self-certifying.** Per the Authority Boundary sections in each contract, every `AUTHORITATIVE` cell above still carries either an implementation gap (FINANCEIRO's mock bank query, MONITOR's missing KPI producers) or an external unmodeled dependency (QUALIDADE's buyer decision). An adapter must surface these caveats, not hide them behind a clean typed-success result.
2. **Correlation key differs for COMUNICACAO** (`session_id`) versus the other four (`ftr_code`) — because it alone is exempt from the FTR gate. A workflow engine correlating events by `ftr_code` needs a separate mechanism to associate a COMUNICACAO session with an FTR once one is identified (per `COMUNICACAO.md`, no such mechanism exists in code today).
3. **MONITOR is out of the business sequence entirely** (per `docs/adr/ADR-001A-durable-workflow-engine.md`'s adapter diagram, reaffirmed by `MONITOR.md`) — it is not a step any FTR workflow instance would invoke as part of its own execution; it is an external, read-only reporting surface over whatever workflow state exists.
4. **No component among these five calls another via `master.route()`** — every existing cross-component reference (QUALIDADE→COMPLIANCE, DIGITALIZACAO→COMPLIANCE/QUALIDADE, FINANCEIRO→CONTRATOS) is a direct sibling-module function import, not an orchestrated call. A durable workflow engine introducing itself as the caller of each `process()` does not need to preserve or reproduce these direct-import relationships — they remain valid as-is (the imported functions don't disappear), and the engine's job is only to sequence the top-level `process(context)` invocations per `docs/adr/ADR-001A-durable-workflow-engine.md`'s adapter boundary.
5. **The engine does not gain authority it does not already have.** Every `AUTHORITATIVE` cell in the matrix above stays with its current component; wrapping a component in a workflow-engine adapter does not transfer its decision authority to the engine (per `docs/adr/ADR-001A-durable-workflow-engine.md`'s own "Authority Boundary" section, reaffirmed here specifically for these five).

---

## Evidence Index

This matrix's cells are derived entirely from the Evidence Index sections of `FINANCEIRO.md`, `COMPLIANCE.md`, `QUALIDADE.md`, `MONITOR.md`, and `COMUNICACAO.md` — no new repository evidence was gathered specifically for this file beyond what those five documents already cite. Cross-component absence claims (e.g. "no single P0 component writes business audit for all cases") were verified by the same repo-wide `require()`/collection-name searches already performed while writing those five documents in this session.
