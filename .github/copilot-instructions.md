<!-- Copilot instructions for repository-specific AI assistance -->
# DockerManager — Copilot Instructions

Brief actionable notes to help AI code agents be productive in this repo.

## Big picture
- This is a local CaaS/PaaS composed of a **DMZ (frontend/backend/mongo)**, **edge/traefik proxies**, and **isolated per-user VPCs** for tenant containers. See `docker-compose.yml` and the README for the architecture diagram and network names.
- The Backend (Node.js) is the control plane: it talks to Docker through the socket proxy (`docker-socket-proxy`) and to storage via `storage-fw` → MinIO. Key backend files: `backend/server.js`, `backend/proxyService.js`, `backend/services/*`.

## Developer workflows (how to run & debug)
- Whole-stack dev: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`. Production VPS: `docker compose up -d --build` (only `docker-compose.yml`).
- Backend locally (without Docker): `cd backend && npm install && npm run dev` (uses `node --watch server.js`). Ensure `MONGO_URI` and `DOCKER_HOST` point to reachable services or run with docker compose.
- Frontend locally: `cd frontend && npm install && npm run dev` (Vite). CORS in `backend/server.js` already allows `http://localhost:5173` and `http://localhost`.
- Inspect final merged compose file: `docker compose config`.

## Project-specific conventions & patterns
- Docker socket access: Backend never talks to host socket directly. Use the `socket-proxy` container; backend uses `DOCKER_HOST=tcp://socket-proxy:2375` (set in `docker-compose.yml`). See `socket-proxy` env flags in `docker-compose.yml`.
- Traefik routing: Services opt into Traefik using labels like `traefik.constraint-label=dmz-proxy` or `lan-proxy`. When adding new services that should be proxied, add the proper label and `traefik.http.routers.*` rules in `docker-compose.yml`.
- Storage path: Backend talks to MinIO via `storage-fw` proxy. Do not call MinIO directly from the DMZ — use `storage-fw` for network isolation.
- Secrets: backend uses a secret syntax injected at startup: `APP_KEY={{SECRET:NameDelSecreto}}` (see README). Sensitive values are encrypted in DB.

## Important files to check for changes
- `docker-compose.yml` + `docker-compose.override.yml` — service/network definitions and dev overrides
- `backend/server.js` — express boot, CORS, security middlewares, service initialization (reaper, backup, ollama, minio)
- `backend/services/*.js` — background services (reaperService, backupService, minioService, ollamaService)
- `backend/proxyService.js` — code that manages Traefik / proxy attachments
- `frontend/` — Vite + React app; `frontend/src` contains components and pages

## Integration points & external dependencies
- Docker Engine: controlled via `socket-proxy` (`tecnativa/docker-socket-proxy`). The backend relies on `dockerode` and expects `DOCKER_HOST` to be `tcp://socket-proxy:2375` inside compose.
- Traefik: two instances — `proxy-inverso` (admin/dmz) and `lan-proxy` (user containers). Routing is controlled by Docker labels.
- MinIO: internal S3-compatible storage; access from backend must go through `storage-fw` (HAProxy). `docker-compose.dev.yml` exposes MinIO on host ports `9000/9001`.
- Ollama: on-prem local AI service initialized by `backend/services/ollamaService.js` and used via `/api/ai`.

## Code patterns and examples
- API routes: grouped under `backend/routes/*.js`. Example: `POST /api/containers` (deploy flow) is implemented in `backend/routes/containerRoutes.js`.
- Blue/Green deploys: backend performs healthchecks and updates Traefik attachment; see `container` model and Reaper behavior in `backend/services/reaperService.js`.
- Network labeling: user VPCs are created with label `dockermanager.vpc=true` and are garbage-collected by the Reaper.

## Quick troubleshooting tips
- If HTTPS fails locally, backend falls back to HTTP (see the `try/catch` in `backend/server.js`). For dev, `docker-compose.dev.yml` forces dev modes and port mappings.
- Common dev start: `docker compose up -d --build && docker compose logs -f backend` to watch backend boot messages.
- To quickly seed an admin user, check `backend/server.js` (it creates a `test` admin user on first boot).

## When you modify things
- If you add new backend services that call Docker API, register required socket permissions in `socket-proxy` env list and update docs.
- If you change routing labels, update `docker-compose.yml` labels and verify `traefik.constraint-label` usage.

---
If any part of the architecture is unclear, tell me which area to expand (networks, Reaper, socket-proxy rules, Traefik labels, or local dev debugging) and I'll iterate.
