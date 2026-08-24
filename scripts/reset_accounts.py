"""Reset production access for Shoot4Fun: purge SQL plus account seeding.

A reset is two steps, because the API surface deliberately cannot delete an
account (REF-Identity: there is no operator and no email to authenticate a
remote teardown):

1. PURGE - cluster-side SQL against the shoot4fun database. Child tables
   cascade off `accounts`; the leaderboard carries holder names as plain
   text with no foreign key, so clearing it is explicit and optional.
   Print the statements with `purge-sql` and run them through kubectl exec
   into the database pod:

       kubectl exec -n shoot4fun deploy/shoot4fun-postgres -- \
           psql -U pg-app-shoot4fun -d shoot4fun \
           -c "$(python scripts/reset_accounts.py purge-sql)"

2. SEED - mint each permanent account through the app's own entry path,
   guest first, then in-place registration, so the password digest is
   produced by the running service itself and matches whatever hashing it
   ships. Every seeded account is then proven with a real sign-in before
   the script reports success. Registered accounts are never swept, so
   these rows persist until the next purge.

       python scripts/reset_accounts.py seed \
           --base-url https://shoot4fun.chaos-architect.dev \
           --account carter --account katael

Secrets come from `--account name:password` or fall back to the
S4F_SEED_PASSWORD environment variable, and are never echoed back.

Exit status is non-zero if any step fails, so this can gate automation.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

__all__ = ["main"]

DEFAULT_BASE_URL = "https://shoot4fun.chaos-architect.dev"
PASSWORD_ENV_VAR = "S4F_SEED_PASSWORD"
MIN_PASSWORD_LENGTH = 8  # mirrored from AccountService.PASSWORD_MIN_LENGTH
TIMEOUT_SECONDS = 20
# The edge (Cloudflare error 1010) refuses the default Python-urllib signature,
# so requests identify themselves with this script's own agent instead.
USER_AGENT = "s4f-reset-accounts/1.0"


def _post(
    base_url: str, path: str, payload: dict | None = None, token: str | None = None
) -> tuple[int, dict]:
    body = json.dumps(payload).encode() if payload is not None else b"{}"
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT},
        method="POST",
    )
    if token:
        request.add_header("X-S4F-Session", token)
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")
        try:
            return exc.code, json.loads(detail)
        except json.JSONDecodeError:
            return exc.code, {"detail": detail}
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{path} unreachable: {exc.reason}") from exc


def _password_for(spec: str) -> tuple[str, str]:
    """Split `name` or `name:password` into its parts, applying the env fallback."""
    name, separator, explicit = spec.partition(":")
    name = name.strip()
    if not name:
        raise ValueError(f"empty account name in {spec!r}")
    password = explicit if separator else os.environ.get(PASSWORD_ENV_VAR, "")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"{name}: password must be at least {MIN_PASSWORD_LENGTH} characters "
            f"(set it via {spec}:<password> or {PASSWORD_ENV_VAR})"
        )
    return name, password


def _seed_one(base_url: str, name: str, password: str) -> str:
    status, body = _post(base_url, "/api/account/guest")
    if status != 201:
        raise RuntimeError(f"{name}: guest mint failed ({status}): {body}")
    token = body["token"]

    status, body = _post(
        base_url,
        "/api/account/create",
        {"display_name": name, "password": password},
        token=token,
    )
    if status == 409:
        raise RuntimeError(
            f"{name}: display name already taken - run the purge step first"
        )
    if status != 200:
        raise RuntimeError(f"{name}: registration failed ({status}): {body}")
    user_id = body.get("user_id", "?")

    status, body = _post(
        base_url, "/api/account/sign-in", {"display_name": name, "password": password}
    )
    if status != 200 or not body.get("token"):
        raise RuntimeError(f"{name}: post-seed sign-in failed ({status}): {body}")
    print(f"{name}: seeded and sign-in verified (user_id={user_id})")
    return user_id


def cmd_seed(args: argparse.Namespace) -> int:
    accounts = [_password_for(spec) for spec in args.account]
    failures = 0
    for name, password in accounts:
        try:
            _seed_one(args.base_url, name, password)
        except (RuntimeError, ValueError, KeyError) as exc:
            failures += 1
            print(f"{name}: FAILED - {exc}", file=sys.stderr)
    return 1 if failures else 0


def cmd_verify(args: argparse.Namespace) -> int:
    failures = 0
    for spec in args.account:
        name, password = _password_for(spec)
        status, body = _post(
            args.base_url,
            "/api/account/sign-in",
            {"display_name": name, "password": password},
        )
        if status == 200 and body.get("token"):
            print(f"{name}: sign-in ok")
        else:
            failures += 1
            print(f"{name}: FAILED ({status}): {body}", file=sys.stderr)
    return 1 if failures else 0


def cmd_purge_sql(_: argparse.Namespace) -> int:
    # The child-table deletes are explicit for readability even though the
    # foreign keys cascade them; leaderboard has no FK, so it must be named.
    print(
        "DELETE FROM account_sessions;\n"
        "DELETE FROM account_profiles;\n"
        "DELETE FROM arsenal_profiles;\n"
        "DELETE FROM accounts;\n"
        "DELETE FROM leaderboard;\n"
        "SELECT count(*) AS remaining_accounts FROM accounts;"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    base = argparse.ArgumentParser(add_help=False)
    base.add_argument(
        "--base-url", default=DEFAULT_BASE_URL, help=f"default: {DEFAULT_BASE_URL}"
    )

    seed = sub.add_parser("seed", parents=[base], help="guest + register + verify")
    seed.add_argument(
        "--account",
        action="append",
        required=True,
        metavar="NAME[:PASSWORD]",
        help="repeatable; password falls back to $S4F_SEED_PASSWORD",
    )
    seed.set_defaults(func=cmd_seed)

    verify = sub.add_parser("verify", parents=[base], help="sign-in only")
    verify.add_argument(
        "--account", action="append", required=True, metavar="NAME[:PASSWORD]"
    )
    verify.set_defaults(func=cmd_verify)

    purge = sub.add_parser("purge-sql", help="print the cluster-side purge SQL")
    purge.set_defaults(func=cmd_purge_sql)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
