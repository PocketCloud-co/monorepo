# Independent Best-Practices Review — Full Stack (M0 gate)

| | |
|---|---|
| Date | 2026-07-05 |
| Reviewer | Independent AI review agent (not the author), per Standards §9 / DR-PF-05 |
| Scope | Entire `pocketcloud/` docs + PoC + CI workflow |
| Method | Checklist §9.1–9.7; claims verified empirically (test suite executed 19/19, demo executed, spec constants diffed against code value-for-value, API probed with malformed inputs) |
| Verdict | **Pass-with-findings** → all 15 findings dispositioned below → **gate PASSED, M0 closed** |

## Findings & dispositions

| # | Sev | Finding (abridged) | Disposition |
|---|---|---|---|
| 1 | CRITICAL | Job API accepted `n=1` — a single "share" is the encoded plaintext; no lower bound in SPEC-001/003 either | **Fixed**: boundary validation added to the PoC (n integer in [2,16] with privacy-floor error, maxAttempts [1,10], template payload shape checks); adversarial tests added (21/21 green); SPEC-001 §3 + SPEC-003 §1 now mandate n ≥ 2 |
| 2 | MAJOR | Ledger invariant was tautological (`platform := billed − payouts` ⇒ can never fail) while docs claimed it "proven" | **Fixed**: platform leg now computed independently (units × rate) so the check detects record/rate inconsistencies; SPEC-004 §3 gained a scope-honesty paragraph; FT-05 PRD wording softened; full double-entry remains MB-001's deliverable |
| 3 | MAJOR | SPEC-002 §3 ("PoC-exact") described retry/quarantine-on-dispatch-failure the PoC doesn't have | **Fixed**: SPEC-002 §3 rewritten to actual v0 behavior with `TBD(CP-007)` for re-placement |
| 4 | MAJOR | PRD §5.1 claimed detection ≥ 1−2⁻⁶⁴ vs the implemented 1−2⁻⁶¹ | **Fixed**: §5.1 now states 1−1/p with per-field values (2⁻⁶¹ v0, 2⁻¹²⁷ production) |
| 5 | MAJOR | "Ready requires deps Done" rule contradicted by six trackers; FT-02 used invented statuses | **Fixed**: README convention amended (Ready = spec-complete/decision-unblocked; start order still governed by deps + MVP-PLAN); FT-02 statuses normalized |
| 6 | MAJOR | PF-001 status inconsistent (In Progress in source-of-truth vs Done in four rollups) | **Fixed**: PF-001 marked Done with artifacts in FT-00 (CI is live and green) |
| 7 | MAJOR | SEC-R1 (threat-model sign-off before first P0 merge) contradicted by MVP-PLAN scheduling SEC-001/002 in Wave 4 | **Fixed**: SEC-001/SEC-002 moved to Wave 0 |
| 8 | MAJOR | Missing ⚠ HIGH-RISK markers: MB-003, MB-011, MB-014, CC-014, SDK-010 | **Fixed**: all five marked ⚠ |
| 9 | MINOR | PROJECT-TRACKER task counts wrong (FT-00, FT-08) | **Fixed**: counts corrected (14, 10) |
| 10 | MINOR | OQ-BIZ-03 and OQ-MB-04 cited but unregistered | **Fixed**: both registered in their owning documents |
| 11 | MINOR | PRD Appendix A cited nonexistent file paths | **Fixed**: paths corrected |
| 12 | MINOR | Stale OQ-PF-01 references (FT-06 ×2, FT-02 OQ-CP-01) after DR-PF-03 resolved it | **Fixed**: references updated; OQ-CP-01 marked resolved |
| 13 | MINOR | PF-R1 claimed full gate sequence at M0 while gates are M1 tasks | **Fixed**: PF-R1 milestone → M1 (PF-R2 covers the M0 subset) |
| 14 | MINOR | M2-TRACKER cited PF-009/MB-011/SDK-006 absent from any MVP-PLAN wave | **Fixed**: all three added to waves (4/4/2 respectively) |
| 15 | MINOR | Stale "per-job MAC key" wording (code comment + PRD §7.2) vs per-attempt behavior; demo prints one share of the demo input | **Fixed** (wording aligned to per-attempt) + **WAIVER** (demo share print): the demo prints exactly ONE share of a fresh, display-only dealing — a single share of an independent additive dealing is information-theoretically uniform and reveals nothing; rationale recorded as a comment at the print site. The flat log rule stands for all non-pedagogical code |

## Verdict detail

Reviewer confirmed empirically: 19/19 tests (now 21/21 after fixes), 4-act
demo passes, all extractable SPEC-001..004 constants match the code exactly
(p, SCALE, unit formulas, denominations, endpoint/field names), all DR
cross-references except the ones above resolve, and CI does what it claims.
Adversarial coverage and honesty-qualifier discipline called out as genuine.

## Gate decision

All findings fixed or waived with written rationale; suite green (21/21);
CI green. **§9 gate PASSED for M0. M0 closed 2026-07-05.**

Standing lesson recorded: findings 2–4 are exactly the categories §9 exists
to catch (a check that can't fail, a spec describing absent behavior, an
overclaim in the flagship promise). The gate stays mandatory at every wave
and milestone close.
