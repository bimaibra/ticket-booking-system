# Ticket: Implement Public Event Browsing

**Type:** Task
**Status:** Open (Frontier)
**Label:** wayfinder:task

## Question

How do we build the public-facing event listing and event detail pages with SSR for SEO, real-time availability polling, and ticket selection?

## Context

Guest users must be able to browse events and view ticket availability. PRD FR-3.1 and FR-3.2 require that `GET /events/{id}/tickets` returns current `available_quota` reflecting active holds and confirmed bookings.

## Acceptance Criteria

- `src/modules/events/` and `src/modules/tickets/` feature modules.
- `src/app/(public)/events/page.tsx` — event listing with SSR/ISR.
- `src/app/(public)/events/[id]/page.tsx` — event detail with available tickets.
- `useEvents` and `useEventTickets` data hooks (TanStack Query).
- Polling: `refetchInterval: 15000` on event detail ticket query.
- Open Graph tags per event (name, date, image).
- `generateStaticParams` for top events, ISR for the rest.
- Skeleton loading states for event cards and ticket lists.

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen.

## Notes

- Backend `last_updated` timestamp should be displayed on the UI to indicate data freshness.
- 15s polling matches backend scheduler cadence (PRD FR-7.1).
