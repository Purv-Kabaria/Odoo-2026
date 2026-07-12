# Odoo Template

A fast-paced, production-minded Next.js 16 template for building authenticated CRUD apps, admin panels, moderator tooling, user dashboards, object storage workflows, and LLM-backed features. It ships with PostgreSQL, Prisma, Redis cache/rate limits/idempotency, Meilisearch search, S3-compatible object storage, Loki-ready structured logging, secure session auth, RBAC, polished responsive UI, and scripts for wiping, seeding, and indexing local data.

There is intentionally no CI/CD, no test runner, no Husky, no lint-staged, and no commitlint. The template is optimized for rapid local iteration: run the app, inspect it, and use `pnpm lint`, `pnpm typecheck`, and `pnpm build` when you want a manual quality gate.

For implementation-level decisions, read [`docs/low-level-design.md`](./docs/low-level-design.md). It documents schema choices, indexing, session management, RBAC, Redis caching/rate limiting/idempotency, object storage, Meilisearch fallback, LLM API design, and extension rules.

## Evaluation Priorities

This template is tuned for projects evaluated on database design first, then backend correctness, modularity, frontend quality, performance, scalability, security, usability, and debuggability.

- Data models should be normalized, indexed for actual query shapes, constrained at the database layer where Prisma cannot express invariants, and documented in migrations.
- Backend APIs should validate every boundary, return consistent envelopes, handle rate limits/idempotency, and degrade optional infrastructure without hiding real failures.
- Dynamic data should prefer durable local primitives first. The activity stream is backed by Postgres and lightweight polling, avoiding extra third-party realtime services by default.
- UI should be clean, compact, responsive, and token-driven, with obvious loading, empty, error, hover, focus, and disabled states.
- External APIs should be minimal and replaceable. LLM calls are isolated behind one OpenAI-compatible proxy rather than scattered through components.

## Stack

- Next.js 16 App Router, React 19, TypeScript strict mode.
- Tailwind CSS 4, Shadcn/Radix primitives, Lucide icons, Framer Motion.
- PostgreSQL 15+ with Prisma 6 migrations and typed client.
- Redis for optional cache-aside, distributed rate limits, and idempotency.
- S3-compatible object storage with MinIO locally.
- Meilisearch for typo-tolerant table search, with Postgres fallback.
- Resilient external calls: timeouts, retries, circuit breakers.
- Structured JSON logging to stdout and optional Loki push.
- Zod validation for API payloads, query strings, and auth forms.
- PBKDF2 password auth, hashed opaque sessions, password reset, and RBAC.

## Local Setup On Any Device

Prerequisites:

- Node.js 22+
- pnpm 10+
- Docker Desktop or Docker Engine

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:generate
pnpm db:reset:populate
pnpm dev
```

Open `http://localhost:3000`.

Seeded demo users share the password `Password123!`. Seed roles are weighted, so you should get a mix of `USER`, `MODERATOR`, and `ADMIN` accounts. If you need fresh data, run `pnpm db:reset:populate` again.

## Environment Variables

