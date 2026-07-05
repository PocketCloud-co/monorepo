"""Contract + adversarial tests for the Pocket Cloud SDK against a live PoC.

Covers FT-04 SDK-001/002/003/006 acceptance criteria and the SPEC-003
invariants (verified-only results, rejected attempts not billed, quote == bill
for a single-attempt success, n >= 2 privacy floor).
"""

from __future__ import annotations

import pytest

from pocketcloud import (
    BudgetExceeded,
    Client,
    PrivacyParameterError,
    VerificationFailed,
    matvec,
    private_dot,
)

TOL = 1e-3  # fixed-point (2^16 scale) reconstruction tolerance


def _dot(a, b):
    return sum(ai * bi for ai, bi in zip(a, b))


def _matvec(matrix, vec):
    return [_dot(row, vec) for row in matrix]


# --- SDK-001: managed-mode lifecycle ---------------------------------------


def test_five_line_happy_path_matvec(fabric):
    # The 5-line happy path (SDK-R1), verbatim shape from the README.
    client = Client(fabric.url)
    job = matvec([[1.0, 0.5, -0.25], [-2.0, 1.25, 0.5]], [2.0, -4.0, 8.0])
    result = client.submit(job, budget_millicredits=1_000_000)

    expected = _matvec([[1.0, 0.5, -0.25], [-2.0, 1.25, 0.5]], [2.0, -4.0, 8.0])
    assert result.attempts[-1]["verified"] is True
    assert len(result.result) == len(expected)
    for got, want in zip(result.result, expected):
        assert abs(got - want) < TOL


def test_private_dot_happy_path(fabric):
    client = Client(fabric.url)
    x = [1.5, -2.0, 0.25, 3.0]
    y = [-1.0, 0.5, 4.0, 2.5]
    result = client.submit(private_dot(x, y), budget_millicredits=1_000_000)

    assert result.attempts[-1]["verified"] is True
    assert abs(result.result - _dot(x, y)) < TOL


# --- SDK-002 + quote==bill invariant ---------------------------------------


def test_estimate_matches_bill_for_single_verified_attempt(fabric):
    client = Client(fabric.url)
    job = matvec([[1.0, 2.0], [3.0, 4.0], [5.0, 6.0]], [7.0, 8.0])

    quote = client.estimate(job)
    result = client.submit(job)

    # SPEC-003 invariant: single-attempt success bills exactly the estimate.
    assert result.attempts[-1]["verified"] is True
    assert len(result.attempts) == 1
    assert result.customer_millicredits == quote.customer_millicredits
    assert result.billing["unitsPerWorker"] == quote.units_per_worker
    # matvec unit function is 2*rows*cols; sanity-check the quote surfaced it.
    assert quote.units_per_worker == 2 * 3 * 2


def test_estimate_does_not_create_a_job(fabric):
    client = Client(fabric.url)
    before = len(client.get_ledger()["receipts"])
    client.estimate(matvec([[1.0, 2.0]], [3.0, 4.0]))
    after = len(client.get_ledger()["receipts"])
    assert before == after


# --- SDK-002: budget refusal is client-side, bills nothing -----------------


def test_over_budget_is_refused_client_side_and_creates_no_job(fabric):
    client = Client(fabric.url)
    job = matvec([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]], [1.0, 1.0, 1.0])

    quote = client.estimate(job)
    receipts_before = len(client.get_ledger()["receipts"])

    with pytest.raises(BudgetExceeded) as exc:
        client.submit(job, budget_millicredits=quote.customer_millicredits - 1)

    assert exc.value.quote_millicredits == quote.customer_millicredits
    assert exc.value.budget_millicredits == quote.customer_millicredits - 1
    # No job was created: the ledger is unchanged.
    assert len(client.get_ledger()["receipts"]) == receipts_before


def test_budget_exactly_equal_is_allowed(fabric):
    client = Client(fabric.url)
    job = matvec([[2.0, 0.0], [0.0, 2.0]], [1.0, 1.0])
    quote = client.estimate(job)
    # Budget == quote must NOT refuse (only strictly-over is a refusal).
    result = client.submit(job, budget_millicredits=quote.customer_millicredits)
    assert result.attempts[-1]["verified"] is True


# --- SDK-006: privacy floor enforced client-side, never hits the network ---


def test_n_equals_one_raises_before_network():
    # No fabric fixture: this must raise purely client-side (builder), so the
    # network is never touched.
    with pytest.raises(PrivacyParameterError):
        matvec([[1.0, 2.0]], [3.0, 4.0], n=1)
    with pytest.raises(PrivacyParameterError):
        private_dot([1.0], [2.0], n=1)


def test_n_out_of_range_raises():
    with pytest.raises(PrivacyParameterError):
        matvec([[1.0]], [1.0], n=17)
    with pytest.raises(PrivacyParameterError):
        matvec([[1.0]], [1.0], n=0)


