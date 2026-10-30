# WebhookApp

Frontend take-home for a webhook catalog: sign in, browse webhooks with URL-driven search and pagination, and edit a webhook name or destination URL.

## Stack

- React 19 + TypeScript (strict)
- Vite
- React Router
- TanStack Query
- Chakra UI v3
- MSW for the mock API
- Vitest + Testing Library

## Requirements

Node.js `^22.12.0`, `^24`, or `>=26`.

## Setup

```bash
npm install
npm run dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (MSW starts before React mounts) |
| `npm test` | Vitest suite |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | oxlint |
| `npm run build` | Type-check and production build |

Focused unit tests protect HTTP and session invariants; integration tests cover user workflows.

## Demo credentials

- Email: `demo@example.com`
- Password: `WebhookApp-Demo-2026!`

## Authentication

1. Login posts email, password, fingerprint, and a development captcha header.
2. The returned `device_session_token` stays in memory only.
3. `/auth/token/issue` starts a mock session (HttpOnly-cookie analogue held by MSW).
4. Protected routes load `/v1/me` and the webhook list.
5. Logout revokes the token, clears the local session, and removes private query cache.

The device fingerprint is a 32-character hex value stored once in `localStorage`.

Mock sessions last 30 seconds. Concurrent HTTP 401 responses share a single `/auth/token/rotate`. A failed rotate or a second 401 ends the local session and returns to login.

Every request sends `X-Requested-With: XMLHttpRequest`. CSRF is loaded from `GET /csrf` and attached as `X-CSRF-TOKEN` on POST and PUT. HTTP 419 refreshes CSRF once and retries once.

## Webhooks

- Server-side search by name and pagination (`limit=10`).
- Page and search live in the URL.
- Edit opens a dialog for name and URL; field errors from HTTP 422 appear beside the inputs.

## After refresh

Authentication is not persisted. After F5 the user signs in again. If they refreshed a list URL such as `/?page=2&search=hook`, a successful login returns them to that same URL.

## Limitations

- Create, delete, and activate/deactivate are out of scope.
- The UI targets desktop widths.
- MSW is the only backend in this repository.