Copy `.env.example` to `.env`.

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/odoo_db?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MEILISEARCH_HOST="http://localhost:7700"
MEILISEARCH_API_KEY="masterKey"
MEILISEARCH_USERS_INDEX="users"
MEILISEARCH_PRODUCTS_INDEX="products"
MEILISEARCH_ORGANIZATIONS_INDEX="organizations"
REDIS_URL="redis://localhost:6379"
CACHE_TTL_SECONDS="20"
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
S3_ACCESS_KEY_ID="minioadmin"
S3_SECRET_ACCESS_KEY="minioadmin"
S3_BUCKET="odoo-template"
S3_FORCE_PATH_STYLE="true"
STORAGE_MAX_UPLOAD_BYTES="5242880"
LLM_API_BASE_URL=""
LLM_API_KEY=""
LLM_MODEL="gpt-4.1-mini"
LLM_TIMEOUT_MS="30000"
LOKI_PUSH_URL="http://localhost:3100/loki/api/v1/push"
LOG_LEVEL="info"
```

Only `DATABASE_URL` is required. Meilisearch, Redis, MinIO/S3, LLM provider, and Loki fail soft when unavailable:

- Search falls back to Postgres.
- Cache misses fall through to Prisma.
- Storage and LLM routes return clear configuration errors.
- LLM provider outages return user-safe messages and never leak provider payloads.
- Invalid `Idempotency-Key` headers return `400`; absent keys are allowed.
- Logging still writes JSON to stdout if Loki is absent.

## Local Infrastructure

`docker-compose.yml` starts:

- `postgres`: durable relational database.
- `meilisearch`: search for table search bars.
- `redis`: optional cache-aside, rate limits, and idempotency.
- `minio`: local S3-compatible object storage.
- `loki`: optional log aggregation target.
- `app`: production image, opt-in with the `full` profile.

Normal local development uses hot reload:

```bash
docker compose up -d
pnpm dev
```

Production-image smoke run:

```bash
docker compose --profile full up -d --build
```

## Scripts

| Script | What it does | When to use |
| --- | --- | --- |
| `pnpm dev` | Starts Next.js dev server with Turbopack. | Daily local development. |
| `pnpm build` | Creates a production build. | Before shipping routing/config/build-sensitive changes. |
| `pnpm start` | Runs the built app with `next start`. | Local production preview after `pnpm build`. |
| `pnpm lint` | Runs ESLint. | Manual quality gate. |
| `pnpm typecheck` | Runs `tsc --noEmit`. | Manual type gate. |
| `pnpm db:migrate` | Runs Prisma migrate dev. | Create/apply local schema migrations. |
| `pnpm db:generate` | Regenerates Prisma Client. | After schema changes or fresh install. |
| `pnpm db:reset` | Resets DB from migration history. Destructive. | Local rebuild only. |
| `pnpm db:reset:populate` | Resets DB, seeds data, indexes search. Destructive. | Clean local demo state. |
| `pnpm db:populate` | Generates users, seeds template data, indexes search. | Refresh demo data without migration reset. |
| `pnpm users:generate` | Writes `scripts/users-data.json`. | Regenerate demo users. |
| `pnpm users:seed` | Seeds users from `scripts/users-data.json`. | User-only seed. |
| `pnpm users:index` | Rebuilds Meilisearch indexes. | Search refresh after direct DB edits. |
| `pnpm users:populate` | Generates and seeds users. | User-only refresh. |
| `pnpm template:seed` | Seeds users, products, and organizations. | Populate all template models. |
| `pnpm search:index` | Configures and indexes all Meilisearch indexes. | After imports, seeds, or migrations. |
| `pnpm template:refresh` | Seeds template data and indexes search. | Fast non-destructive refresh. |
| `pnpm db:wipe` | Wipes all DB tables. Destructive. | Local cleanup. |
| `pnpm db:wipe:table` | Wipes one DB table. Destructive. | Targeted local cleanup. |

## Scheduled Jobs

`instrumentation.ts` registers in-process `node-cron` jobs once per server process (no separate worker deployment). The `booking-checkin` job runs every 5 minutes and drives the booking check-in state machine: the UPCOMING → ONGOING → COMPLETED lifecycle transition, the 15-minute check-in deadline, the one-time 5-minute grace extension, and auto-cancel on a missed check-in. It uses node-cron's `noOverlap: true` so a slow run skips the next tick of that same job instead of overlapping.

## App Surfaces

- `/account`: user panel for profile editing and password settings.
- `/admin`: admin panel with access to every registered entity.
- `/moderator`: moderator panel for operational CRUD.
- `/activity`: database-backed mutation/activity stream with polling refresh.
- `/users`: configurable users table.
- `/products`: configurable products table.
- `/organizations`: configurable organizations table.
- `/storage`: signed-in object upload, download, and delete.
- `/api/llm/chat`: protected OpenAI-compatible chat-completion proxy.

The entity pages are variations of one system. The table supports:

- Debounced Meilisearch search with Redis-cached list responses.
- Postgres fallback search when Meilisearch is unavailable.
- Column visibility toggles saved in `localStorage`.
- Filters, multi-sort, pagination, row selection, mobile cards.
- Create, view, edit, single delete, selected delete, delete all.
- Bulk edit selected rows with server-side field/type validation.
- Loading overlays, empty states, toast errors, hover/focus states, and cursor affordances.

## Security And RBAC

- `proxy.ts` does a fast edge-safe cookie-presence redirect for protected pages.
- `app/(protected)/layout.tsx` is the real page boundary and re-verifies the session against the database.
- Every protected API route calls `getCurrentUser()` and checks entity permissions server-side.
- Sessions are opaque random tokens stored hashed in `AuthSession.tokenHash`.
- Session cookies are `httpOnly`, `sameSite=lax`, `secure` in production.
- Passwords use PBKDF2-SHA256 with per-user salt and timing-safe verification.
- Forgot/reset password tokens are hashed, short-lived, and single-use.
- Auth endpoints are rate-limited per IP and route.
- All request bodies, route params, filters, sorts, and pagination inputs are Zod-validated.
- Mutations build explicit Prisma `data` objects; no raw request-body spreading.
- Security headers and CSP live in `next.config.ts`.

Current roles:

- `ADMIN`: full CRUD for users, products, organizations; can change user roles.
- `MODERATOR`: operational CRUD where allowed; cannot change user roles.
- `USER`: account panel and self profile editing only by default.

## Caching, Search, Logging, Latency

- Entity list APIs use Redis cache-aside with a short TTL (`CACHE_TTL_SECONDS`).
- Cache keys vary by entity, role, page, limit, search, filters, and sorts.
- Create/update/delete/bulk mutations invalidate the matching entity cache prefix.
- Meilisearch is the primary search provider; Postgres is the degraded fallback.
- Meilisearch write/index failures are logged as warnings; CRUD responses still succeed after the database commit.
- Hot list handlers log `durationMs`, result counts, search provider, and cache hits.
- `/api/health` reports database, search, cache, storage, LLM configuration, and logging status.
- Redis, Meilisearch, MinIO/S3, LLM provider, and Loki are optional runtime dependencies; none can take down core CRUD.
- Redis also backs distributed rate limits and `Idempotency-Key` response caching when configured, with local fallback where safe.

## Dynamic Data And Activity

`ActivityEvent` is the local realtime-ready event table. CRUD writes, account profile edits, object storage mutations, and LLM requests append compact events after the authoritative write succeeds. The `/activity` page polls `GET /api/activity` and shows recent events without requiring a websocket broker or external realtime provider.

Admins and moderators can see all activity. Normal users see their own activity. Indexes support recent-feed queries, actor history, entity history, and action dashboards.

## Error Handling And Edge Cases

- API responses always use the shared envelope from `lib/api.ts`; clients parse it through `lib/api-client.ts`.
- Validation errors return `400` with Zod field details. The frontend shows the human message and never exposes stack traces.
- Auth errors distinguish `401` signed-out from `403` not allowed.
- Rate limits return `429` with `Retry-After`.
- Required-but-unavailable integrations return `503`, for example unconfigured object storage or LLM provider.
- Deletes are retry-safe: item deletes return `204` when the row is already gone, and bulk deletes report the number deleted.
- Password reset tokens are single-use under concurrent submission; only one transaction can consume a token.
- Storage uploads compensate for partial failure: if object bytes are written but metadata creation fails, the uploaded object is deleted asynchronously.
- Empty tables, empty storage buckets, and no search results render empty states, not errors.

## Object Storage

Local development uses MinIO:

- API: `http://localhost:9000`
- Console: `http://localhost:9001`
- Default credentials: `minioadmin` / `minioadmin`

