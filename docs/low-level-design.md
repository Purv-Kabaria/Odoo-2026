# Low-Level Design

This document records the template's production mechanics: data model choices, API contracts, RBAC, session handling, caching, search, object storage, LLM calls, logging, and extension rules. Keep it updated when changing schema, handlers, or infrastructure.

## Architectural Shape

- Modular monolith on Next.js App Router.
- Server Components by default; client components only for interactive UI.
- Route handlers own API boundaries; components never contain backend logic.
- `lib/entities/*` is the generic CRUD engine. Entity configs define columns, Zod schema, permissions, default sort, search index, and restricted fields.
- PostgreSQL is authoritative for metadata and durable app state. Redis, Meilisearch, S3-compatible storage, LLM providers, and Loki are accelerators/integrations. Optional accelerators fail soft; required feature dependencies return explicit user-safe errors instead of silent failure.

## Durable Data Model

Primary keys use `cuid()` for URL-safe, non-sequential identifiers without a separate ID translation layer.

Mutable models include:

- `createdAt @default(now())`
- `updatedAt @updatedAt`

Current core models:

- `User`: auth identity and editable profile fields.
- `PasswordCredential`: one-to-one credential row, cascades with user.
- `AuthSession`: hashed opaque session token, expiration, user FK.
- `PasswordResetToken`: hashed, single-use reset token.
- `Product`: catalog-style demo entity.
- `Organization`: account/customer-style demo entity.
- `ObjectAsset`: object metadata and ownership; bytes live in S3-compatible storage.
- `ActivityEvent`: append-only event stream for debugging, auditability, and realtime-ready polling.

## Indexing Strategy

General rules:

- Every FK is indexed.
- Unique constraints double as indexes; do not duplicate them.
- Equality filter columns that pair with default `createdAt` ordering get composite indexes.
- Text fallback search uses `pg_trgm` GIN indexes because `contains`/`ILIKE '%x%'` cannot use a normal B-tree index.
- Meilisearch remains primary for table search; trigram indexes protect degraded mode.

Hot-path composites:

- `User(role, createdAt)`
- `User(gender, createdAt)`
- `Product(status, createdAt)`
- `Product(category, createdAt)`
- `Organization(plan, createdAt)`
- `Organization(industry, createdAt)`
- `Organization(region, createdAt)`

Search fallback GIN indexes:

- `User`: `name`, `email`, `location`
- `Product`: `name`, `sku`, `category`
- `Organization`: `name`, `slug`, `industry`, `region`

Session indexes:

- `AuthSession.tokenHash` unique: primary lookup for session verification.
- `AuthSession.userId`: bulk invalidation by user.
- `AuthSession.expiresAt`: cleanup/expiry queries.
- `ObjectAsset.key` unique: storage object lookup/deletion.
- `ObjectAsset(uploadedById, createdAt)`: user-scoped object lists.
- `ActivityEvent(createdAt, id)`: recent-feed reads.
- `ActivityEvent(actorId, createdAt)`: user-scoped history.
- `ActivityEvent(entityType, entityId, createdAt)`: per-record debugging.
- `ActivityEvent(action, createdAt)`: operational filtering and dashboards.

Raw SQL check constraints protect domain invariants that Prisma cannot express:

- non-negative product price and stock
- positive organization seats
- positive object byte size
- minimum password-hash iteration count
- session/reset expiry after creation

## Auth And Session Management

- Sessions are opaque 32-byte random tokens.
- Only `sha256(token)` is stored in `AuthSession.tokenHash`.
- Cookie flags: `httpOnly`, `sameSite=lax`, `secure` in production, path `/`.
- `proxy.ts` is only a fast UX redirect based on cookie presence.
- `app/(protected)/layout.tsx` and protected APIs always call `getCurrentUser()`, which verifies the DB session.
- Expired sessions are treated as unauthenticated and are deleted opportunistically on lookup.
- Password reset invalidates sessions on successful reset.
- Password change keeps the current session and invalidates other sessions.
- Password reset token consumption is concurrency-safe: the transaction marks the token used with `usedAt: null` and `expiresAt > now()` guards before updating credentials and invalidating sessions. Concurrent retries after the first success get the same invalid/expired message.

## RBAC

Entity permissions live in each `EntityConfig`:

