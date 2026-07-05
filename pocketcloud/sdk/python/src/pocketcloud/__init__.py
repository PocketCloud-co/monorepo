"""Pocket Cloud customer SDK (managed mode).

Submit a private, verified distributed job in ~5 lines::

    from pocketcloud import Client, matvec
    client = Client("http://127.0.0.1:4600")
    job = matvec([[1.0, 0.5], [-2.0, 1.25]], [2.0, -4.0])
    result = client.submit(job, budget_millicredits=100_000)
    print(result.result)

See ``README.md`` for the full guide.
"""

from __future__ import annotations

from .client import Client, JobResult, Quote
from .exceptions import (
    BudgetExceeded,
    JobFailed,
    PocketCloudError,
    PrivacyParameterError,
    VerificationFailed,
)
from .jobs import Job, matvec, private_dot

__version__ = "0.0.1"

__all__ = [
    "Client",
    "Quote",
    "JobResult",
    "Job",
    "matvec",
    "private_dot",
    "PocketCloudError",
    "PrivacyParameterError",
    "BudgetExceeded",
    "VerificationFailed",
    "JobFailed",
    "__version__",
]
