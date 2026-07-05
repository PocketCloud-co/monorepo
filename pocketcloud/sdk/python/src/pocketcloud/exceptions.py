"""Typed exceptions for the Pocket Cloud customer SDK.

Every failure path a caller can hit surfaces as one of these. They are the
public, documented contract (FT-04 SDK-R2/R4/R6): user code catches the
specific type, never a bare ``Exception`` or an HTTP status code.
"""

from __future__ import annotations

from typing import Any, Optional


class PocketCloudError(Exception):
    """Base class for every error raised by the SDK.

    Catch this to handle any SDK failure generically; catch a subclass to
    handle a specific condition.
    """


class PrivacyParameterError(PocketCloudError, ValueError):
    """A privacy parameter (e.g. ``n``) violates a client-side invariant.

    Raised BEFORE any network call. ``n >= 2`` is a privacy floor, not a
    tuning default: with ``n = 1`` the single "share" would be the encoded
    plaintext delivered to one worker (SPEC-001 section 3, SPEC-003 section 1).
    The SDK refuses to build or submit such a job so the plaintext never
    leaves the process.
    """


class BudgetExceeded(PocketCloudError):
    """The upfront quote exceeds the caller-supplied budget.

    Raised client-side BEFORE the job is submitted (SDK-R4): exceeding budget
    is a refusal, never a surprise invoice. No job is created and nothing is
    billed.
    """

    def __init__(
        self,
        message: str,
        *,
        quote_millicredits: int,
        budget_millicredits: int,
    ) -> None:
        super().__init__(message)
        self.quote_millicredits = quote_millicredits
        self.budget_millicredits = budget_millicredits


class VerificationFailed(PocketCloudError):
    """The fabric could not return a MAC-verified result.

    Raised when the coordinator exhausted its re-dispatch budget without a
    single attempt passing verification (SPEC-003 502), or if a result that
    reached the SDK is not marked verified. A non-verified result is never
    returned to user code (SDK-R2).
    """

    def __init__(
        self,
        message: str,
        *,
        job_id: Optional[str] = None,
        attempts: Optional[list[dict[str, Any]]] = None,
    ) -> None:
        super().__init__(message)
        self.job_id = job_id
        self.attempts = attempts or []


class JobFailed(PocketCloudError):
    """The job failed for a reason other than verification.

    Covers boundary rejections (HTTP 400 for a malformed job), transport
    errors, and unexpected coordinator responses. ``status`` carries the HTTP
    status when one is available.
    """

    def __init__(
        self,
        message: str,
        *,
        status: Optional[int] = None,
        job_id: Optional[str] = None,
        attempts: Optional[list[dict[str, Any]]] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.job_id = job_id
        self.attempts = attempts or []
