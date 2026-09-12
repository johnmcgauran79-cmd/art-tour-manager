#!/usr/bin/env bash
# Pull the newest ART Admin backups (database, uploaded files, source code)
# from the private Supabase storage bucket onto a local or external drive.
#
# Usage:
#   export SUPABASE_SERVICE_ROLE_KEY="...service role key..."
#   ./scripts/local-backup-pull.sh /Volumes/ART-Backups [keep-days]
#
# Creates <dest>/<date>/ containing the rejoined archives.

set -euo pipefail

DEST="${1:-}"
KEEP_DAYS="${2:-0}"
PROJECT_URL="https://upqvgtuxfzsrwjahklij.supabase.co"
BUCKET="database-backups"

if [ -z "$DEST" ]; then
  echo "Usage: $0 <destination-folder> [keep-days]" >&2
  exit 1
fi
if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Set SUPABASE_SERVICE_ROLE_KEY first (Supabase > Project Settings > API)." >&2
  exit 1
fi

api_list() { # $1 = prefix
  curl -sS -X POST "$PROJECT_URL/storage/v1/object/list/$BUCKET" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$1\",\"limit\":1000,\"sortBy\":{\"column\":\"name\",\"order\":\"desc\"}}"
}

names() { python3 -c 'import json,sys; [print(o["name"]) for o in json.load(sys.stdin)]'; }

for KIND in database storage code; do
  LATEST=$(api_list "$KIND/" | names | sort -r | head -n 1 || true)
  if [ -z "$LATEST" ]; then
    echo "No $KIND backup found yet — skipping."
    continue
  fi
  OUT="$DEST/$LATEST"
  mkdir -p "$OUT"
  echo "== $KIND backup $LATEST"

  PARTS=$(api_list "$KIND/$LATEST/" | names | sort)
  if [ -z "$PARTS" ]; then
    echo "  (folder is empty)"
    continue
  fi

  TMP=$(mktemp -d)
  BASE=""
  for P in $PARTS; do
    echo "  downloading $P"
    curl -sS -f -o "$TMP/$P" \
      -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
      "$PROJECT_URL/storage/v1/object/$BUCKET/$KIND/$LATEST/$P"
    BASE="${P%.part-*}"
  done

  if ls "$TMP"/*.part-* >/dev/null 2>&1; then
    cat "$TMP"/*.part-* > "$OUT/$BASE"
  else
    mv "$TMP"/* "$OUT/"
    BASE=$(ls "$OUT" | head -n 1)
  fi
  rm -rf "$TMP"

  SIZE=$(du -h "$OUT/$BASE" | cut -f1)
  echo "  saved $OUT/$BASE ($SIZE)"

  if [[ "$BASE" == *.bundle ]]; then
    if git bundle verify "$OUT/$BASE" >/dev/null 2>&1; then
      echo "  code bundle verified OK"
    else
      echo "  WARNING: code bundle failed verification" >&2
    fi
  fi
done

if [ "$KEEP_DAYS" -gt 0 ] 2>/dev/null; then
  echo "Removing local backup folders older than $KEEP_DAYS days..."
  find "$DEST" -mindepth 1 -maxdepth 1 -type d -mtime "+$KEEP_DAYS" -exec rm -rf {} +
fi

echo "Done. Local copies are in $DEST"
