"""Download every object from every Supabase Storage bucket (except the backup
bucket itself) into ./storage-dump, plus a manifest.json listing what was saved.

Requires SERVICE_KEY in the environment. Writes files=<count> to GITHUB_OUTPUT
when that variable is set.
"""

import json
import os
import pathlib
import urllib.parse
import urllib.request

PROJECT = "https://upqvgtuxfzsrwjahklij.supabase.co"
KEY = os.environ["SERVICE_KEY"]
SKIP = {"database-backups"}
ROOT = pathlib.Path("storage-dump")
PAGE = 1000


def api(path, body=None):
    req = urllib.request.Request(
        f"{PROJECT}/storage/v1/{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read())


def download(bucket, key, dest):
    req = urllib.request.Request(
        f"{PROJECT}/storage/v1/object/{bucket}/{urllib.parse.quote(key)}",
        headers={"Authorization": f"Bearer {KEY}"},
    )
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)


def walk(bucket, prefix=""):
    offset = 0
    while True:
        items = api(
            f"object/list/{bucket}",
            {
                "prefix": prefix,
                "limit": PAGE,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            },
        )
        if not items:
            return
        for it in items:
            name = f"{prefix}{it['name']}"
            if it.get("id") is None and it.get("metadata") is None:
                yield from walk(bucket, name + "/")
            else:
                yield name
        if len(items) < PAGE:
            return
        offset += len(items)


def main():
    buckets = [b["name"] for b in api("bucket") if b["name"] not in SKIP]
    ROOT.mkdir(exist_ok=True)
    manifest = []
    for bucket in buckets:
        for key in walk(bucket):
            dest = ROOT / bucket / key
            download(bucket, key, dest)
            manifest.append({"bucket": bucket, "key": key, "bytes": dest.stat().st_size})
    (ROOT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(f"Downloaded {len(manifest)} object(s) from {len(buckets)} bucket(s).")
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"files={len(manifest)}\n")


if __name__ == "__main__":
    main()
