# Ticket: CI, Staging, and Release Gate

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 8: CI workflow with migrations, tests, build, container scan, staging deploy, k6, re-audit.

## Context

Continuous enforcement of compliance.

## Acceptance Criteria

- CI runs prisma migrate deploy, lint, build, unit/integration/concurrency tests, coverage, OpenAPI lint, contract check
- Start server, run liveness/readiness smoke
- Build and scan container
- Deploy to staging, run smoke/concurrency
- k6 on schedule
- Upload artifacts
- Create re-audit document

## Dependencies

- 19-load-testing

## Notes

Refer to IMPLEMENTATION_PLAN Phase 8.