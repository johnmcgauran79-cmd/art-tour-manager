#!/usr/bin/env python3
"""Keep only the newest N dated backup folders for one kind.

Usage: prune_backups.py <database|storage|code> <keep-count>

Deletes older dated folders (and every part inside them) from the private
"database-backups" Supabase Storage bucket so backups never fill the project's
storage quota. Never fails the workflow: problems are reported and ignored.
"""
import json
import os
import sys
import urllib.error
import urllib.request

PROJECT_URL = "https://upqvgtuxfzsrwjahklij.supabase.co"
BUCKET = "database-backups"


def request(method: str, path: str, payload=None):
    key = os.environ.get("SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        raise RuntimeError("SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY is not set")
    body = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"{PROJECT_URL}{path}",
        data=body,
        method=method,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode() or "null"
    return json.loads(raw)


def listing(prefix: str):
    out = []
    offset = 0
    while True:
        page = request(
            "POST",
            f"/storage/v1/object/list/{BUCKET}",
            {"prefix": prefix, "limit": 1000, "offset": offset},
        ) or []
        out.extend(page)
        if len(page) < 1000:
            break
        offset += len(page)
    return out


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: prune_backups.py <kind> <keep-count>", file=sys.stderr)
        return 0

    kind = sys.argv[1]
    try:
        keep = max(1, int(sys.argv[2]))
    except ValueError:
        print(f"Invalid keep count {sys.argv[2]!r} - skipping prune.")
        return 0

    folders = sorted({o["name"] for o in listing(f"{kind}/") if o.get("name")})
    if len(folders) <= keep:
        print(f"{kind}: {len(folders)} copy(ies) stored, keeping up to {keep} - nothing to remove.")
        return 0

    stale = folders[:-keep]
    print(f"{kind}: keeping {folders[-keep:]}, removing {stale}")

    removed = 0
    for folder in stale:
        paths = [
            f"{kind}/{folder}/{o['name']}"
            for o in listing(f"{kind}/{folder}/")
            if o.get("name")
        ]
        for i in range(0, len(paths), 50):
            batch = paths[i:i + 50]
            request("DELETE", f"/storage/v1/object/{BUCKET}", {"prefixes": batch})
            removed += len(batch)
    print(f"{kind}: removed {removed} file(s) from {len(stale)} old folder(s).")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (urllib.error.URLError, urllib.error.HTTPError, RuntimeError, KeyError) as exc:
        print(f"Prune skipped: {exc}")
        sys.exit(0)
