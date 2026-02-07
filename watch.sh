#!/usr/bin/env bash
set -euo pipefail

# Auto-deploy when files change (debounced).
# Requires: fswatch, lftp

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$ROOT_DIR/deploy-ftps.sh"

if ! command -v fswatch >/dev/null 2>&1; then
  echo "fswatch not found. Install with: brew install fswatch" >&2
  exit 1
fi

if [[ ! -x "$DEPLOY" ]]; then
  echo "deploy-ftps.sh not executable. Run: chmod +x deploy-ftps.sh" >&2
  exit 1
fi

TARGETS=(
  "$ROOT_DIR/board.json"
  "$ROOT_DIR/index.html"
  "$ROOT_DIR/styles.css"
  "$ROOT_DIR/app.js"
)

echo "[watch] watching:"; printf ' - %s\n' "${TARGETS[@]}"
echo "[watch] ctrl+c to stop"

DEBOUNCE_MS="${KANBAN_WATCH_DEBOUNCE_MS:-800}"

pending=0
last_ts=0

run_deploy() {
  echo "[watch] change detected -> deploying"
  "$DEPLOY" || echo "[watch] deploy failed (see output above)" >&2
}

fswatch -0 "${TARGETS[@]}" | while IFS= read -r -d '' _; do
  now=$(python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
)
  last_ts=$now

  if [[ $pending -eq 0 ]]; then
    pending=1
    (
      while true; do
        sleep 0.2
        check=$(python3 - <<'PY'
import time
print(int(time.time()*1000))
PY
)
        delta=$((check - last_ts))
        if [[ $delta -ge $DEBOUNCE_MS ]]; then
          break
        fi
      done
      pending=0
      run_deploy
    ) &
  fi
done
