# Threat Model

## Project Overview

This repository contains two production-relevant deployable artifacts: a small Express 5 API server and an Expo-based mobile app called Clean Contacts. The API currently exposes only a health endpoint, while the mobile app requests access to device contacts so users can review and delete stale contacts locally on their phone. Shared packages provide the PostgreSQL/Drizzle database layer and generated API contracts. The mockup sandbox is a development-only environment and is not deployed to production.

Production-scope assumptions for future scans:
- `NODE_ENV` is `production` in deployed environments.
- Replit terminates TLS for deployed applications.
- `artifacts/mockup-sandbox/` is dev-only and should be ignored unless separate production reachability is demonstrated.

## Assets

- **Device contact data** — names, phone numbers, email addresses, contact images, and contact metadata exposed through `expo-contacts`. This is the most sensitive user data in the repository.
- **Application and infrastructure secrets** — `DATABASE_URL`, any future API tokens, and deployment-specific environment variables.
- **Backend availability and integrity** — the API and mobile static serving paths must not be made unavailable or modified by untrusted input.
- **Future database contents** — the DB package is present even though no production tables are defined yet; once used, it will become a primary confidentiality and integrity target.

## Trust Boundaries

- **Browser/mobile client to server** — all requests into `artifacts/api-server/src/app.ts` and `artifacts/mobile/server/serve.js` originate from untrusted clients and must be validated server-side.
- **App to device OS boundary** — the mobile app crosses into privileged device APIs when requesting contact permissions and reading/deleting contacts.
- **Server to database** — `lib/db/src/index.ts` uses `DATABASE_URL` to create a PostgreSQL connection pool; any future query path here is security-sensitive.
- **Server to third-party/static resources** — the mobile landing page currently depends on an external browser-loaded QR code library from a CDN, which is a supply-chain trust boundary even though it is not currently sufficient for a reportable finding.
- **Public vs authenticated boundary** — there is currently no authenticated production surface. Any future protected route must enforce auth server-side rather than relying on generated clients or mobile UI state.
- **Production vs dev-only boundary** — `artifacts/mockup-sandbox/`, most build/codegen scripts, and local tooling under `scripts/` are not production runtime code by default.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/mobile/server/serve.js`, `artifacts/mobile/app/_layout.tsx`, `artifacts/mobile/app/index.tsx`
- **Highest-risk areas:** future API routes under `artifacts/api-server/src/routes/`, contact access and deletion logic in `artifacts/mobile/context/ContactsContext.tsx`, database access in `lib/db/src/index.ts`
- **Public surfaces:** `GET /api/healthz`, mobile landing page `/`, static asset serving in `artifacts/mobile/server/serve.js`
- **Dev-only areas:** `artifacts/mockup-sandbox/`, `scripts/`, codegen inputs under `lib/api-spec/`, build helpers like `artifacts/mobile/scripts/build.js`

## Threat Categories

### Spoofing

The current production API does not implement authentication, so future protected endpoints will need explicit server-side identity checks before accessing user-specific or administrative data. Generated API clients and bearer-token helper code in `lib/api-client-react/src/custom-fetch.ts` should be treated as transport helpers, not as security enforcement.

Required guarantees:
- Any future non-public API route MUST require server-side authentication.
- Any future bearer tokens, cookies, or session identifiers MUST be validated on the server for every protected request.

### Tampering

The main tampering risks are future API mutation endpoints, mobile contact deletion actions, and static file serving logic. The current mobile server normalizes file paths before reading from disk, so future changes to path handling should preserve root confinement.

Required guarantees:
- All future request bodies, query parameters, and path parameters MUST be validated before use.
- Static file and manifest serving code MUST keep requests confined to the intended build directory.
- Sensitive device actions such as contact deletion MUST remain gated by explicit user action and OS permission checks.

### Information Disclosure

The mobile app handles sensitive contact data locally, and the backend logger already redacts `Authorization`, `Cookie`, and `Set-Cookie` fields. Future routes and logs must avoid exposing PII, secrets, stack traces, or database internals.

Required guarantees:
- Contact data and future backend user data MUST NOT be logged or returned beyond the minimum needed response fields.
- Error responses in production MUST avoid leaking internal stack traces, filesystem paths, or raw database errors.
- Secrets from environment variables MUST remain server-only and MUST NOT be embedded into client bundles.

### Denial of Service

The public API and mobile static server are internet-facing. The current codebase has no expensive authenticated operations, but future endpoints could create easy denial-of-service conditions if they perform unbounded queries, large uploads, or long external calls.

Required guarantees:
- Future public endpoints MUST apply reasonable limits to request size and work performed per request.
- External calls and any future database-intensive paths MUST use timeouts or bounded execution.
- Static serving and manifest responses MUST remain limited to expected files and payload sizes.

### Elevation of Privilege

The current codebase has no role system and no privileged backend actions, but future routes that expose contacts-derived data, database records, or administrative functionality will need strict server-side authorization. Injection risk will center on any future SQL, shell, filesystem, or URL-fetching code added around the existing DB and server packages.

Required guarantees:
- Authorization for any future privileged route MUST be enforced on the server, not in mobile or web UI code.
- All future database access MUST use safe Drizzle or parameterized query patterns.
- Future filesystem or external-fetch features MUST not consume attacker-controlled paths or URLs without strict validation.
