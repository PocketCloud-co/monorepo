# Pocket Cloud — Key Management Architecture (SEC-003)

> **Status:** v1 ratified for M1 building (owner: FT-07; implementing tasks
> noted per key class). Changing a key class's storage, rotation, or trust
> chain requires a DR in FT-07. Companion: SPEC-006 (artifact manifests),
> SEAMS.md (what crosses boundaries), Standards §4/§5.

## 0. Principles

1. **Keys live where they're used, at the lowest privilege that works.**
   Device keys never leave devices; signing keys never touch CI; MAC keys
   never touch disk.
2. **Every key class has a written compromise story** before the key exists.
   "What do we do the day this leaks" is part of the design, not incident
   improv.
3. **No long-lived bearer secrets where identity can be derived**: prefer
   OIDC-scoped, short-lived, audience-bound credentials (CI deploys,
   service-to-service) over static tokens.
4. **The customer's strict-mode keys are none of our business.** The design
   must keep working when we can't see them — that's the point.

## 1. Key inventory

| # | Key class | Purpose | Generation | Storage | Rotation | Compromise response | Implementing task |
|---|---|---|---|---|---|---|---|
| K1 | Device identity keypair | agent authN (mTLS), receipt signing, share-bundle unsealing | on-device at enrollment | OS keystore / TPM / StrongBox where hardware allows; file-key fallback lowers the device's trust class | re-enroll ≤ 12 mo or on attestation change | revoke cert (CP-002 CRL/short-lived certs); device re-enrolls to a NEW identity with reputation reset | HA-005 |
| K2 | Coordinator internal CA | issues K1 device certs + K3 service certs | KMS-held CA key, cell-scoped intermediates | cloud KMS (non-exportable) | intermediates 90 d; root offline, 2 y | rotate intermediate, reissue device certs on next heartbeat; root compromise = fleet re-enrollment (documented drill) | CP-002 |
| K3 | Service identities | mTLS between control-plane roles (dealer, verifier, router, ledger consumer) | per-deploy, short-lived (≤ 24 h) | in-memory, issued at boot via workload identity | automatic per deploy/day | kill + redeploy the role; audit its window | CP-001 |
| K4 | Release-signing keys (agent binaries) | hosts run only code we signed | offline ceremony, threshold 2-of-3 holders | HSM, never networked; public roots pinned in agents | 2 y, staged dual-signing overlap | this is the fleet-ending scenario: TUF revocation + emergency root rotation via the second pinned root; rehearsed annually. **The emergency root is generated in a SEPARATE ceremony with DISJOINT holders and a different HSM** — one ceremony compromise must never kill both roots. **BOTH roots are pinned in every agent binary from v0.1.0 onward** (a binary shipped with one root can never be rescued) — PF-008 acceptance criterion. TUF root rotation requires 2-of-3 of the surviving root's holders | PF-008, SEC-R2 (DR-SEC-02) |
| K5 | Artifact-vetting keys (models/experts/kernels) | second signature on every artifact (SPEC-006 dual-sign) | vetting-pipeline KMS key | KMS | 6 mo | revoke via TUF snapshot; artifacts re-vetted; agents refuse stale snapshots | HA-008, LS-002 |
| K6 | TUF roles (root/targets/snapshot/timestamp) | update + artifact freshness/authority chain | root at K4 ceremony; online roles in KMS | root offline; online roles KMS | per TUF norms (timestamp daily) | standard TUF compromise playbook per role | PF-008, HA-008 |
| K7 | Per-attempt MAC key α | SPDZ integrity (SPEC-001 §4) | fresh CSPRNG draw per dispatch attempt | **in-memory only, verifier scope; NEVER persisted or logged** | every attempt (by construction) | none needed — exposure of a *used* α after verification reveals nothing about data; exposure *during* an attempt voids only that attempt (re-dispatch) | CP-005 / FT-01 |
| K8 | Worker sealing keys (share bundles) | strict-mode bundles readable only by the assigned worker | = K1 public half (HPKE to device key) | n/a (public) | with K1 | with K1 | CP-006, SDK-004 |
| K9 | Customer strict-mode keys | client-side dealing/verification; result unsealing | in customer SDK/environment | customer-held; platform NEVER sees them | customer policy | customer's incident; our docs give guidance; platform unaffected by design | SDK-004/005 |
| K10 | Org enrollment tokens | MDM fleet binding to a pool (F20) | per-batch, single-use, short-lived (≤ 72 h) | org admin's MDM config; hashed at rest server-side | per deployment batch | revoke batch; devices enrolled by a leaked token are quarantined pending org confirmation | HA-017, CP-014 |
| K11 | Vendor secrets (Stripe, KMS creds, webhook signing) | money + infra APIs | vendor-issued | secret manager; OIDC-scoped where supported | 90 d or vendor rotation | vendor key rotation runbook; payout freeze until verified | MB-004/005, OO-006 |

## 2. Trust chains (who vouches for what)

```
K4 offline root (HSM ceremony, 2-of-3)
 └─ TUF root (K6) ── targets/snapshot/timestamp (KMS)
     ├─ agent binaries  (K4 signature, PF-008 reproducible builds)
     └─ artifacts       (K4-chain release sig + K5 vetting sig — SPEC-006 dual-sign)

K2 internal CA (KMS root, cell intermediates)
 ├─ K1 device certs  (enrollment; attestation-scored)
 └─ K3 service certs (workload identity, ≤24 h)

Customer trust anchor: pinned coordinator identity in SDK (K2 root fingerprint)
+ customer-held K9 — the platform is NOT in the customer's key chain in strict mode.
```

## 3. Where keys must never be (CI-testable prohibitions)

- **CI runners:** no K4/K5/K6 private material, ever (DR-SEC-02). Deploys
  use OIDC-scoped, audience-bound credentials. PF-010 meta-suite includes a
  fixture asserting workflows reference no signing-key secrets.
- **Logs/telemetry:** no key material of any class; SPEC-007 scrubber
  fixtures include key-shaped strings.
- **Code/fixtures:** secret scan (PF-006) blocks merge.
- **Disk (K7):** MAC keys are stack/heap-lifetime only; verifier code review
  checks no serialization path exists (CP-005 acceptance).

## 4. Ceremonies & drills

- K4 ceremony: documented script, 2-of-3 holders, witnessed, recorded in
  FT-07's evidence locker; rehearsed before first public agent release.
- Annual drills: K4 compromise (emergency root rotation), K2 intermediate
  rotation, K11 Stripe rotation with payout freeze/thaw. Tracked with
  OO-006 runbooks + SEC-011 tabletops.

## 5. Open questions

- **OQ-SEC-04** (owner: founder; default: cloud HSM service for K4 at M1,
  dedicated hardware token ceremony before public beta): HSM/vendor choice
  and holder identities for the 2-of-3 threshold.
- **OQ-SEC-05** (owner: eng; default: HPKE (RFC 9180) X25519+ChaCha20 for
  K8 sealing): sealing suite — confirm with CC-001 protocol spec.

## Change log
- 2026-07-05: v1 authored and ratified for M1 building (SEC-003).
