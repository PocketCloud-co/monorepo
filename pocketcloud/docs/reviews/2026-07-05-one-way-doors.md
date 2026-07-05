# Independent Review — One-Way-Door Decision Audit

| | |
|---|---|
| Date | 2026-07-05 |
| Reviewer | Independent AI decision auditor (not the author) |
| Scope | All DRs (master DR-01..09 + feature DRs), SPEC-001..007, KEY-MANAGEMENT.md, SEAMS.md, strategy/plan docs |
| Question | Which locked-in decisions are one-way doors, and are we walking through any prematurely or unhedged? |
| Verdict | **Disciplined overall** — the genuinely irreversible commitments (content-blindness, verify-before-deliver, quote==bill, owner sovereignty, no novel crypto) are one-way *on purpose* with recorded rationale. Premature-walking risk was concentrated in durable formats Waves 3–4 would have frozen without evolution fields. All 10 findings hedged same-day (below). |

## Findings & hedges applied

| # | Finding | Hedge applied (this commit) |
|---|---|---|
| 1 | Receipt hash chain (financial source of truth) had no schema-evolution story: no schemaVersion, no canonical serialization, implicit platform leg, unanchored partitions | SPEC-004 §6 (BINDING on v1, before CP-013): `schemaVersion`, JCS/RFC-8785 canonical chain-hash input, `priceConfigVersion` + explicit platform-take line, cross-partition chain-head anchoring |
| 2 | No in-band protocol version anywhere ⇒ 2⁶¹→128-bit field migration would be a fleet flag-day | SPEC-001 §6 + SPEC-002 §5 + SPEC-003 §4 (BINDING on v1): `protoVersion`+`fieldId` on every bundle/request, version advertisement at enrollment, versioned API base path |
| 3 | K4 emergency-root hedge under-specified: same-ceremony roots die together; single-root binaries can never be rescued | KEY-MANAGEMENT K4 row: emergency root from a SEPARATE ceremony, DISJOINT holders/HSM; BOTH roots pinned from agent v0.1.0 — now a PF-008 acceptance criterion |
| 4 | Durable-Objects exit strategy existed de facto, not de jure; seam 7 kept billing data only in DO storage | SEAMS rule **S8** ("no durable state whose only home is a non-exportable vendor primitive"); seam 7 amended (R2 flush); OO-007 gains the "rebuild cell from R2+Postgres alone" drill |
| 5 | "Publish 40% take rate" default walks into a pricing ratchet (published takes can fall, never rise) | Master PRD OQ-2 amended: publicly lead with payout floor + net-of-power earnings; take stated only as bounded range with dated review clause; never a bare number |
| 6 | Security figures could drift from the deployed field in public materials | DR-05 scope extended: published figures must cite the protocol version they hold for |
| 7 | v0 wire format protected from external dependents only by scheduling accident | specs/README rule 3: v0 is INTERNAL-ONLY; no external party or released SDK may ever target a v0 spec |
| 8 | DR-SDK-02 strict-default flip is a one-way ratchet | M3 exit checklist marks the flip itself as a ⚠ HIGH-RISK review item |
| 9 | Pool-isolation promise becomes contractual at MVP exit, before the transparency log (CP-012) exists | SEC-006 acceptance: contracts cite property-test suite + reconciliation reports as interim evidence, CP-012 as the durable substitute |
| 10 | BIZ-01 company framing is de facto adopted but de jure unratified — could commit by osmosis at first investor use | OQ-BIZ-01 gains explicit deadline discipline: ratify/reject before any external fundraising material exists |

## Door-table summary (highlights)

- **One-way on purpose, correctly recorded:** DR-01/DR-SEC-01 content-blindness, DR-CP-01 verify-before-deliver, DR-MB-01 quote==bill, DR-HA-02 owner sovereignty, DR-CC-01 no novel crypto, DR-05 honesty qualifiers.
- **One-way, correctly deferred with named commit points:** DR-09 OEM (commit = signed LOI/firmware ship), DR-SDK-02 default flip (commit = M3 release), BIZ-01 (commit = first investor use), K4 pinning (commit = first public binary).
- **Two-way:** vendor rails (Stripe swap-able behind seam 5), templates-first, process DRs, Python-first, wasmtime choice.
- **Was unhedged, now hedged:** the three durable formats (findings 1–3) and the DO invariant (finding 4).

## Change log
- 2026-07-05: audit run; all 10 hedges applied same-day in this commit.
