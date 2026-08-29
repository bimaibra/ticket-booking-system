# Ticket: Set Up Testing Infrastructure

**Type:** Task
**Status:** Open (Frontier)
**Label:** wayfinder:task

## Question

How do we configure Vitest for unit/component tests, Playwright for E2E tests covering critical user paths (register → login → browse → hold → book → order history), and visual regression snapshots?

## Context

PRD §6 requires >80% code coverage. The frontend must have a solid testing foundation before feature implementation to ensure booking flow correctness, especially given idempotency complexity.

## Acceptance Criteria

- `vitest.config.ts` with React Testing Library, jsdom environment.
- `@testing-library/react`, `@testing-library/user-event`, `vitest` as dev dependencies.
- `playwright.config.ts` with Chromium project.
- `@playwright/test` as dev dependency.
- E2E test suites:
  - Register → login → logout flow.
  - Browse events → view availability.
  - Create hold → cancel hold.
  - Book hold → view order.
  - Idempotency replay (same key, same payload → same response).
  - Hold expiry handling.
- Visual regression: Playwright snapshots for event detail and checkout pages.
- a11y testing: `axe-core/playwright` integration.
- `package.json` scripts: `test`, `test:unit`, `test:e2e`, `test:visual`, `test:a11y`.
- Coverage threshold ≥80% (lines, statements, functions, branches).

## Dependencies

- **Blocked by:** 01-bootstrap.

## Notes

- Mock backend with MSW (Mock Service Worker) for unit tests.
- E2E tests can run against a local backend instance or Testcontainers.
