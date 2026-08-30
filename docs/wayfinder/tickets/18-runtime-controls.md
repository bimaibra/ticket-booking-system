# Ticket: Security, Observability, and Runtime Controls

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 6: login limiter, Pino logging, metrics, /health /ready, advisory-lock scheduler, graceful shutdown, container.

## Context

Production readiness requires security and ops controls.

## Acceptance Criteria

- Login limiter (5/min per IP)
- Pino request logging with request ID
- Replace console with structured logs
- Counters/histograms for key outcomes
- /health and /ready endpoints
- Scheduler with pg_try_advisory_xact_lock, batch processing
- SIGTERM handling: stop traffic, drain, shutdown Prisma
- Multi-stage Dockerfile with non-root user, healthcheck

## Dependencies

- 17-api-contract (or earlier)

## Notes

Refer to IMPLEMENTATION_PLAN Phase 6.