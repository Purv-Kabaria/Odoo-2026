# AssetFlow

AssetFlow is an enterprise asset-management app: register and track physical assets, allocate them to employees or departments, resolve allocation conflicts via transfer requests, book shared/bookable resources on a conflict-free calendar, run a maintenance workflow (with an AI-assisted retirement recommendation), audit assets against expected holders, and report on utilization, spend, and idle inventory — all behind real session auth and role-based access control.

Built on a Next.js 16 / Prisma 6 / PostgreSQL foundation with Redis, Meilisearch, and S3-compatible object storage baked in. There is intentionally no CI/CD, no test runner, no Husky, no lint-staged, and no commitlint — the project is optimized for fast local iteration: run the app, click through it, and use `pnpm lint`, `pnpm typecheck`, and `pnpm build` as your manual quality gate before committing.

## What's in the app

| Screen | What it does |
| --- | --- |
| **Auth** | Self-signup (goes to `PENDING_APPROVAL` until an Admin approves it) or admin-issued invite (auto-active on password set). Session cookies are opaque, hashed at rest, `httpOnly`. |
| **Admin / Users** | Manage users, roles, and org/department membership; approve pending signups; invite new users by email (Nodemailer, console-mock if SMTP isn't configured). |
| **Asset Directory** | Register assets (auto-generated `AF-####` tags), category-specific custom fields, photo upload, full-text + fuzzy search (Meilisearch, Postgres `pg_trgm` fallback), filter by category/status/department/location. |
| **Allocation & Transfer** | Allocate an asset to an employee or department; attempting to double-allocate surfaces a conflict banner with a one-click transfer request instead of a raw error; transfers are approved by a Department Head (scoped to their own department) or an Asset Manager/Admin. |
| **Resource Booking** | Book shared/bookable assets (meeting rooms, vehicles, equipment) on a day timeline with live conflict preview; overlap is enforced by a Postgres GiST exclusion constraint, not just an app-layer check. |
| **Maintenance** | Drag-and-drop Kanban (Pending → Approved → Technician Assigned → In Progress → Resolved, plus a computed Retired column) built with `dnd-kit`. Resolving a request fires a non-blocking LLM call that evaluates acquisition cost, maintenance history, and the issue description, and flags assets worth retiring; a manager-only "Verify & Retire" action closes the loop. |
| **Audit Cycles** | Scope an audit to a department or location, assign auditors, verify assets against expected holders, and auto-raise a maintenance request when an item is found damaged. |
| **Reports** | Org-wide KPIs, utilization by department, maintenance frequency, most-used/idle/near-retirement assets, spend by category, and a booking heatmap — cached with a short Redis TTL, CSV export per section. |
| **Notifications** | Per-user notification bell + panel (assignment, approval, booking, alert, info categories) pushed live over SSE via Redis pub/sub, backed by a durable Postgres table. |
| **Voice input** | Native Web Speech API dictation (mic button, live transcription, append-mode) reusable on any textarea — currently wired into the maintenance issue description and the asset-return condition notes. |

Role model: `ADMIN` (everything) > `ASSET_MANAGER` (assets/allocations/bookings/maintenance/reports, org-wide) > `DEPARTMENT_HEAD` (approvals scoped to their own department) > `EMPLOYEE` (self-service booking, raising maintenance, viewing their own allocations).

For schema, indexing, and API-design rationale, see [`AGENTS.md`](./AGENTS.md) — it's the engineering standard this codebase is held to (database design first, then API correctness, then everything else) — and [`CLAUDE.md`](./CLAUDE.md) for the day-to-day dev workflow an AI agent working in this repo should follow.

## Stack

- **Framework**: Next.js 16 App Router, React 19, TypeScript strict mode (no `any`, no unchecked `!`).
- **UI**: Tailwind CSS 4 (CSS-first `@theme` config), Shadcn/Radix primitives, Lucide icons, Framer Motion for purposeful micro-interactions.
- **Database**: PostgreSQL 15+, Prisma 6 (typed client, UUIDv7 primary keys stored as native `uuid` columns, hand-written migrations for constraints Prisma's schema syntax can't express — partial unique indexes, `CHECK` constraints, GiST exclusion constraints).
- **Cache**: Redis for list-endpoint cache-aside, rate limiting, and idempotency keys — every cache/Redis failure degrades soft, never a hard dependency.
- **Search**: Meilisearch for typo-tolerant table search, with a Postgres `ILIKE`/`pg_trgm` fallback when it's unavailable.
- **Object storage**: S3-compatible (MinIO locally) for asset photos and documents; metadata and RBAC stay in Postgres.
- **Drag-and-drop**: `dnd-kit` for the Maintenance Kanban board.
- **Voice input**: native browser `SpeechRecognition`/`webkitSpeechRecognition`, no external dependency.
- **LLM**: one OpenAI-compatible proxy adapter (`lib/llm.ts`) with timeout/retry/circuit-breaker, used for the maintenance retirement recommendation — never called directly from a component.
- **Email**: Nodemailer, mock/console-logging mode when SMTP isn't configured.
- **Logging**: structured JSON to stdout, optional Loki push — never a bare `console.log`.
- **Validation**: Zod is the single source of truth for both runtime validation and inferred TypeScript types across every API boundary.

## Local setup

Prerequisites: Node 22+ (see `.nvmrc`), pnpm 10+ (pinned via `packageManager` in `package.json` — never `npm`/`yarn`), Docker Desktop or Docker Engine.

```bash
pnpm install
cp .env.example .env
docker compose up -d          # Postgres, Redis, Meilisearch, MinIO, Loki
pnpm db:migrate                 # apply the committed migration history
pnpm db:generate                 # regenerate the Prisma client
pnpm db:reset:populate           # wipe + seed a full demo dataset (see below)
pnpm dev
```

Open `http://localhost:3000`. Check `docker compose ps` before assuming a service is down; `lib/env.ts` validates required environment variables at process startup and will fail fast with a clear message if something's missing or malformed — read that message, don't guess.

Only `DATABASE_URL` is strictly required to boot. Redis, Meilisearch, MinIO/S3, the LLM provider, and Loki are all optional at runtime: search falls back to Postgres, cache misses fall through to the database, storage/LLM routes return a clear `503` if unconfigured, and logging still writes JSON to stdout if Loki is absent — none of them can take down core CRUD.

### Demo logins

`pnpm db:reset:populate` seeds one organization ("AssetFlow Demo Co") with a full spread of departments, categories, assets (mixed statuses), allocations, transfers, bookings, maintenance requests (across every kanban status), and two audit cycles (one closed, one in progress). Every active demo user shares the password **`Password123!`**:

| Email | Role |
| --- | --- |
| `admin@assetflow.demo` | Admin |
| `manager@assetflow.demo` / `manager2@assetflow.demo` | Asset Manager |
| `depthead@assetflow.demo` / `depthead2@assetflow.demo` | Department Head |
| `employee@assetflow.demo` … `employee5@assetflow.demo` | Employee |

`pending1@assetflow.demo` / `pending2@assetflow.demo` are seeded in `PENDING_APPROVAL` (no password set) to exercise the admin-approval flow.

## Day-to-day commands

```bash
pnpm dev                    # start the dev server
pnpm lint                    # ESLint — zero warnings expected before a commit
pnpm typecheck                # tsc --noEmit
pnpm build                    # production build — run before shipping anything routing/config-sensitive
pnpm db:migrate                # create + apply a new Prisma migration
pnpm db:generate                # regenerate the Prisma client after a schema change
pnpm db:reset:populate          # DESTRUCTIVE — wipes and reseeds the local DB; never run against a shared DB
pnpm template:seed              # reseed demo data without a full reset
pnpm search:index                # reindex Meilisearch after a direct DB write (bulk import, seed) that skipped the API
```

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server (Turbopack). |
| `pnpm build` | Production build. |
| `pnpm start` | Runs the built app with `next start`. |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | `tsc --noEmit`. |
| `pnpm db:migrate` | Prisma `migrate dev` — create/apply local migrations. |
| `pnpm db:generate` | Regenerates the Prisma client. |
| `pnpm db:reset` | Resets the DB from migration history. Destructive. |
| `pnpm db:reset:populate` | Reset + seed + search index in one step. Destructive. |
| `pnpm db:populate` | Generate users + seed + index, without a schema reset. |
| `pnpm template:seed` | Runs `scripts/seed-template-data.js` — the full AssetFlow demo dataset. |
| `pnpm template:refresh` | `template:seed` + `search:index`, non-destructive. |
| `pnpm search:index` | Rebuilds Meilisearch indexes for users/organizations/assets. |
| `pnpm users:generate` / `users:seed` / `users:populate` | Standalone user-only seeding utilities. |
| `pnpm db:wipe` / `db:wipe:table` | Wipe all tables / one table. Destructive, local only. |

Keep this table in sync with `package.json` — a script that isn't documented doesn't exist as far as DX is concerned.

## Project structure

```text
app/            Routes, layouts, route handlers, error/loading boundaries.
  api/          Route handlers only — no business logic lives in components.
  (protected)/  Route group requiring an authenticated session (app/(protected)/layout.tsx is the real authz boundary; proxy.ts is a cheap edge-level redirect for UX only).
components/
  ui/           Shadcn primitives — extend, don't fork.
  layout/       Navbar, footer, app chrome.
  forms/ modals/ tables/ pages/  Feature-organized, never dumped at components/ root.
hooks/          Client hooks: data sync, media queries, reusable stateful logic (e.g. useSpeechToText).
lib/            Server + shared utilities: prisma client, auth, api envelope, logger, search, Redis cache, LLM adapter, resilience (timeout/retry/circuit-breaker), query builders, env validation, rate limiting.
prisma/         schema.prisma + committed migration history — treat migrations as history, not a scratchpad.
scripts/        DX scripts: seeding, generation, wiping, indexing — run via pnpm, never as one-off inline commands.
types/          Shared Zod schemas and inferred types — the cross-cutting type source of truth.
docs/           Problem statement / design references.
```

## Security notes worth knowing before you touch auth

- Sessions are random opaque tokens, stored **hashed** (`sha256`); the raw token only ever exists in the `httpOnly` cookie and the response that sets it.
- Passwords are PBKDF2-SHA256 at 210,000 iterations with a per-user salt, verified with `timingSafeEqual`.
- Every protected page and API route re-verifies the session against the database — the edge proxy's cookie-presence check is a UX convenience only, never the authorization boundary.
- Role checks are always server-side, using the role loaded fresh from the DB in the current request — never a client-supplied field.
- Every multi-tenant table is scoped to the caller's `orgId` at the query layer (`EntityConfig.tenantScope` for the generic CRUD engine, explicit `where: { orgId }` everywhere else) — this is the top security invariant in a multi-tenant app and the first thing to check when adding a new table or route.

See `AGENTS.md` §6 for the full model.

## Manual quality gates

There are no automated tests or CI in this project. Before committing meaningful changes, run:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

For UI work, also run `pnpm dev` and manually exercise the affected flow — golden path plus at least one edge case (empty/loading/error state) — in both light and dark mode, at mobile/tablet/desktop widths.
