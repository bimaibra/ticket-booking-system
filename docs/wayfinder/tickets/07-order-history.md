# Ticket: Implement Order History and Detail

**Type:** Task
**Status:** Done
**Label:** wayfinder:task

## Question

How do we build the order history list page and order detail page displaying all confirmed bookings with associated tickets, quantities, and totals?

## Context

Users need to view their own order history (PRD FR-1 Registered User capability). Orders are immutable SUCCESS entities per PRD D4 (no PENDING, no cancellation lifecycle).

## Acceptance Criteria

- `src/app/(authenticated)/orders/page.tsx` — order history list.
- `src/app/(authenticated)/orders/[id]/page.tsx` — order detail with order details (tickets, quantities, subtotals).
- `useOrders` and `useOrder` data hooks (TanStack Query).
- `staleTime: Infinity` for order data (immutable per PRD D4).
- Decimal values displayed as formatted strings (not raw decimals).
- UTC ISO-8601 timestamps formatted to user locale.
- Empty state copy when user has no orders.
- Error state for 403 (not authorized) and 404 (not found).

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen, 03-auth, 06-booking.

## Notes

- Orders are immutable; no edit/cancel UI needed.
- Refer to PRD FR-5.5 for response DTO format requirements.
