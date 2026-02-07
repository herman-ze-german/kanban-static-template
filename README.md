# Static Kanban (file-driven) — OpenClaw-friendly Template

This is a tiny **static** Kanban board.

## Why this exists (the real use case)
This board is designed to pair nicely with an **OpenClaw** instance.

Idea: keep a human-readable, always-updated view of what your agent is working on (and what’s next), without needing a database or a heavy Kanban product.

Typical flow:
- You (or your OpenClaw agent) edits `board.json`.
- The board is deployed to static hosting.
- You share the URL with collaborators/friends ("here’s what the agent is doing right now").

- The **single source of truth** is `board.json`.
- The UI is plain HTML/CSS/JS (`index.html`, `styles.css`, `app.js`).
- It must be served from a **web server / static hosting** (because the UI uses `fetch('./board.json')`).

If you open `index.html` directly via `file://`, many browsers will block `fetch()` and you’ll see an error.

---

## What to edit

### `board.json`
- `meta.title` — board title
- `projects[]` — project lanes (name + color)
- `columns[]` — the columns (backlog/blocked/in progress/done)
- `cards[]` — your tasks

### Card fields (common)
- `id` (string)
- `title` (string)
- `description` (string)
- `projectId` (must match a `projects[].id`)
- `columnId` (must match a `columns[].id`)
- `priority` (P0/P1/P2/P3)
- `tags` (string[])
- `links` ({label,url}[])
- `owner` (string)
- `createdAt` / `updatedAt` (ISO timestamps)

Schema is in `board.schema.json`.

---

## Run locally (quick)

Pick one:

### Option A: Python web server
```bash
cd kanban-static-template
python3 -m http.server 8080
```
Open: http://localhost:8080/

### Option B: Node (if you prefer)
```bash
npx serve .
```

---

## Deploy (static hosting)

You can host this on any static host:
- GitHub Pages
- Netlify
- Cloudflare Pages
- S3/CloudFront
- Any shared webhosting where you can upload files

You need to upload at least:
- `index.html`
- `styles.css`
- `app.js`
- `board.json`

(Optional but nice): `board.schema.json`

### FTPS example deploy script
This template includes `deploy-ftps.sh` which uses `lftp`.

Install requirements (macOS):
```bash
brew install lftp
```

Set env vars:
```bash
export KANBAN_FTPS_HOST="your-ftps-host"
export KANBAN_FTPS_USER="your-username"
export KANBAN_FTPS_PASS="your-password"
export KANBAN_FTPS_REMOTE_DIR="/path/on/server/kanban"  # or just "kanban"
```

Deploy:
```bash
./deploy-ftps.sh
```

### Auto-deploy on change (optional)
Install:
```bash
brew install fswatch
```
Run:
```bash
./watch.sh
```

---

## Using this with OpenClaw

This repo/folder itself is **not** an OpenClaw skill.

But it’s intentionally structured so an OpenClaw agent can operate it safely and predictably:
- draft/edit `board.json` as the single source of truth
- move cards between columns (e.g. backlog → in_progress → done)
- validate the JSON against `board.schema.json`
- deploy the updated static files (and optionally auto-deploy on change)

If you want a one-command experience, package those steps as an OpenClaw **skill** (docs + safe helper commands).

---

## Credit (optional)

The UI includes a tiny “info” credit in the bottom-left.

- It’s there as a friendly nod ("with a little help from my friends").
- **You are explicitly allowed to remove it** if you don’t want it in your fork/company environment.

Search for `class="credit"` in `index.html`.
