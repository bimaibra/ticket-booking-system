# Wayfinder Map: Ticket Booking System Frontend

## Destination

A production-ready Next.js 15 frontend for the ticket booking system deployed on VPS via Docker, supporting guest browsing, user holds/orders with strict idempotency handling, and admin management matching PRD specifications.

## Notes

- **Tech Stack:** Next.js 15 (App Router), TypeScript (strict), TanStack Query v5, Tailwind CSS v4, shadcn/ui.
- **Backend Contract:** OpenAPI 3.1 (`openapi.yaml`).
- **Architecture:** Feature-modular (`src/modules/{feature}`).
- **Auth Strategy:** Access token in memory, Refresh token in httpOnly cookie.
- **Language:** English.
- **Target Platform:** Self-hosted VPS via Docker container.

## Decisions so far

- **D-01 (Tech Stack):** Next.js 15 App Router chosen over Vite/Remix due to SSR for event pages and OpenAPI alignment.
- **D-02 (Real-time Availability):** Polling (15s interval) chosen over SSE/WebSocket.
- **D-03 (Deployment):** Docker container on self-hosted VPS.
- **D-04 (Scope):** English language only; no external analytics integration.

## Not yet specified

- Admin dashboard image upload and asset CDN configuration.
- Detailed visual design system extensions beyond shadcn/ui primitives.
- Performance budget thresholds (Core Web Vitals limits for CI gating).

## Out of scope

- Payment processing / payment gateway integration (PRD FR-5.6).
- Real-time WebSockets / Server-Sent Events (PRD §3.1 optional).
- Native mobile apps / PWA installation manifests.
- Multi-language i18n support.
- User-facing order cancellation / refund workflow (PRD FR-5.6).
