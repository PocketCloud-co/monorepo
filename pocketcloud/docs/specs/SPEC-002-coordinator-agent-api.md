# SPEC-002 — Coordinator ↔ Agent API

| | |
|---|---|
| Version | v0 (PoC-exact; v1 with CP-001/HA-002 adds mTLS identity, pull transport, pool scoping) |
| Producer | FT-02 | Consumers | FT-03 |
| Reference impl | `poc/src/worker/worker.js`, `poc/src/coordinator/coordinator.js` |

## 1. Registration
`POST {coordinator}/workers/register` → `{ "id": string, "url": string }`
→ 200 `{ "registered": id }`. v0 workers listen; **v1 inverts to
outbound-only pull** (agents dial out; no inbound listener) —
`TBD(CP-006/OQ-CP-02)`; kernel payload shapes below are transport-agnostic
and survive the inversion.

## 2. Compute kernels
`POST {worker}/compute` → `{ "template": string, "payload": object }`.
All field values are SPEC-001 §6 decimal strings. Workers are **stateless**:
every request carries everything needed.

### 2.1 `matvec` (T1)
Request payload: `matrix` (public, encoded), `xShare`, `xMacShare`.
Response: `{ workerId, yShare, yMacShare }` where yShare = matrix·xShare,
yMacShare = matrix·xMacShare (SPEC-001 §4 linearity).

### 2.2 `dot-phase1` (T3 round 1)
Payload: `xShare, xMacShare, yShare, yMacShare, aShare, aMacShare, bShare,
bMacShare` (triples per SPEC-001 §5).
Response: `{ dShare, dMacShare, eShare, eMacShare }` (d = x−a, e = y−b,
element-wise, with MAC shares so the opening is checkable).

### 2.3 `dot-phase2` (T3 round 2)
Payload: opened `d`, `e` (public vectors) + `aShare, aMacShare, bShare,
bMacShare, cShare, cMacShare`.
Response: `{ zShare, zMacShare }` (scalars: summed over elements).

## 3. Error handling
- Unknown template → 400 `{ error }`. Kernel failure → 500 `{ error }`.
- A worker MUST NOT return partial results.
- **v0 actual behavior:** a worker call failure (non-200, network error)
  propagates as a job-level 500 to the customer — there is NO re-placement
  or quarantine on dispatch failure in the PoC (quarantine applies only to
  MAC-verification failures). Retry/re-placement on dispatch failure is
  `TBD(CP-007)` and MUST be treated as absent until then.

## 4. Health
`GET {worker}/health` → `{ workerId, ok: true }`.

## 5. v1 additions (`TBD`, do not build against yet)
Per-device mTLS certs (CP-002); signed work manifests; pool_id scoping
(CP-014); fuel/receipt counters (HA-003); artifact references (SPEC-006).

## Change log
- 2026-07-04: v0 extracted from PoC.