```ts
permissions: {
  read: ["ADMIN", "MODERATOR"],
  create: ["ADMIN", "MODERATOR"],
  update: ["ADMIN", "MODERATOR"],
  delete: ["ADMIN"],
}
```

Restricted fields provide field-level control. Example: moderators can update user profile fields, but only admins can change `role`.

Role defaults:

- `ADMIN`: full user/product/organization management.
- `MODERATOR`: operational management where allowed, no role changes.
- `USER`: account/profile panel only.

## API Contract

All API responses use `Api`:

```ts
{ data: T, meta?: Record<string, string | number | boolean | null> }
{ error: { message: string, code: string, details?: unknown } }
```

Client code reads this envelope through `lib/api-client.ts` so every form/table/storage action shows the server's user-facing message when one exists and falls back by HTTP status when the body is missing or malformed.

Handler order:

1. Generate `requestId`.
2. Authenticate.
3. Authorize.
4. Parse JSON safely.
5. Validate with Zod.
6. Execute Prisma write/read.
7. Sync Meilisearch and invalidate Redis after writes.
8. Log structured event.
9. Return envelope.

Bulk deletes are idempotent. Single-resource delete returns `204` if already gone.

Status rules:

- `400`: invalid body, query, route param, or invalid `Idempotency-Key`.
- `401`: no valid session.
- `403`: session exists but role/ownership is insufficient.
- `404`: resource metadata is missing.
- `409`: unique constraint or state conflict.
- `429`: rate limit, always with `Retry-After`.
- `503`: required dependency is not configured or temporarily unavailable.
- `500`: unexpected failure after logging; never includes stack traces or raw provider errors.

## Generic CRUD Flow

Collection handlers:

- `GET`: list with pagination, search, filters, sorts.
- `POST`: create.
- `PATCH`: bulk update selected rows.
- `DELETE`: delete selected rows or all rows.

Item handlers:

- `PUT`: full update by id.
- `DELETE`: idempotent delete by id.

The table sends only whitelisted filters/sorts from configured columns. The backend re-validates them before building Prisma clauses.

Offset pagination is capped at a bounded depth. Deep page-number scans should be replaced by cursor pagination for feed-style surfaces once production data reaches six figures.

## Dynamic Data And Activity Stream

The template uses local durable primitives before third-party realtime APIs.

`ActivityEvent` records compact events after authoritative writes complete:

- generic entity create/update/delete/bulk operations
- account profile edits
- storage upload/delete
- LLM chat requests

`GET /api/activity` supports:

- authenticated access only
- admins/moderators reading all events
- users reading only their own actor-scoped events
- bounded `limit`
- optional `since` timestamp for polling refresh

The `/activity` page polls every 15 seconds and can be manually refreshed. This gives a clean dynamic-data path that works on any deployment target. If a future product needs push-based realtime, this table becomes the source for Server-Sent Events, WebSockets, or LISTEN/NOTIFY fan-out without changing write paths.

## Redis Cache

Redis is optional shared infrastructure for cache-aside, distributed rate limiting, and idempotency.

Cache key varies by:

- entity key
- role
- page
- limit
- search query
- filters
- sorts

Default TTL: `CACHE_TTL_SECONDS=20`.

Mutation invalidation:

- create
- update
- bulk update
- delete selected
- delete all
- account profile update

Redis errors log `warn` and return a cache miss. Redis must never block CRUD.

## Rate Limiting

`checkRateLimit` is Redis-first and falls back to bounded in-memory fixed windows if Redis is unavailable.

Current protected limits:

- auth endpoints: per IP and route
- account password change: per IP and route
- storage upload: per IP and user
- LLM chat: per IP and user

Every rate-limit response includes `Retry-After`.

## Idempotency

Mutating routes that are likely to be retried can accept `Idempotency-Key`.

Current scopes:

- `storage-upload`
- `llm-chat`

Successful responses are cached briefly in Redis. If Redis is unavailable, idempotency degrades and the request still executes normally.

An absent `Idempotency-Key` is valid. A present key must be 8-120 characters; invalid keys return `400` rather than being silently ignored.

## Object Storage

Object bytes are stored through S3-compatible APIs. Local development uses MinIO; production can use AWS S3, Cloudflare R2, MinIO, or another compatible provider by changing env vars.

Postgres stores:

