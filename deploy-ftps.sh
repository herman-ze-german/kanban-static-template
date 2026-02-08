#!/usr/bin/env bash
set -euo pipefail

# Generic static Kanban deploy script (FTPS explicit TLS) using lftp.
# Uploads the static files to a remote directory.
#
# Required env vars:
#   KANBAN_FTPS_PASS
#   KANBAN_FTPS_HOST
#   KANBAN_FTPS_USER
#   KANBAN_FTPS_REMOTE_DIR   (e.g., /public_html/kanban or just kanban)
#
# Optional:
#   KANBAN_FTPS_PORT         (default: 21)
#   KANBAN_FTPS_PARALLEL     (default: 4)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${KANBAN_FTPS_HOST:?Missing KANBAN_FTPS_HOST}"
: "${KANBAN_FTPS_USER:?Missing KANBAN_FTPS_USER}"
: "${KANBAN_FTPS_PASS:?Missing KANBAN_FTPS_PASS}"
: "${KANBAN_FTPS_REMOTE_DIR:?Missing KANBAN_FTPS_REMOTE_DIR}"

PORT="${KANBAN_FTPS_PORT:-21}"
PARALLEL="${KANBAN_FTPS_PARALLEL:-4}"

FILES=(
  "index.html"
  "styles.css"
  "app.js"
  "board.json"
  "board.schema.json"
)

for f in "${FILES[@]}"; do
  [[ -f "$ROOT_DIR/$f" ]] || { echo "Missing file: $ROOT_DIR/$f" >&2; exit 1; }
done

# Build a tiny “dist” folder with fingerprinted asset filenames so mobile browsers
# don’t cling to cached app.js/styles.css forever.
DIST_DIR="$(mktemp -d)"
trap 'rm -rf "$DIST_DIR"' EXIT

JS_HASH="$(shasum -a 256 "$ROOT_DIR/app.js" | awk '{print substr($1,1,12)}')"
CSS_HASH="$(shasum -a 256 "$ROOT_DIR/styles.css" | awk '{print substr($1,1,12)}')"

JS_FILE="app.${JS_HASH}.js"
CSS_FILE="styles.${CSS_HASH}.css"

cp "$ROOT_DIR/app.js" "$DIST_DIR/$JS_FILE"
cp "$ROOT_DIR/styles.css" "$DIST_DIR/$CSS_FILE"
cp "$ROOT_DIR/board.json" "$DIST_DIR/board.json"
cp "$ROOT_DIR/board.schema.json" "$DIST_DIR/board.schema.json"

# Rewrite index.html to reference the fingerprinted assets.
sed \
  -e "s#href=\"styles\.css\"#href=\"${CSS_FILE}\"#" \
  -e "s#src=\"app\.js\"#src=\"${JS_FILE}\"#" \
  "$ROOT_DIR/index.html" > "$DIST_DIR/index.html"

STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[deploy] ${STAMP} -> ${KANBAN_FTPS_HOST}:${PORT} (remote dir: ${KANBAN_FTPS_REMOTE_DIR})"

lftp -u "${KANBAN_FTPS_USER}","${KANBAN_FTPS_PASS}" -p "${PORT}" "ftp://${KANBAN_FTPS_HOST}" <<LFTP
set ftp:ssl-force true
set ftp:ssl-auth TLS
set ftp:ssl-protect-data true
set ssl:verify-certificate no
set ftp:passive-mode true
set net:max-retries 2
set net:timeout 15
set net:reconnect-interval-base 2
set xfer:clobber on
set xfer:parallel ${PARALLEL}

# Some servers return 550 "File exists"; don't fail on mkdir.
set cmd:fail-exit no
mkdir -p "${KANBAN_FTPS_REMOTE_DIR}"
set cmd:fail-exit yes

cd "${KANBAN_FTPS_REMOTE_DIR}"

# Remove old fingerprinted assets to avoid clutter.
# Keep index.html + board.json; those are overwritten below.
set cmd:fail-exit no
rm -f app.*.js
rm -f styles.*.css
set cmd:fail-exit yes

mput "${DIST_DIR}/index.html" "${DIST_DIR}/${CSS_FILE}" "${DIST_DIR}/${JS_FILE}" "${DIST_DIR}/board.json" "${DIST_DIR}/board.schema.json"
bye
LFTP

echo "[deploy] done"
echo "[deploy] assets: ${CSS_FILE}, ${JS_FILE}"
