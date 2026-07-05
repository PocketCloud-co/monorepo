# Run note — FT-04 Python SDK (managed mode)

## What was built

An installable `pocketcloud` package (`sdk/python/`, src layout, stdlib-only
runtime) implementing FT-04 SDK-001/002/003/006:

- `Client(coordinator_url)` — `estimate(job) -> Quote`,
  `submit(job, *, budget_millicredits=None, idempotency_key=None) -> JobResult`,
  `get_ledger()`, `get_workers()`.
- Template builders `matvec(...)` and `private_dot(...)` with client-side
  privacy (`n >= 2`) and shape validation.
- Typed exceptions: `PrivacyParameterError`, `BudgetExceeded`,
  `VerificationFailed`, `JobFailed` (all under `PocketCloudError`).

## How to run

```bash
cd sdk/python
pip install -e ".[dev]"     # installs the package + pytest (dev only)
python3 -m pytest -v        # boots a live Node PoC coordinator per test module
```

Requirements: Python 3.9+ and Node (>=18) on PATH. The pytest fixtures spawn
`tests/launcher.mjs`, which imports the existing PoC coordinator/worker modules
(`../../../poc/src/...`) and prints the coordinator URL. No PoC code was
modified; the launcher is additive and test-only.

## Result

`14 passed` (approx 0.65s). The verbatim 5-line example was also run against a
live coordinator and returned the correct MAC-verified result `[-2.0, -5.0]`.

## Notes / decisions

- **Budget semantics:** only a quote *strictly greater* than the budget is
  refused; `budget == quote` is allowed (test `test_budget_exactly_equal_is_allowed`).
- **502 -> VerificationFailed:** the coordinator returns 502 when it exhausts
  re-dispatch attempts without a verified result; the SDK maps that to
  `VerificationFailed` (SDK-R2). Malformed jobs (HTTP 400) and transport errors
  map to `JobFailed`.
- **Verification-failure path, real behavior (documented in tests):**
  - *All-tamper fleet + `max_attempts=1`* -> the one attempt fails its MAC
    check, coordinator returns 502, SDK raises `VerificationFailed`, and the
    ledger shows `customerBilledMillicredits == 0` (rejected attempts not
    billed).
  - *Self-heal* (3 tamperers registered first so LRU picks them, + 5 clean,
    `max_attempts=3`) -> attempt 1 fails and quarantines the tamperers,
    attempt 2 runs on clean workers and verifies. The customer receives a
    verified result, only the verified attempt is billed (quote == bill), and
    the 3 tamperers show `quarantined: true` in the roster.
- **Idempotency** is modeled client-side (cache result by key) because the PoC
  coordinator is stateless on this axis; SPEC-003 §4 carries the token on the
  wire in v1.
```
