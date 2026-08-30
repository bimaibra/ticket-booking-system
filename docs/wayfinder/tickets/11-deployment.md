# Ticket: Configure Docker Deployment for VPS

**Type:** Task
**Status:** Done
**Label:** wayfinder:task

## Question

How do we create a production-ready multi-stage Dockerfile, docker-compose configuration for self-hosted VPS deployment, and environment variable management for the Next.js frontend?

## Context

Decision D-03 specifies self-hosted VPS via Docker. The deployment must include health checks, graceful shutdown, and reverse proxy configuration (nginx or Caddy).

## Acceptance Criteria

- `Dockerfile` (multi-stage): deps → builder → runner.
- Non-root runtime user in final stage.
- `next.config.mjs` with `output: "standalone"`.
- `HEALTHCHECK` using `/api/health` endpoint.
- `.dockerignore` excluding `node_modules`, `.next`, `.git`, tests.
- `docker-compose.yml` with frontend service, optional reverse proxy (Caddy).
- Environment variables documented in `.env.example`:
  - `NEXT_PUBLIC_API_URL`
  - `NODE_ENV=production`
- Graceful shutdown handling for SIGTERM.
- Caddy/nginx config with HTTPS, gzip, security headers.

## Dependencies

- **Blocked by:** 01-bootstrap.

## Notes

- Refer to `docs/DEPLOYMENT.md` for backend deployment context.
- VPS must have Docker and Docker Compose installed.
