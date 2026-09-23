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
| Release eligibility | NONE | AUTHORITATIVE⁷ | NONE | NONE | NONE |
| Market requirement | NONE | NONE | AUTHORITATIVE² | CONSUMER | NONE |
| Aflatoxin evidence | NONE | NONE | CONSUMER | PRODUCER | NONE |
| Regulatory compliance (pass/fail) | NONE | NONE | AUTHORITATIVE | CONSUMER | NONE |
| Buyer quality approval | NONE | NONE | NONE | PRODUCER³ | NONE |
| KPI calculation | NONE | NONE | NONE | NONE | AUTHORITATIVE⁴ |
| Business audit | NONE | PRODUCER⁵ | NONE | NONE | NONE |
| Workflow execution state | NONE | NONE | NONE | NONE | CONSUMER⁶ |
| Authorization dispatch (single, two-channel)⁸ | NONE | NONE | NONE | NONE | NONE |
| Physical delivery confirmation⁹ | NONE | NONE | NONE | NONE | NONE |

**Footnotes (no cell above is compound — every nuance lives here, not smuggled into the table):**

1. FINANCEIRO is the *designed* authority for bank credit confirmation, but its current sole producer (`bankQuery.queryBankCreditConfirmation`) is a mock that unconditionally confirms — see `FINANCEIRO.md` Implementation Gaps #1. This cell records design intent, not evidentiary completeness. **Update (business decision, `docs/contracts/FINANCEIRO_DECISIONS.md` FIN-DEC-01/02/04-06/14, 2026-09-21):** the business has since approved what should evidence this cell operationally — a human bank query performed by Rodrigo or Leonardo, confirmed by replying to a WhatsApp message the agent posts in the operation's group, no attachment required. No automated bank-API integration was requested or approved. This is a BUSINESS_DECISION, not an implementation: the mock is untouched, so the cell's evidentiary gap described above still holds exactly as written until that WhatsApp flow is built (see `FINANCEIRO.md`'s "Approved Confirmation & Release Flow" section). It also surfaces an unresolved boundary question this matrix does not answer: whether receiving and parsing that WhatsApp reply falls under FINANCEIRO (this row) or under COMUNICACAO's `AUTHORITATIVE` "Message normalization" row above — the source decisions describe a distinct WhatsApp group "with the agent," not routed through any named component.
2. COMPLIANCE's market-requirements ruleset is a source-code constant (`marketRequirements.js`), not a persisted table, despite `config/schemas.json`'s `Compliance` schema implying one. Whether it should move to persisted storage is `TBD_ADR_007` (see `COMPLIANCE.md` Persistence).
3. QUALIDADE *records* buyer approval; it does not hold decision authority over it — the actual approve/reject decision is made by an unmodeled external human process (the buyer, via a mechanism that does not exist in code anywhere — see `QUALIDADE.md` Human Review / Approval). No component in this P0 set is `AUTHORITATIVE` for this row; the true authority is outside the audited system entirely.
4. MONITOR is `AUTHORITATIVE` for the KPI-calculation function itself; 3 of its 6 required inputs have no verified producer anywhere in the repository (`MONITOR-KPI-PRODUCER-GAP`, see `MONITOR.md`). This cell records the designed computational authority, not input completeness.
5. FINANCEIRO produces one class of business-audit entry (release-document `AUDIT_LOG` writes). Overall business-audit authority spans components outside this P0 set (`CONTRATOS`, `EXCECOES` — both also write `COLLECTIONS.AUDIT_LOG`, per the repository-wide review in earlier turns of this session) — no single component in this P0 set is `AUTHORITATIVE` for the row as a whole, and this matrix does not invent one.
6. MONITOR only reads (`CONSUMER`) the Supabase `ftr.status` field via `kpiQueries.js`. Authoritative ownership of "workflow execution state" as a whole is the open conflict already recorded in `docs/adr/CURRENT_REPOSITORY_FACTUAL_BASELINE.md` §2 (Firestore `ftr_processing.current_status` vs. Supabase `ftr.status` vs. `master.js`'s `FTR_STATUS` constant) — `TBD_ADR_007` at the system level, not assignable to any one of these 5 components.
7. **Business decision update (FIN-DEC-01–16, 2026-09-21):** FINANCEIRO's `AUTHORITATIVE` status on this row is unchanged and must not be read as transferred to Rodrigo or Leonardo. The approved WhatsApp confirmation is an evidentiary input to `bankCreditConfirmed` (see footnote 1) and, for partial payments, an additional release-with-balance decision — FINANCEIRO's `releaseGate.canReleaseOriginalDocuments` remains the sole computer of `release_flag` from those inputs. The human confirmation and the component's computation are two distinct responsibilities; neither FIN-DEC-01–16 nor this matrix collapses them into one.
8. **Normative authority is `NONE` across all five P0 components** — no component in this matrix's scope holds confirmed authority over sequencing or sending the single, two-channel authorization FIN-DEC-07/08/09/10/17 approve. A separate document, `ORQUESTRADOR.md` (a draft, not one of this matrix's five P0 contracts), sketches ORQUESTRADOR as the *proposed* coordinator using its own `PROPOSED_OWNER` vocabulary — deliberately distinct from this matrix's `AUTHORITATIVE` legend value so the proposal cannot be mistaken for a confirmed authority determination. That proposal is a `TECHNICAL_PROPOSAL`: not a business decision, not approved, not implemented, and it does not change this row's `NONE` values, which record confirmed authority only. Implementation of any authorization-dispatch mechanism is entirely absent in `src/` today.
9. **Normative authority is `NONE` across all five P0 components** — no component holds confirmed authority over recording or validating a physical-delivery confirmation (FIN-DEC-18–21). The true decision-maker is Rodrigo or Leonardo, an external human process, similar in kind to QUALIDADE's buyer-approval boundary (footnote 3 above): no component in this repository, proposed or confirmed, holds this authority itself. `ORQUESTRADOR.md`'s technical proposal has a component only record/accumulate what that human confirms — a `PROPOSED_OWNER` role in that draft's own vocabulary, not a promotion of this row to an approved decision. Implementation is entirely absent (`FINANCEIRO.md` Implementation Gaps #8–13 and its Consolidated section).

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