The `/storage` page uploads files through `POST /api/storage`. Metadata is stored in Postgres (`ObjectAsset`), while bytes are stored in the configured S3 bucket. Users can access their own files; admins and moderators can see all files.

Allowed upload types are JPEG, PNG, WebP, GIF, PDF, plain text, and CSV. Control max size with `STORAGE_MAX_UPLOAD_BYTES`.

Upload, download, and delete failures return specific user-facing messages. Object bytes are only served to the owner, admins, or moderators. Metadata deletes are synchronous; byte deletes are asynchronous and idempotent so retries are safe.

## LLM API Design

`POST /api/llm/chat` is provider-agnostic and assumes an OpenAI-compatible `/chat/completions` endpoint under `LLM_API_BASE_URL`. It is protected by session auth, Redis-backed rate limits, bounded Zod validation, timeout, one retry, circuit breaking, structured logging, and optional `Idempotency-Key`.

The route validates provider configuration before making a network call. Provider failures are mapped to user-safe messages, token usage is logged when available, and repeated dependency failures trip an in-process circuit breaker to avoid cascading latency.

## Turning This Into Any Project

To add a new model:

1. Add the Prisma model and indexes in `prisma/schema.prisma`.
2. Run `pnpm db:migrate` and `pnpm db:generate`.
3. Add a Zod read/write schema in `types/`.
4. Add an entity config in `lib/entities/<model>.ts`.
5. Register it in `lib/entities/registry.ts`.
6. Extend `lib/entities/prisma-delegate.ts` for the Prisma delegate.
7. Add `app/api/<model>/route.ts` and `app/api/<model>/[id]/route.ts` using `createCollectionHandlers` and `createItemHandlers`.
8. Add `app/(protected)/<model>/page.tsx` with `EntityManagementPage`.
9. Add the route to `lib/navigation.ts` with the roles that can see it.
10. Add Meilisearch index settings/indexing in `scripts/index-users-search.js`, or rename that script as your template grows.
11. Add seed data in `scripts/seed-template-data.js`.
12. Run `pnpm template:refresh`.

