# Ticket: Implement Global Error Contract Mapping

**Type:** Task
**Status:** Done
**Label:** wayfinder:task

## Question

How do we create a centralized error mapping system that translates backend error codes (INSUFFICIENT_QUOTA, HOLD_EXPIRED, IDEMPOTENCY_IN_PROGRESS, etc.) into appropriate UI feedback (inline errors, toasts, redirects, silent retries)?

## Context

The backend returns structured errors with a `code` field. The frontend must map these codes to user-facing behavior consistently across all features. Refer to `docs/IMPLEMENTATION_PLAN.md` §11 for the full error contract.

## Acceptance Criteria

- `src/shared/errors/` with `errorCodes.ts` (enum/constants), `mapError.ts` (mapper), `ErrorBoundary.tsx`.
- Error mapper function: `(error: ApiError) → { type: 'inline' | 'toast' | 'redirect' | 'silent-retry', message, field? }`.
- Mapping table:
  - `INSUFFICIENT_QUOTA` → inline form error + show server's `available_quota`.
  - `HOLD_EXPIRED` → toast + clear booking intent, redirect to event.
  - `IDEMPOTENCY_IN_PROGRESS` → silent retry with backoff.
  - `IDEMPOTENCY_KEY_CONFLICT` → hard error, force fresh key.
  - `HISTORY_RETAINED` → admin: explain can't delete with history.
  - `DB_TRANSACTION_RETRY_EXHAUSTED` → exponential backoff retry, same key.
  - `RATE_LIMITED` → disable submit, show retry-after countdown.
  - 401 → silent refresh → retry once.
  - 403 → redirect to login or "not authorized" page.
  - 5xx → generic error, log to telemetry, offer "retry".
- Global `ErrorBoundary` in `src/app/error.tsx`.
- TanStack Query `onError` integration for automatic mapping.

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen.

## Notes

- Error codes are defined in backend OpenAPI schemas.
- This ticket is a prerequisite for proper error handling in all feature tickets.
