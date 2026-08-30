# Ticket: Multi-Hold Booking

**Type:** Task
**Status:** Pending
**Label:** wayfinder:task

## Question

Implement Phase 3: atomic multi-hold booking, OrderHold, expired hold handling, and rollback tests.

## Context

One order must consume one or more holds atomically.

## Acceptance Criteria

- Validate hold_ids array (1-100 unique)
- Lock ticket and hold rows, re-read, validate ownership/status/expiry
- Create order, details, OrderHold links, update holds to CONSUMED in one transaction
- Conditional update count equality check
- Remove /orders/{id}/confirm and Order.expired_at
- Rollback tests for partial failures

## Dependencies

- 14-inventory-safety

## Notes

Refer to IMPLEMENTATION_PLAN Phase 3.