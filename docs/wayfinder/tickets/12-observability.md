# Ticket: Implement Client-Side Observability

**Type:** Task
**Status:** Done
**Label:** wayfinder:task

## Question

How do we implement minimal client-side observability including error reporting, Core Web Vitals tracking, and custom event logging for critical user actions (hold_created, order_succeeded, auth_refresh_failed)?

## Context

Decision D-04 rules out external analytics providers, but basic error reporting and performance monitoring are still needed for production readiness. The frontend should log errors and track critical user actions for debugging.

## Acceptance Criteria

- `src/shared/observability/` with `logger.ts`, `events.ts`, `web-vitals.ts`.
- Structured error logger that captures:
  - Error message, stack trace, component stack.
  - Request ID from backend `X-Request-Id` header (if present).
  - User ID (if authenticated).
  - URL, user agent, timestamp.
- Custom event schema with canonical event names:
  - `hold_created`, `hold_cancelled`, `hold_expired`.
  - `order_succeeded`, `order_failed`, `order_hold_expired`.
  - `auth_login`, `auth_logout`, `auth_refresh_failed`.
- Web Vitals tracking (LCP, INP, CLS) via `web-vitals` library.
- Error logs output to server endpoint (Next.js API route) or console in development.
- Request ID propagation: forward backend `X-Request-Id` in error reports.

## Dependencies

- **Blocked by:** 01-bootstrap.

## Notes

- No third-party analytics (per D-04).
- Consider adding a simple `/api/log` Next.js route to forward logs to a file or external sink later.
- Refer to PRD §6 Observability NFR.
