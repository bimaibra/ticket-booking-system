# Ticket: Generate TypeScript Client from OpenAPI

**Type:** Task
**Status:** Open (Frontier)
**Label:** wayfinder:task

## Question

How do we generate a type-safe TypeScript client from the backend's `openapi.yaml` and configure it as the single point of network access in `src/shared/api-client/`?

## Context

The backend exposes a REST API documented via OpenAPI 3.1. The frontend must consume this contract with type safety, avoiding manual interface duplication and runtime validation gaps.

## Acceptance Criteria

- `openapi-typescript` or `openapi-fetch` integrated as a dev dependency.
- Script in `package.json` (e.g., `codegen`) to generate types from `openapi.yaml`.
- Generated types committed or generated at build time.
- `src/shared/api-client/` exports a configured fetch client with typed methods.
- `src/shared/api-client/endpoints/` exports per-resource functions (e.g., `getEvents`, `createHold`).

## Dependencies

- **Blocked by:** 01-bootstrap (needs Next.js project structure).

## Notes

- Use `openapi-fetch` for minimal runtime overhead.
- Configure base URL via environment variable (`NEXT_PUBLIC_API_URL`).
