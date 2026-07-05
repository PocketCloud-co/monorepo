# SPEC-007 — Telemetry Event Envelope & Redaction Rules

| | |
|---|---|
| Version | v0 draft (lands with OO-001) |
| Producer | FT-08 | Consumers | every service, agent, and SDK |

## 1. Envelope (v0)
```json
{ "ts": "RFC3339",
  "service": "coordinator.verifier" | "agent" | "sdk" | "...",
  "level": "debug" | "info" | "warn" | "error",
  "event": "job.attempt.verified",        // dot-namespaced, kebab words
  "corr": { "jobId": "...", "attempt": 1, "workerId": "...",
            "sessionId": null, "poolId": null, "cell": "us-east-1" },
  "fields": { }, "durMs": 123 }
```

## 2. Redaction rules (CI-enforced, OO-R1)
**Forbidden anywhere in telemetry:** share values, MAC keys/shares, opened
d/e values, customer plaintext, device private keys, payout account
identifiers, raw policy contents beyond booleans. The scrubber test feeds
poisoned fixtures (share-like decimal strings ≥ 2⁴⁰, key-like base64) and
fails the build if any survive to output.
Allowed: sizes, counts, durations, template names, unit counts, verified
flags, hashes of payloads (never payloads).

## 3. Correlation discipline
- `corr.jobId` mandatory on every job-lifecycle event; `sessionId` on every
  serving event; seam events carry both producer and consumer watermarks
  (SEAMS §2 S5).
- Metric names for seams are standardized:
  `seam.<n>.lag_count`, `seam.<n>.lag_age_ms`, `seam.<n>.dlq_depth`,
  `seam.<n>.watermark_{producer,consumer}` — where `<n>` is the Seam
  Registry row number.

## 4. Transport
OTLP-compatible batching (OQ-OO-01); bounded local buffers; **metrics** may
drop-oldest under pressure, **audit/security events** never drop (they use
the full seam pattern — SEAMS registry row 8).

## Change log
- 2026-07-04: v0 draft.
