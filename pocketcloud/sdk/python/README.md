# Pocket Cloud Python SDK (managed mode)

The demand-side developer experience for Pocket Cloud: submit a **private,
MAC-verified** distributed job as if it were a serverless batch call. Managed
mode (milestone M1) — the coordinator handles dealing and verification; the SDK
gives you quotes, budgets, privacy parameters, idempotent retry, and typed
errors.

Runtime dependencies: **none** (standard library only — `urllib`, `json`,
`dataclasses`). Implements FT-04 SDK-001/002/003/006 against the SPEC-003 Job
API.

## Install

```bash
pip install -e .            # from sdk/python/
```

## The 5-line happy path (SDK-R1)

```python
from pocketcloud import Client, matvec
client = Client("http://127.0.0.1:4600")
job = matvec([[1.0, 0.5, -0.25], [-2.0, 1.25, 0.5]], [2.0, -4.0, 8.0])
result = client.submit(job, budget_millicredits=100_000)
print(result.result)   # -> [-2.0, -5.0], MAC-verified
```

`submit` returns only after the fabric has returned a **verified** result. If
it cannot, it raises `VerificationFailed` — an unverified result is never
returned to your code (SDK-R2).

## Templates

Two job builders. Both validate privacy parameters and data shape **client-side
before any network call** (SDK-R6):

```python
from pocketcloud import matvec, private_dot

# T1 — private matrix-vector product (public matrix, private input)
job = matvec(matrix=[[1.0, 0.5], [-2.0, 1.25]], input=[2.0, -4.0], n=3)

# T3 — private dot product (both vectors private)
job = private_dot(x=[1.5, -2.0, 0.25], y=[-1.0, 0.5, 4.0], n=3)
```

### Privacy parameter `n`

`n` is the number of shares/workers a job is split across. `n >= 2` is a
**privacy floor**, not a tuning knob: with `n = 1` the single "share" would be
the encoded plaintext handed to one worker (SPEC-001 §3). The builders raise
`PrivacyParameterError` for `n < 2` (or `n > 16`) **before** anything leaves the
process. `max_attempts` (re-dispatch budget, default 3, range `[1, 10]`)
controls how many fresh worker sets the fabric will try before giving up.

## Quotes and budgets (SDK-R4 / SDK-002)

Work units are a pure function of the job's shape, so you get an **exact** quote
before dispatch. Pass `budget_millicredits` and an over-budget job is refused
client-side — no job is created, nothing is billed:

```python
quote = client.estimate(job)
print(quote.customer_millicredits, quote.units_per_worker)

try:
    client.submit(job, budget_millicredits=quote.customer_millicredits - 1)
except BudgetExceeded as e:
    print(e.quote_millicredits, e.budget_millicredits)   # refused, no job
```

For a single-attempt verified success, the bill equals the estimate exactly
(SPEC-003 invariant).

## Idempotent submission (SDK-R5 / SDK-003)

Pass an `idempotency_key`. A retried submit with the same key returns the cached
result instead of re-dispatching, so a network blip never double-bills:

```python
r1 = client.submit(job, idempotency_key="order-42")
r2 = client.submit(job, idempotency_key="order-42")   # cached; one job, one bill
assert r1.job_id == r2.job_id
```

(The token is modeled client-side; the PoC coordinator is stateless on this
axis. SPEC-003 §4 will carry it on the wire in v1.)

## Ledger

```python
client.get_ledger()    # receipts, payouts, billed/payout/platform totals, invariant
client.get_workers()   # fleet roster incl. quarantine state
```

## Exceptions

| Exception | Raised when |
|-----------|-------------|
| `PrivacyParameterError` | `n < 2`, out-of-range params, or bad data shape — **client-side, pre-network** |
| `BudgetExceeded` | quote exceeds `budget_millicredits` — **client-side, pre-submit, no job created** |
| `VerificationFailed` | the fabric could not return a MAC-verified result (exhausted attempts) |
| `JobFailed` | boundary rejection (HTTP 400), transport error, or unexpected response |

All inherit from `PocketCloudError`.

## Running the tests

The tests run against a **live** ephemeral PoC coordinator + workers (not
mocks), booted via a small Node launcher (`tests/launcher.mjs`) that imports the
existing PoC modules. Node and Python 3.9+ are required.

```bash
pip install -e ".[dev]"     # pytest
python3 -m pytest -v        # from sdk/python/
```

14 tests cover: the 5-line happy path (matvec + private_dot), quote==bill,
budget refusal (with a ledger-unchanged assertion), the `n=1` privacy floor
(never reaches the network), idempotency (one job / one bill), and the
verification-failure path (all-tamper fleet → `VerificationFailed`, plus the
self-heal case where tamperers are quarantined and a clean attempt verifies).
