# Ticket: Implement Admin Management UI

**Type:** Task
**Status:** Done
**Label:** wayfinder:task

## Question

How do we build the admin dashboard with CRUD interfaces for events, tickets, users, and order oversight, with role-gated route protection?

## Context

PRD FR-1 (Admin) requires CRUD capabilities for events, tickets, users, and order visibility. Admin routes must be protected by role check (USER vs ADMIN).

## Acceptance Criteria

- `src/app/admin/` route group with `(admin)` layout enforcing ADMIN role.
- `src/app/admin/events/` — event list, create, edit, delete.
- `src/app/admin/events/[id]/tickets/` — ticket CRUD for event.
- `src/app/admin/orders/` — all orders list with filtering.
- `src/app/admin/users/` — user list with role management.
- `src/modules/admin/` feature module with sub-modules for each resource.
- Server-side data fetching (RSC) for admin lists where possible.
- Event deletion handles `409 HISTORY_RETAINED` with explanatory error.
- Role check in `middleware.ts` for `/admin/*` routes.

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen, 03-auth.

## Notes

- Image upload for events is in the fog (see map Not yet specified).
- Refer to PRD FR-1.1 through FR-1.6 and D6 for event deletion semantics.
