"""Shared test fixtures.

The intent spec lives at the repo root (one `intent.yaml` for the whole
Shoot4Fun delivery, audited by `python -m csd_intent.cli .` from `D:\\Personal\\shoot4fun`).
`pack_root` points pytest-intent at that file so claim-to-test wiring is
audited end-to-end across the backend, the client, and the e2e tree.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DISABLE_TICK_LOOP", "1")

from shoot4fun_backend.adapters.inbound.http.app import create_app  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="session")
def pack_root() -> Path:
    return REPO_ROOT


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app())
