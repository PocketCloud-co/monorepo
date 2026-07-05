"""The Pocket Cloud client: estimate, submit, ledger.

Managed-mode SDK (FT-04 milestone M1). Standard library only — ``urllib`` for
transport, ``json`` for encoding, ``dataclasses`` for the result types. The
coordinator (SPEC-003) handles dealing and verification in managed mode; the
call shape here mirrors ``poc/src/client/client.js``.
"""

from __future__ import annotations

import json
import threading
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional, Union

from .exceptions import (
    BudgetExceeded,
    JobFailed,
    PocketCloudError,
    VerificationFailed,
)
from .jobs import Job

Result = Union[float, list[float]]


@dataclass(frozen=True)
class Quote:
    """An exact upfront quote for a job (SPEC-003 section 2).

    Work units are a pure function of the job's shape, so the meter reading is
    known before anything runs. ``customer_millicredits`` is the total the
    customer pays for a single verified attempt.
    """

    template: str
    n: int
    units_per_worker: int
    customer_millicredits: int
    per_worker_millicredits: int
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class JobResult:
    """A verified job result (SPEC-003 section 1, HTTP 200)."""

    job_id: str
    result: Result
    attempts: list[dict[str, Any]]
    billing: dict[str, Any]
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def customer_millicredits(self) -> int:
        return int(self.billing.get("customerMillicredits", 0))


