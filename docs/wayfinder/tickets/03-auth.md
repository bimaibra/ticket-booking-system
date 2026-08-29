# Ticket: Implement Authentication Flow

**Type:** Task
**Status:** Open (Frontier)
**Label:** wayfinder:task

## Question

How do we implement login, register, refresh, and logout flows with access token in memory and refresh token in httpOnly cookie, including silent refresh on 401?

## Context

The backend issues short-lived access tokens (15min) and long-lived refresh tokens (7d) via JWT. Security best practice requires keeping access tokens out of localStorage to prevent XSS-based token theft.

## Acceptance Criteria

- `src/modules/auth/` with `components/`, `hooks/`, `pages/login/`, `pages/register/`, `services/`.
- Login/register forms using `react-hook-form` + `zod` with Zod schemas.
- Access token stored in React Context or Zustand (in-memory only).
- Refresh token handled by backend via httpOnly `Secure` `SameSite=Strict` cookie.
- `useAuth` hook exposing `user`, `isAuthenticated`, `login()`, `register()`, `logout()`.
- Single-flight refresh logic in API client (parallel 401s share one refresh promise).
- `middleware.ts` for edge-level route protection on `(authenticated)` and `admin` groups.
- Edge-compatible JWT verification using `jose` library.

## Dependencies

- **Blocked by:** 01-bootstrap, 02-codegen.

## Notes

- Never store access token in localStorage or sessionStorage.
- Refer to PRD FR-2.1 through FR-2.5 for backend auth contract.
