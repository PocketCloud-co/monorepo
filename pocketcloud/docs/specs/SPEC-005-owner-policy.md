# SPEC-005 — Owner/Org Resource-Cap Policy Object

| | |
|---|---|
| Version | v0 draft (normative shape; enforcement mechanisms per DEVICE-RUNTIME.md; lands with HA-004/HA-007) |
| Producer | FT-03 | Consumers | FT-05 consoles, MDM/fleet tooling (HA-011/HA-017), OEM UIs (DR-09) |

## 1. Principles (from PRD DR-HA-02 / §5.0)
- The policy is **sovereign**: the platform never exceeds it; scheduler
  treats soft-enforced caps as lower-trust (DEVICE-RUNTIME.md).
- Owner = the human for personal devices; = the **organization** (via MDM)
  for corporate devices, with an employee transparency notice.
- Every cap has a soft (agent) layer everywhere plus the hardest available
  OS backstop (Job Objects / cgroups v2 / WorkManager constraints).

## 2. Policy object (v0)
```json
{ "policyVersion": 1,
  "ownerType": "personal" | "org",
  "poolId": null | "pool-...",          // org devices: private pool binding
  "cpu":     { "maxPercent": 50, "onlyWhenIdle": true },
  "memory":  { "maxMB": 2048 },
  "disk":    { "maxGB": 20 },
  "network": { "maxMbpsUp": 10, "maxMbpsDown": 50, "meteredConnections": "never" },
  "schedule":{ "timezone": "America/New_York",
               "windows": [ { "days": ["mon","tue","wed","thu","fri"], "start": "22:00", "end": "06:00" } ] },
  "power":   { "requireCharging": true, "requireACForGPU": true,
               "thermalHeadroomC": 10, "batteryMinPercent": 50 },
  "yield":   { "pauseOnUserActive": true, "resumeAfterIdleMin": 5 },
  "workClasses": { "mpcShares": true, "bulkCompute": true, "llmServing": false, "storage": false } }
```

## 3. Semantics
- Absent fields take the platform's conservative defaults (published table,
  `TBD(HA-007)`); an explicit field always wins.
- `workClasses` is an owner-consent allowlist — new workload classes ship
  default-false and require opt-in (host protection, PRD §10.1).
- Policy changes take effect ≤ 60 s; running work is checkpointed or
  abandoned cleanly (HA-009), never grandfathered past the new caps.
- Org policies distribute via MDM (HA-017); a device-local user may
  further RESTRICT an org policy, never loosen it.

## 4. Conformance
Cap-conformance suite per platform (HA-004): sustained load must respect
each cap; `yield.pauseOnUserActive` must engage < 250 ms after input.

## Change log
- 2026-07-04: v0 draft.
