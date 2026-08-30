# Ticket: Backend Migration and Test Harness

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 1 of IMPLEMENTATION_PLAN: real migration, OrderHold join, constraints, Testcontainers harness, and dependency-injected app factory.

## Context

Backend remediation requires PostgreSQL schema changes and integration test harness.

## Acceptance Criteria

- Prisma migration with OrderHold, CHECK constraints, remove Order.idempotency_key
- Dependency-injected createApp for tests
- Testcontainers setup with prisma migrate deploy
- Migration smoke test

## Dependencies

- None

## Notes

Refer to IMPLEMENTATION_PLAN Phase 1.