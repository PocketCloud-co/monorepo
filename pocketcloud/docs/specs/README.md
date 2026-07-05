# Integration Specs — the contracts independent implementations build to

Rules (binding, per Standards §6 and PROJECT-TRACKER):

1. **Build to the spec, not to another team's code.** A task implementing an
   interface cites its SPEC ID in the PR; conformance is proven by golden
   transcripts (PF-005) or contract tests, not by reading the counterpart.
2. **Versioning:** every spec carries `Version: vN`. Breaking change ⇒ vN+1
   AND same-PR updates to every consumer feature PRD listed in the spec's
   header. Additive optional fields are minor and documented in the spec's
   change log.
3. **v0 = the PoC — and v0 is INTERNAL-ONLY.** Where a spec says "v0", the
   Node PoC in `pocketcloud/poc/` is the executable reference (DR-PF-01) and
   the spec is normative prose over it. Production (v1) specs supersede at
   CC-030/CP-001. **No external customer, design partner, or released SDK
   may ever target a v0 spec** (one-way-door audit finding 7) — v0 wire
   formats are throwaway by design and must never accrete external
   dependents.
4. **Unknowns are explicit.** `TBD(owner-task)` marks open holes; a spec
   with a TBD can be implemented around it but not through it.

| Spec | Contract | Producer / Consumers |
|---|---|---|
| [SPEC-001](SPEC-001-crypto-protocol.md) | field, encoding, sharing, MACs, Beaver online phase, wire encoding | FT-01 / FT-02, FT-03, FT-04 |
| [SPEC-002](SPEC-002-coordinator-agent-api.md) | agent registration + compute kernels API | FT-02 / FT-03 |
| [SPEC-003](SPEC-003-job-api.md) | customer job API: submit, estimate, ledger, workers | FT-02 / FT-04, FT-05 consoles |
| [SPEC-004](SPEC-004-receipt-metering.md) | receipt schema, denominations, ledger invariant | FT-02 + FT-05 (joint) / FT-08 |
| [SPEC-005](SPEC-005-owner-policy.md) | owner/org resource-cap policy object | FT-03 / FT-05 consoles, MDM tooling |
| [SPEC-006](SPEC-006-artifact-manifest.md) | signed content-addressed artifact manifest | FT-03 / FT-06, FT-00 release eng |
| [SPEC-007](SPEC-007-telemetry-envelope.md) | telemetry event envelope + redaction rules | FT-08 / all |

## Change log
- 2026-07-04: created with SPEC-001..007 (001–004 exact from PoC v0; 005–007 v0 drafts).
