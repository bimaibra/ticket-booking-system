# Ticket: Implement Hold Creation and Cancellation

**Type:** Task
**Status:** Open (Frontier)
**Label:** wayfinder:task

## Question

How do we implement the hold creation form, active hold list page, and hold cancellation flow with countdown timers and quota feedback?

## Context

Authenticated users can create temporary holds (TTL default 10 minutes) on tickets. PRD FR-4.1 through FR-4.5 define the hold semantics including failure on insufficient quota.

## Acceptance Criteria

- `src/modules/holds/` with `components/`, `hooks/`, `pages/holds/`, `services/`.
- `src/app/(authenticated)/holds/page.tsx` — active holds list with countdown timers.
- Hold creation form on event detail page (quantity selector).
- `useCreateHold` mutation with optimistic quota reduction.
- `useCancelHold` mutation with optimistic removal.
- Countdown timer component (client-side) showing time until `expires_at`.
- Error mapping: `INSUFFICIENT_QUOTA` → inline form error showing server's `available_quota`.
- Auto-redirect to event page when hold expires.

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen, 03-auth.

## Notes

- Hold creation does NOT use idempotency keys (only `POST /orders` does).
- Multiple holds by same user on same ticket are allowed (PRD FR-4.5).
