# FT-xx — <Feature Name> — Feature PRD

| | |
|---|---|
| **Status** | Draft / Active / Frozen |
| **Owner** | <human owner> |
| **Master PRD sections** | §<n>, §<n> |
| **Milestones** | M<n>, M<n> |
| **Binding canon** | `docs/ENGINEERING-STANDARDS.md` (read first) |

## 1. Purpose

<Two or three sentences: what this feature area owns and why it exists, in
terms a subagent with no other context can act on.>

## 2. Scope

**In scope:** <bullet list>

**Out of scope (owned elsewhere):** <bullet list with owning FT-xx>

## 3. Requirements

| ID | Requirement | Priority | Milestone |
|----|-------------|----------|-----------|
| <PREFIX>-R1 | ... | P0 | M1 |

## 4. Interface contracts

<Every contract this feature exposes to or consumes from other features:
schemas, endpoints, file formats. Versioned. Breaking changes update every
consumer's PRD in the same PR.>

## 5. Threat model (feature-scoped)

| Adversary | Capability | Mitigation (this feature's responsibility) |
|-----------|-----------|--------------------------------------------|
| ... | ... | ... |

## 6. QA requirements (beyond Standards §3)

<Feature-specific test obligations: which adversarial cases, which golden
transcripts, which property-based suites, which load targets.>

## 7. Decision Records

- **DR-<feature>-01 (YYYY-MM-DD):** <decision, rationale>

## 8. Open Questions

- **OQ-<feature>-01** (owner: <who>, default: <proposed>): <question>
