#!/bin/bash
# ขั้น 5 · รันชุด Playwright เต็มกับ BUG_MODE ทีละค่า → bug-hunt/<mode>.json + .log
cd "$(dirname "$0")/.."
MODES=${MODES:-"B01 B02 B03 B04 B05 B06 B07 B08 B09 B10 B11 B12 B03,B07 B01,B05,B09 none"}
for m in $MODES; do
  bm=$m; [ "$m" = none ] && bm=""
  echo "=== $m $(date +%H:%M:%S)"
  TEST_MODE=1 BUG_MODE="$bm" docker compose up -d >/dev/null 2>&1
  for i in $(seq 1 60); do curl -sf localhost:3000/api/health >/dev/null && break; sleep 2; done
  docker compose logs web 2>/dev/null | grep "BUG_MODE active" | tail -1
  PLAYWRIGHT_JSON_OUTPUT_NAME="bug-hunt/${m//,/_}.json" npx playwright test --trace off --reporter=list,json > "bug-hunt/${m//,/_}.log" 2>&1
  tail -3 "bug-hunt/${m//,/_}.log" | grep -E "passed|failed"
  grep -E "^\s+[0-9]+\) " "bug-hunt/${m//,/_}.log" | sed 's/ › /|/g' | awk -F'|' '{print "  FAIL:",$3}' | sort -u
done
echo "=== DONE $(date +%H:%M:%S)"
