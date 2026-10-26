#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${DATN_SERVER_DIR:-$project_dir}"
umask 077
mkdir -p backups
target="backups/climasense-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.server.yml exec -T postgres pg_dump -U climasense -d climasense -Fc > "$target.partial"
mv "$target.partial" "$target"
printf 'Backup saved: %s/%s\n' "$PWD" "$target"