class Client:
    """Client for a Pocket Cloud coordinator.

    Example (the 5-line happy path, SDK-R1)::

        from pocketcloud import Client, matvec
        client = Client("http://127.0.0.1:4600")
        job = matvec([[1.0, 0.5], [-2.0, 1.25]], [2.0, -4.0])
        result = client.submit(job, budget_millicredits=100_000)
        print(result.result)
    """

    def __init__(self, coordinator_url: str, *, timeout: float = 30.0) -> None:
        if not coordinator_url:
            raise ValueError("coordinator_url is required")
        self.coordinator_url = coordinator_url.rstrip("/")
        self.timeout = timeout
        # Idempotency cache: key -> JobResult. Guards against a retried submit
        # (same key) re-dispatching and double-billing (SDK-R5, SDK-003). We
        # model the token client-side because the PoC coordinator is stateless
        # on this axis; v1 will carry the token on the wire (SPEC-003 section 4).
        self._idempotency: dict[str, JobResult] = {}
        self._idempotency_inflight: set[str] = set()
        self._lock = threading.Lock()

    # --- transport ---------------------------------------------------------

    def _post(self, path: str, body: dict[str, Any]) -> tuple[int, dict[str, Any]]:
        data = json.dumps(body).encode("utf-8")
        req = urllib.request.Request(
            f"{self.coordinator_url}{path}",
            data=data,
            headers={"content-type": "application/json"},
            method="POST",
        )
        return self._send(req)

    def _get(self, path: str) -> tuple[int, dict[str, Any]]:
        req = urllib.request.Request(
            f"{self.coordinator_url}{path}", method="GET"
        )
        return self._send(req)

    def _send(self, req: urllib.request.Request) -> tuple[int, dict[str, Any]]:
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            # The coordinator returns a JSON body with error detail on 4xx/5xx
            # (e.g. 502 exhausted attempts, 400 bad request). Parse it so the
            # caller gets a typed error, not a raw HTTPError.
            payload_bytes = exc.read()
            try:
                payload = json.loads(payload_bytes.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                payload = {"error": payload_bytes.decode("utf-8", "replace")}
            return exc.code, payload
        except urllib.error.URLError as exc:
            raise JobFailed(f"transport error contacting coordinator: {exc.reason}")

    # --- public API --------------------------------------------------------

    def estimate(self, job: Job) -> Quote:
        """Return an exact upfront quote for ``job`` (SPEC-003 section 2).

        Does not create a job or bill anything.
        """
        status, body = self._post("/jobs/estimate", job.to_body())
        if status != 200:
            raise JobFailed(
                f"estimate rejected: {body.get('error', body)}", status=status
            )
        return Quote(
            template=body["template"],
            n=body["n"],
            units_per_worker=body["unitsPerWorker"],
            customer_millicredits=body["customerMillicredits"],
            per_worker_millicredits=body["perWorkerMillicredits"],
            raw=body,
        )

    def submit(
        self,
        job: Job,
        *,
        budget_millicredits: Optional[int] = None,
        idempotency_key: Optional[str] = None,
    ) -> JobResult:
        """Submit ``job`` and return the verified result.

        - Refuses client-side if the quote exceeds ``budget_millicredits``
          (:class:`BudgetExceeded`) BEFORE any job is created (SDK-R4).
        - Raises :class:`VerificationFailed` if the fabric cannot return a
          MAC-verified result (SDK-R2). An unverified result is never returned.
        - With ``idempotency_key`` set, a repeated submit returns the cached
          result instead of re-dispatching (SDK-R5).
        """
        # Defense in depth: builders already enforce this, but never let a
        # sub-floor n reach the network even if a Job was hand-constructed.
        from .jobs import _validate_n  # local import avoids cycle at module load

        _validate_n(job.n)

        # Idempotency: return a cached result without re-submitting.
        if idempotency_key is not None:
            with self._lock:
                cached = self._idempotency.get(idempotency_key)
                if cached is not None:
                    return cached
                if idempotency_key in self._idempotency_inflight:
                    raise PocketCloudError(
                        f"idempotency key {idempotency_key!r} is already in flight"
                    )
                self._idempotency_inflight.add(idempotency_key)

        try:
            # Budget check BEFORE dispatch. estimate() hits /jobs/estimate,
            # which never creates a job or a ledger entry, so a refusal here
            # bills nothing.
            quote = self.estimate(job)
            if (
                budget_millicredits is not None
                and quote.customer_millicredits > budget_millicredits
            ):
                raise BudgetExceeded(
                    f"quote {quote.customer_millicredits} millicredits exceeds "
                    f"budget {budget_millicredits}; job not submitted",
                    quote_millicredits=quote.customer_millicredits,
                    budget_millicredits=budget_millicredits,
                )

            result = self._dispatch(job)

            if idempotency_key is not None:
                with self._lock:
                    self._idempotency[idempotency_key] = result
            return result
        finally:
            if idempotency_key is not None:
                with self._lock:
                    self._idempotency_inflight.discard(idempotency_key)

    def _dispatch(self, job: Job) -> JobResult:
        status, body = self._post("/jobs", job.to_body())

        if status == 200 and body.get("ok"):
            attempts = body.get("attempts", [])
            # SDK-R2 belt-and-braces: the coordinator only returns ok on a
            # verified attempt, but re-check here so an unverified result is
            # unreachable through this API no matter what the wire says.
            if not attempts or not attempts[-1].get("verified"):
                raise VerificationFailed(
                    "coordinator returned ok without a verified final attempt",
                    job_id=body.get("jobId"),
                    attempts=attempts,
                )
            return JobResult(
                job_id=body["jobId"],
                result=body["result"],
                attempts=attempts,
                billing=body.get("billing", {}),
                raw=body,
            )

        # 502: exhausted re-dispatch budget without a verified result.
        if status == 502:
            raise VerificationFailed(
                body.get("error", "exhausted attempts without a verified result"),
                job_id=body.get("jobId"),
                attempts=body.get("attempts", []),
            )

        # Anything else (400 malformed job, 500, unexpected shape).
        raise JobFailed(
            f"job failed: {body.get('error', body)}",
            status=status,
            job_id=body.get("jobId"),
            attempts=body.get("attempts", []),
        )

    def get_ledger(self) -> dict[str, Any]:
        """Return the coordinator's ledger summary (SPEC-003 section 3)."""
        status, body = self._get("/ledger")
        if status != 200:
            raise JobFailed(f"ledger fetch failed: {body.get('error', body)}", status=status)
        return body

    def get_workers(self) -> list[dict[str, Any]]:
        """Return the fleet roster (SPEC-003 section 3). Useful for diagnostics."""
        status, body = self._get("/workers")
        if status != 200:
            raise JobFailed(f"workers fetch failed: {body.get('error', body)}", status=status)
        return body.get("workers", [])
