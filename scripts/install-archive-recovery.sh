#!/usr/bin/env bash
set -euo pipefail
cd /home/huy1111/apps/datn-monitor
test -s archive.service.ts.pending
test -f backend/src/readings/archive.service.ts
test -f docker-compose.server.yml
backup="backups/archive-recovery-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup"
cp backend/src/readings/archive.service.ts "$backup/archive.service.ts"
cp archive.service.ts.pending backend/src/readings/archive.service.ts
printf 'Original source saved at %s/archive.service.ts\n' "$backup"
# Build first. A build failure leaves the currently running container in place.
sudo docker compose -f docker-compose.server.yml build backend
sudo docker compose -f docker-compose.server.yml up -d --no-deps backend
for attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:3000/api/readings/archive/status > "$backup/status.json"; then
    if python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d.get("lastVerifiedAt") and d.get("lastSavedAt") and not d.get("error") else 1)' "$backup/status.json"; then
      cat "$backup/status.json"
      printf '\nCollector has verified Firebase and saved data.\n'
      exit 0
    fi
  fi
  sleep 2
done
printf 'Collector verification has not passed yet. Inspect logs; original source is in %s.\n' "$backup" >&2
sudo docker compose -f docker-compose.server.yml logs --tail 50 backend
exit 1
