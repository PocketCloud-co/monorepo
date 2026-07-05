"""Pytest fixtures: boot a real PoC coordinator + workers as a subprocess.

Per FT-04 QA requirements and Standards §3, the SDK is contract-tested against
a LIVE ephemeral coordinator (not mocks). Each fixture spawns
``tests/launcher.mjs`` with Node, reads the coordinator URL from its first
stdout line, and tears the process down afterwards.
"""

from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
LAUNCHER = os.path.join(HERE, "launcher.mjs")


@dataclass
class Fabric:
    url: str
    workers: int
    tamper: int


def _boot(workers: int, tamper: int) -> tuple[subprocess.Popen, Fabric]:
    node = shutil.which("node")
    if node is None:
        pytest.skip("node is not available on PATH; required for the live coordinator")

    env = dict(os.environ, PC_WORKERS=str(workers), PC_TAMPER=str(tamper))
    proc = subprocess.Popen(
        [node, LAUNCHER],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    # First stdout line carries the coordinator URL as JSON.
    deadline = time.time() + 20
    line = None
    while time.time() < deadline:
        assert proc.stdout is not None
        line = proc.stdout.readline()
        if line:
            break
        if proc.poll() is not None:
            err = proc.stderr.read() if proc.stderr else ""
            raise RuntimeError(f"launcher exited early: {err}")
    if not line:
        proc.kill()
        raise RuntimeError("launcher did not print a coordinator URL in time")

    info = json.loads(line)
    return proc, Fabric(url=info["url"], workers=info["workers"], tamper=info["tamper"])


def _teardown(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


@pytest.fixture(scope="module")
def fabric():
    """A healthy fabric: 5 clean workers, no tamperers."""
    proc, info = _boot(workers=5, tamper=0)
    try:
        yield info
    finally:
        _teardown(proc)


@pytest.fixture()
def all_tamper_fabric():
    """A fabric where every worker tampers (3 tamperers).

    Function-scoped: quarantine mutates coordinator state, so each test that
    needs a fresh cheating fleet gets its own.
    """
    proc, info = _boot(workers=3, tamper=3)
    try:
        yield info
    finally:
        _teardown(proc)


@pytest.fixture()
def self_heal_fabric():
    """A fabric that self-heals: 3 tamperers (picked first) + 5 clean workers."""
    proc, info = _boot(workers=8, tamper=3)
    try:
        yield info
    finally:
        _teardown(proc)