def test_shape_validation_is_client_side():
    with pytest.raises(PrivacyParameterError):
        matvec([[1.0, 2.0]], [3.0])  # input length != cols
    with pytest.raises(PrivacyParameterError):
        matvec([[1.0, 2.0], [3.0]], [1.0, 2.0])  # ragged matrix
    with pytest.raises(PrivacyParameterError):
        private_dot([1.0, 2.0], [3.0])  # unequal length


def test_custom_n_is_honored_end_to_end(fabric):
    client = Client(fabric.url)
    job = matvec([[1.0, 1.0], [1.0, 1.0]], [2.0, 3.0], n=4)
    quote = client.estimate(job)
    assert quote.n == 4
    result = client.submit(job)
    assert result.billing["workersPaid"] == 4
    assert len(result.attempts[-1]["workers"]) == 4


# --- SDK-003: idempotency -> one job, one bill -----------------------------


def test_idempotent_submit_does_not_double_submit(fabric):
    client = Client(fabric.url)
    job = matvec([[1.0, 0.0], [0.0, 1.0]], [5.0, 6.0])

    receipts_before = len(client.get_ledger()["receipts"])

    r1 = client.submit(job, idempotency_key="order-42")
    receipts_after_first = len(client.get_ledger()["receipts"])
    r2 = client.submit(job, idempotency_key="order-42")
    receipts_after_second = len(client.get_ledger()["receipts"])

    # Same job returned, and the second submit created no new receipts: one
    # job, one bill (SDK-R5 / SDK-003).
    assert r1.job_id == r2.job_id
    assert r2 is r1  # cached object
    assert receipts_after_first - receipts_before == job.n  # n receipts
    assert receipts_after_second == receipts_after_first  # no re-dispatch

    # Distinct jobIds in the ledger for this run: exactly one.
    job_ids = {r["jobId"] for r in client.get_ledger()["receipts"]}
    assert r1.job_id in job_ids


def test_different_keys_create_distinct_jobs(fabric):
    client = Client(fabric.url)
    job = matvec([[1.0], [1.0]], [3.0])
    a = client.submit(job, idempotency_key="k-a")
    b = client.submit(job, idempotency_key="k-b")
    assert a.job_id != b.job_id


# --- SDK-R2: verification failure path -------------------------------------


def test_all_tamper_fleet_exhausts_and_raises_verification_failed(all_tamper_fabric):
    # Every worker tampers and maxAttempts=1, so the single attempt fails its
    # MAC check and the coordinator returns 502 (exhausted). The SDK surfaces
    # that as VerificationFailed and NEVER returns an unverified result.
    client = Client(all_tamper_fabric.url)
    job = matvec([[1.0, 2.0], [3.0, 4.0]], [5.0, 6.0], n=3, max_attempts=1)

    with pytest.raises(VerificationFailed) as exc:
        client.submit(job, budget_millicredits=10_000_000)

    assert exc.value.attempts, "attempts detail should be attached"
    assert all(a["verified"] is False for a in exc.value.attempts)

    # SPEC-003 invariant: a rejected attempt bills the customer nothing.
    ledger = client.get_ledger()
    assert ledger["customerBilledMillicredits"] == 0


def test_self_heal_quarantines_tamperers_and_still_verifies(self_heal_fabric):
    # 3 tamperers (picked first by LRU) + 5 clean workers, maxAttempts=3.
    # Attempt 1 lands on the tamperers, fails, quarantines them; attempt 2
    # runs on clean workers and verifies. Documents the coordinator's
    # self-healing behavior: the customer still receives a verified result,
    # and only the verified attempt is billed.
    client = Client(self_heal_fabric.url)
    x = [2.0, -4.0, 8.0]
    job = matvec([[1.0, 0.5, -0.25], [-2.0, 1.25, 0.5]], x, n=3, max_attempts=3)

    result = client.submit(job, budget_millicredits=10_000_000)

    assert result.attempts[-1]["verified"] is True
    assert len(result.attempts) >= 2  # at least one rejected attempt first
    assert result.billing["rejectedAttemptsNotBilled"] >= 1

    expected = _matvec([[1.0, 0.5, -0.25], [-2.0, 1.25, 0.5]], x)
    for got, want in zip(result.result, expected):
        assert abs(got - want) < TOL

    # Tamperers are quarantined in the fleet roster.
    quarantined = [w for w in client.get_workers() if w["quarantined"]]
    assert len(quarantined) == 3
    assert all(w["id"].startswith("tamper-") for w in quarantined)

    # Quote == bill still holds for the (single) VERIFIED attempt: billing
    # reflects one paid attempt of n workers, not the rejected one.
    quote = client.estimate(job)
    assert result.customer_millicredits == quote.customer_millicredits