The key customization surface is the `EntityConfig`:

- `columns`: visible fields, labels, formats, filterability, sortability, searchability, editable state.
- `schema`: Zod write schema.
- `permissions`: per-role `read/create/update/delete`.
- `restrictedFields`: stricter field-level controls, such as admin-only `role`.
- `defaultSort`: stable default ordering.
- `search`: Meilisearch index env var.

## UI/UX Standards

- Keep pages compact, dense, and responsive from 320px upward.
- Use Lucide icons for actions and statuses.
- Every clickable item needs `cursor-pointer`, hover state, and visible focus state.
- Use skeletons/loading overlays instead of blank screens.
- Use empty states for no data, and error toasts only for real failures.
- Respect reduced-motion; keep Framer Motion purposeful and light.
- Avoid hydration hazards: no browser-only APIs in server render or first client render.
- Verify light and dark mode for any visible change.

## Docker

Build and run only the app image:

```bash
docker build -t odoo-template .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public" \
  -e NEXT_PUBLIC_APP_URL="https://your-domain.example" \
  -e REDIS_URL="redis://redis-host:6379" \
  odoo-template
```

Run migrations against the target database separately with:

```bash
pnpm exec prisma migrate deploy
```

## Project Structure

```text
app/
  (protected)/        Authenticated pages: account, admin, moderator, entity CRUD
  api/                Route handlers only
components/
  forms/              Auth/account/entity forms
  landing/            Public landing sections
  layout/             Navbar/footer/app chrome
  modals/             CRUD, filtering, sorting, bulk-edit modals
  pages/              Page-level reusable shells/wrappers
  tables/             Generic entity table and table helpers
  ui/                 Shadcn/Radix primitives
lib/
  entities/           Entity configs, generic CRUD handlers, query builders
  auth.ts             Sessions, auth helpers, current-user lookup
  api-client.ts       Frontend API envelope parser and friendly fallback messages
  redis-cache.ts      Optional Redis cache-aside helper
  meilisearch.ts      Search indexing/search helpers
  object-storage.ts   S3-compatible storage helper
  resilience.ts       Timeout/retry/circuit-breaker fetch helper
  logger.ts           JSON logging and Loki push
  api.ts              API response envelope
  env.ts              Zod environment validation
prisma/
  schema.prisma       Database schema
  migrations/         Committed migration history
scripts/
  seed/generate/wipe/index local data utilities
types/
  Zod schemas and inferred DTO types
proxy.ts              Edge-safe protected-route redirect gate
```

## Manual Quality Gates

This template does not include automated tests or CI. Before committing meaningful changes, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

For UI work, also run `pnpm dev` and manually exercise the affected flows in light/dark mode and at mobile/tablet/desktop widths.
