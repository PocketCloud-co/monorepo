# SPEC-006 — Signed Artifact Manifest

| | |
|---|---|
| Version | v0 draft (lands with HA-008/LS-002; TUF-rooted per DEVICE-RUNTIME.md) |
| Producer | FT-03 (schema), FT-06 (model/expert artifacts), FT-00 (agent binaries) | Consumers | all agents |

## 1. Principles
- Everything an agent loads is **content-addressed and signed**: kernels
  (WASM), model weights/experts (GGUF/safetensors ONLY — never pickle, no
  custom-op containers), agent updates.
- Weights are DATA (DEVICE-RUNTIME.md §1): the manifest never carries
  executable code except platform-signed WASM kernels and agent binaries.
- Verify-before-touch: signature and hash checked before any parser reads
  content; size bounds enforced before download completes.

## 2. Manifest (v0)
```json
{ "manifestVersion": 1,
  "artifactId": "sha256:<hex>",          // content address of the payload
  "kind": "wasm-kernel" | "model-weights" | "model-expert" | "agent-update",
  "format": "wasm" | "gguf" | "safetensors" | "native-signed",
  "sizeBytes": int,
  "chunks": [ { "index": 0, "sha256": "<hex>", "sizeBytes": int } ],
  "compat": { "kernelABI": "v0", "minAgentVersion": "0.1.0",
              "targets": ["x86_64-pc-windows", "aarch64-linux-android", "..."] },
  "model": { "family": "glm|llama|...", "layerRange": [int,int]|null,
             "expertIds": [int]|null, "quant": "Q4_K_M" }, // kind=model-* only
  "signatures": [ { "keyId": string, "role": "platform-release" | "model-vetting",
                    "alg": "ed25519", "sig": "<base64>" } ],
  "tuf": { "targetsRole": string, "snapshotVersion": int } }
```

## 3. Rules
- `kind:model-*` requires BOTH a `platform-release` and a `model-vetting`
  signature (dual sign-off: release eng + artifact-vetting pipeline).
- Agents cache by `artifactId`; dedup across jobs is by content address;
  eviction respects SPEC-005 `disk.maxGB`.
- Revocation: TUF snapshot rotation; agents refuse artifacts absent from
  the current snapshot. Key hierarchy per SEC-003 (`TBD` until ratified).
- Expert pinning (FT-06): scheduler references `artifactId`s; a device
  advertises its cached set in heartbeats so placement favors warm caches.

## Change log
- 2026-07-04: v0 draft.
