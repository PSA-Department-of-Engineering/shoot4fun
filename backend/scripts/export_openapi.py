"""Export the OpenAPI spec to openapi.json at the project root."""

from __future__ import annotations

import json
import sys
from pathlib import Path

__all__ = ["main"]


def main() -> None:
    """Write the OpenAPI spec to openapi.json.

    Adds the project root to sys.path so this runs whether or not the package is
    installed (for example, straight after scaffolding, before `pip install -e .`).
    """
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))

    from shoot4fun_backend.adapters.inbound.http.app import create_app

    app = create_app()
    out = root / "openapi.json"
    out.write_text(json.dumps(app.openapi(), indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
