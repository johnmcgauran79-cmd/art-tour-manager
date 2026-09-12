#!/usr/bin/env python3
"""Copy backup parts to SharePoint via Microsoft Graph.

Usage: sharepoint_upload.py <kind> <artifact-name>

Uploads every ./part-* file (produced by `split` in the workflow) as
"<artifact-name>.<part>" into:

    <site drive>/ART Admin Backups/<kind>/<YYYY-MM-DD>/

If no part-* files exist, the artifact itself is uploaded.

Required environment:
    MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET
    SHAREPOINT_SITE_PATH  e.g. contoso.sharepoint.com:/sites/Operations
Optional:
    SHAREPOINT_FOLDER     default "ART Admin Backups"

Writes "destination=..." to $GITHUB_OUTPUT on success. Exits non-zero on
failure; the workflow step is continue-on-error so the primary copies are
never put at risk.
"""
import glob
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

GRAPH = "https://graph.microsoft.com/v1.0"
CHUNK = 8 * 1024 * 1024  # 8MB, must be a multiple of 320KiB
SIMPLE_MAX = 4 * 1024 * 1024


def fail(msg: str) -> "None":
    print(f"::warning::SharePoint copy failed: {msg}")
    sys.exit(1)


def request(url, *, method="GET", data=None, headers=None):
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read()
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:600]
        fail(f"{method} {url.split('?')[0]} -> {e.code}: {detail}")


def token(tenant: str, client_id: str, secret: str) -> str:
    body = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": secret,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }
    ).encode()
    _, payload = request(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        method="POST",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    access = payload.get("access_token")
    if not access:
        fail("no access token returned")
    return access


def upload_small(access, site_id, path, file_path):
    with open(file_path, "rb") as fh:
        data = fh.read()
    request(
        f"{GRAPH}/sites/{site_id}/drive/root:/{urllib.parse.quote(path)}:/content",
        method="PUT",
        data=data,
        headers={
            "Authorization": f"Bearer {access}",
            "Content-Type": "application/octet-stream",
        },
    )


def upload_large(access, site_id, path, file_path):
    _, session = request(
        f"{GRAPH}/sites/{site_id}/drive/root:/{urllib.parse.quote(path)}:/createUploadSession",
        method="POST",
        data=json.dumps({"item": {"@microsoft.graph.conflictBehavior": "replace"}}).encode(),
        headers={
            "Authorization": f"Bearer {access}",
            "Content-Type": "application/json",
        },
    )
    url = session.get("uploadUrl")
    if not url:
        fail("no uploadUrl returned")
    total = os.path.getsize(file_path)
    sent = 0
    with open(file_path, "rb") as fh:
        while sent < total:
            chunk = fh.read(CHUNK)
            end = sent + len(chunk) - 1
            request(
                url,
                method="PUT",
                data=chunk,
                headers={
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {sent}-{end}/{total}",
                },
            )
            sent = end + 1


def main():
    if len(sys.argv) < 3:
        fail("usage: sharepoint_upload.py <kind> <artifact-name>")
    kind, artifact = sys.argv[1], sys.argv[2]

    tenant = os.environ.get("MS_GRAPH_TENANT_ID", "").strip()
    client_id = os.environ.get("MS_GRAPH_CLIENT_ID", "").strip()
    secret = os.environ.get("MS_GRAPH_CLIENT_SECRET", "").strip()
    site_path = os.environ.get("SHAREPOINT_SITE_PATH", "").strip()
    folder = os.environ.get("SHAREPOINT_FOLDER", "ART Admin Backups").strip("/")
    if not (tenant and client_id and secret and site_path):
        print("SharePoint copy skipped: SharePoint secrets are not configured.")
        return

    access = token(tenant, client_id, secret)
    _, site = request(
        f"{GRAPH}/sites/{site_path}",
        headers={"Authorization": f"Bearer {access}"},
    )
    site_id = site.get("id")
    if not site_id:
        fail(f"could not resolve site {site_path}")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    parts = sorted(glob.glob("part-*"))
    uploads = (
        [(f"{artifact}.{p}", p) for p in parts] if parts else [(artifact, artifact)]
    )

    for name, local in uploads:
        if not os.path.isfile(local):
            fail(f"missing local file {local}")
        target = f"{folder}/{kind}/{stamp}/{name}"
        if os.path.getsize(local) <= SIMPLE_MAX:
            upload_small(access, site_id, target, local)
        else:
            upload_large(access, site_id, target, local)
        print(f"Uploaded to SharePoint: {target}")

    destination = f"sharepoint://{site_path}/{folder}/{kind}/{stamp}/ ({len(uploads)} parts)"
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as fh:
            fh.write(f"destination={destination}\n")


if __name__ == "__main__":
    main()
