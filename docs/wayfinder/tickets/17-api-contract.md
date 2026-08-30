# Ticket: API Contract Alignment

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 5: fix ticket routes, add available_quota/last_updated, update OpenAPI schemas, generate types, contract tests.

## Context

Runtime routes and responses must match OpenAPI.

## Acceptance Criteria

- Mount ticketsRouter once (remove duplicate /events prefix)
- Return available_quota and last_updated in ticket listing
- Update order request/response schemas for hold_ids, UUID, multi-detail
- Add GoneError and 410 mapping
- Event deletion conflict behavior
- Generate API types from OpenAPI, fail on diff
- Contract tests for every path

## Dependencies

- 16-idempotency (preferred) but can start after 13

## Notes

Refer to IMPLEMENTATION_PLAN Phase 5.