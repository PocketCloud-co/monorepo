"""Job models and template builders.

A :class:`Job` is an immutable description of work to submit. Build one with a
template helper (:func:`matvec` or :func:`private_dot`); each validates its
privacy parameters and data shape CLIENT-SIDE, before anything touches the
network (SDK-R6). The wire body produced by :meth:`Job.to_body` is exactly the
SPEC-003 section 1 request shape.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Union

from .exceptions import PrivacyParameterError

Number = Union[int, float]

# Privacy / re-dispatch bounds, mirrored from SPEC-003 section 1 so violations
# are caught before dispatch rather than as a mid-protocol coordinator error.
N_MIN = 2  # privacy floor: n = 1 would hand one worker the plaintext
N_MAX = 16
MAX_ATTEMPTS_MIN = 1
MAX_ATTEMPTS_MAX = 10
DEFAULT_N = 3
DEFAULT_MAX_ATTEMPTS = 3


def _validate_n(n: int) -> None:
    if not isinstance(n, int) or isinstance(n, bool):
        raise PrivacyParameterError(f"n must be an integer, got {n!r}")
    if n < N_MIN:
        raise PrivacyParameterError(
            f"n must be >= {N_MIN} (privacy floor: n = 1 would deliver the "
            f"encoded plaintext to a single worker); got n = {n}"
        )
    if n > N_MAX:
        raise PrivacyParameterError(f"n must be <= {N_MAX}, got n = {n}")


def _validate_max_attempts(max_attempts: int) -> None:
    if not isinstance(max_attempts, int) or isinstance(max_attempts, bool):
        raise PrivacyParameterError(
            f"max_attempts must be an integer, got {max_attempts!r}"
        )
    if not (MAX_ATTEMPTS_MIN <= max_attempts <= MAX_ATTEMPTS_MAX):
        raise PrivacyParameterError(
            f"max_attempts must be in [{MAX_ATTEMPTS_MIN}, {MAX_ATTEMPTS_MAX}], "
            f"got {max_attempts}"
        )


def _is_finite_number(v: Any) -> bool:
    if isinstance(v, bool):
        return False
    if not isinstance(v, (int, float)):
        return False
    return v == v and v not in (float("inf"), float("-inf"))


def _validate_vector(name: str, v: Any) -> None:
    if not isinstance(v, (list, tuple)) or len(v) == 0:
        raise PrivacyParameterError(f"{name} must be a non-empty list of numbers")
    if not all(_is_finite_number(x) for x in v):
        raise PrivacyParameterError(f"{name} must contain only finite numbers")


@dataclass(frozen=True)
class Job:
    """An immutable, validated job ready to estimate or submit."""

    template: str
    n: int
    max_attempts: int
    payload: dict[str, Any] = field(default_factory=dict)

    def to_body(self) -> dict[str, Any]:
        """Render the SPEC-003 section 1 request body."""
        return {
            "template": self.template,
            "n": self.n,
            "maxAttempts": self.max_attempts,
            **self.payload,
        }


def matvec(
    matrix: list[list[Number]],
    input: list[Number],
    *,
    n: int = DEFAULT_N,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> Job:
    """Build a private matrix-vector product job (public matrix, private input).

    Computes ``matrix @ input`` where ``input`` is secret-shared across ``n``
    workers and never revealed. ``matrix`` is a public model.
    """
    _validate_n(n)
    _validate_max_attempts(max_attempts)

    if not isinstance(matrix, (list, tuple)) or len(matrix) == 0:
        raise PrivacyParameterError("matrix must be a non-empty list of rows")
    cols = len(matrix[0]) if isinstance(matrix[0], (list, tuple)) else -1
    if cols <= 0:
        raise PrivacyParameterError("matrix rows must be non-empty lists")
    for row in matrix:
        if not isinstance(row, (list, tuple)) or len(row) != cols:
            raise PrivacyParameterError("matrix must be rectangular (equal-length rows)")
        if not all(_is_finite_number(x) for x in row):
            raise PrivacyParameterError("matrix must contain only finite numbers")
    _validate_vector("input", input)
    if len(input) != cols:
        raise PrivacyParameterError(
            f"input length ({len(input)}) must equal matrix columns ({cols})"
        )

    return Job(
        template="matvec",
        n=n,
        max_attempts=max_attempts,
        payload={"matrix": [list(r) for r in matrix], "input": list(input)},
    )


def private_dot(
    x: list[Number],
    y: list[Number],
    *,
    n: int = DEFAULT_N,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
) -> Job:
    """Build a private dot-product job (both vectors private).

    Computes ``<x, y>`` where both ``x`` and ``y`` are secret-shared across
    ``n`` workers via Beaver triples; neither vector is revealed.
    """
    _validate_n(n)
    _validate_max_attempts(max_attempts)
    _validate_vector("x", x)
    _validate_vector("y", y)
    if len(x) != len(y):
        raise PrivacyParameterError(
            f"x and y must have equal length ({len(x)} != {len(y)})"
        )

    return Job(
        template="private-dot",
        n=n,
        max_attempts=max_attempts,
        payload={"x": list(x), "y": list(y)},
    )