- storage key
- original filename
- content type
- byte size
- uploader id
- creation timestamp

Access rules:

- `USER`: own objects only.
- `MODERATOR`/`ADMIN`: all objects.

Deletes remove Postgres metadata synchronously and object bytes asynchronously/idempotently. A missing or unavailable object byte stream returns a user-safe `503` for download while metadata remains protected by RBAC.

Upload consistency:

- The API validates auth, storage configuration, idempotency, rate limits, multipart shape, size, and content type before writing bytes.
- If S3/MinIO write fails, the request returns `503`.
- If bytes are written but metadata creation fails, the catch path asynchronously deletes the uploaded key to prevent orphaned objects.

## Resilience Primitives

External HTTP calls use `resilientFetch` where appropriate:

- timeout
- bounded retry count
- exponential backoff with small jitter
- per-dependency circuit breaker
- structured warning logs

Current users:

- Meilisearch
- Loki
- LLM provider

Circuit breakers are in-process today. If the app is horizontally scaled and a dependency becomes noisy, move circuit state to Redis using the same helper shape.

## LLM Calls

`POST /api/llm/chat` is an OpenAI-compatible proxy.

Design constraints:

- protected route
- per-user/IP rate limit
- bounded message count and message length
- bounded `maxTokens`
- low default temperature
- no shared HTTP cache
- timeout and retry through `resilientFetch`
- circuit breaker after repeated failures
- `Idempotency-Key` support for client retries
- structured token/duration logging

LLM providers are optional. If env vars are missing, the route returns a clear configuration error rather than making a network call.

Provider failure mapping:

- missing env: `503` configuration message
- network timeout/open circuit: user-safe temporary-unavailable message
- provider auth rejection: user-safe credential message
- malformed/empty provider response: user-safe empty-response message

Raw provider bodies are never returned to the client.

## Search

Meilisearch is the primary provider for user-facing table search.

Write paths call `upsertInSearch` or `deleteFromSearch` after DB mutation. Direct seed/import scripts must run:

```bash
pnpm search:index
```

Fallback behavior:

- If Meilisearch returns IDs, Prisma filters by those IDs.
- If Meilisearch is unavailable, Prisma builds `contains` filters over searchable fields.
- Trigram indexes make fallback tolerable for larger local/admin datasets.

Search indexing failures are logged at `warn` with entity/count context and do not roll back committed database writes. This preserves CRUD availability while making degraded search observable.

## Account Profile Editing

Users can edit their own:

- `name`
- `location`
- `gender`

They cannot edit:

- `email`
- `role`
- session/security internals

Profile edits:

- validate through `AccountProfileSchema`
- update only the current user row
- return a minimal client-safe user DTO
- update Meilisearch
- invalidate user list cache

## Observability

Every hot route logs:

- event name
- `requestId`
- relevant entity/user id
- `durationMs` for list reads
- result count/total where relevant
- search provider/cache hit where relevant

`/api/health` reports:

- database
- search
- cache
- storage
- LLM configuration
- logging

## Latency Targets

Local/dev targets with warm dependencies:

- Auth session lookup: p95 under 25ms DB time.
- Entity list cache hit: p95 under 20ms app time.
- Entity list cache miss without search: p95 under 100ms for demo-scale data.
- Entity list Meilisearch path: p95 under 150ms for demo-scale data.
- Storage metadata list: p95 under 100ms for demo-scale data.
- LLM proxy overhead excluding provider latency: p95 under 50ms.
- UI search debounce: 300ms to avoid request-per-keystroke.

When production data exceeds roughly 100k rows per entity:

- Consider cursor pagination for infinite-scroll surfaces.
- Keep admin tables on offset pagination only if page-number navigation is required.
- Validate with `EXPLAIN ANALYZE` before adding or removing indexes.

## Extension Checklist

For a new entity:

1. Add Prisma model with timestamps and indexes.
2. Add migration.
3. Add Zod schemas in `types/`.
4. Add `lib/entities/<entity>.ts`.
5. Register config in `lib/entities/registry.ts`.
6. Add delegate mapping in `lib/entities/prisma-delegate.ts`.
7. Add collection and item API routes.
8. Add protected page with `EntityManagementPage`.
9. Add RBAC navigation entry.
10. Add seed data and Meilisearch indexing.
11. Run `pnpm db:generate`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
