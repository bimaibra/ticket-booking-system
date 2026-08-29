# Ticket: Bootstrap Project Foundation

**Type:** Task
**Status:** Open (Frontier)
**Label:** wayfinder:task

## Question

What are the initial project setup steps, dependencies, and configuration files required to create a Next.js 15 (App Router) application with TypeScript (strict), Tailwind CSS v4, shadcn/ui, and TanStack Query v5?

## Context

This is the foundational ticket for building the frontend. It establishes the core tooling and project structure required before any feature implementation can begin.

## Acceptance Criteria

- `package.json` with Next.js 15, React 19, TypeScript 5.x, Tailwind CSS v4, shadcn/ui, TanStack Query v5.
- `tsconfig.json` with strict mode enabled.
- `tailwind.config.ts` (or v4 CSS-first config) and `globals.css` with shadcn/ui theme variables.
- `next.config.mjs` configured for Docker standalone output.
- `Dockerfile` (multi-stage, non-root user) and `.dockerignore`.
- Base directory structure: `src/app/`, `src/modules/`, `src/shared/`.

## Dependencies

None (this is the entry point).

## Notes

- Use `output: "standalone"` in Next.js config for minimal Docker image.
- Refer to `docs/IMPLEMENTATION_PLAN.md` for backend integration context.
