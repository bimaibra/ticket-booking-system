# Ticket: Inventory Safety (Availability, Holds, Cancellation, Quota)

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 2: aggregated availability, SELECT FOR UPDATE locking, hold/cancel/quota safety, and contention tests.

## Context

Inventory must be concurrency-safe.

## Acceptance Criteria

- Availability service with PostgreSQL aggregation
- Hold creation with ticket row lock
- Hold cancellation with lock and conditional update
- Quota reduction with lock and allocation check
- Repeated contention tests preserving capacity

## Dependencies

- 13-backend-migration

## Notes

Refer to IMPLEMENTATION_PLAN Phase 2.