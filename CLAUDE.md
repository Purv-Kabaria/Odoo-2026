# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file is Claude Code's entry point for this repository. The full engineering standard — schema/indexing rules, API design, performance, security, and project structure — lives in one place to avoid drift between agent docs:

@AGENTS.md

Everything in `AGENTS.md` applies to you exactly as written. What follows here is operational guidance and repo-specific facts for working in this repo through Claude Code. See `README.md` for the full feature tour, ER diagram, and rationale write-ups (caching, search, indexing, UUIDv7) — it is more detailed and more current than `AGENTS.md` on project-specific specifics, so prefer it when the two disagree on this repo's actual state.

## What This Repo Is

This is **AssetFlow**, a concrete enterprise asset-management app built on top of the generic template `AGENTS.md` describes — not the bare template itself. It tracks physical assets (QR-tagged), allocates them individually or in bulk kits to employees/departments, resolves allocation conflicts via transfer requests, books shared resources on a conflict-free calendar with enforced check-in/auto-release, runs an AI-assisted maintenance Kanban, audits inventory, and reports on utilization/spend — behind real session auth and RBAC (`ADMIN` > `ASSET_MANAGER` > `DEPARTMENT_HEAD` > `EMPLOYEE`). Because it's a real product built from the template, a few conventions have diverged from `AGENTS.md`'s generic defaults (see below) — where this file and `AGENTS.md` disagree on a concrete detail, trust this file and the actual code.

## What This Template Optimizes For

Evaluation priority is database design first, then backend API correctness, modularity, frontend quality, performance, scalability, security, usability, and debuggability. Before polishing UI, check whether the schema, indexes, constraints, validation, and API contracts are strong enough to support the feature cleanly.

## Environment

- Runtime: Node (see `.nvmrc` for the pinned version), package manager `pnpm` (pinned via `packageManager` in `package.json`) — never `npm`/`yarn`.
- Local infra (Postgres, Meilisearch, Redis, MinIO, Loki) runs via `docker compose up -d`. Check `docker compose ps` before assuming a service is down.
- Copy `.env.example` to `.env` before first run; `lib/env.ts` will fail fast at startup with a clear message if a required variable is missing or malformed — read that message, don't guess.

## Day-to-Day Commands

You have shell access — run these directly instead of asking the developer to:

```bash
pnpm install                 # install deps
pnpm dev                     # start dev server (Turbopack)
pnpm lint                    # ESLint
pnpm typecheck               # tsc --noEmit
pnpm build                   # production build — run before declaring a change done if it touches routing, config, or build-sensitive code
pnpm db:migrate              # apply a new Prisma migration
pnpm db:generate             # regenerate Prisma client after a schema change
pnpm db:reset:populate       # DESTRUCTIVE — wipes, migrates, and reseeds the full AssetFlow demo dataset; confirm with the developer first
pnpm template:refresh        # non-destructive: reseed demo data + reindex search, without a schema reset
pnpm smoke:auth              # closest thing to a test suite — see below
```

There is no automated test framework (no Jest/Vitest/Playwright). `pnpm smoke:auth` (`scripts/smoke-auth.js`) is the closest thing to a "test" command: a standalone Node script that seeds a throwaway org/users directly via Prisma and drives `/api/auth/*` over `fetch` against `http://localhost:3000` — run `pnpm dev` in another terminal first. Otherwise `pnpm lint` + `pnpm typecheck` + `pnpm build` + a manual browser pass are the real quality gate (see "Verifying Frontend Changes" below).

Full script catalog (including `db:wipe`, `db:wipe:table`, `users:generate/seed/populate`, `db:populate`) is in `README.md`'s "Day-to-day commands" table — keep both in sync if you add a script.

## Before You Touch the Schema

1. Check `prisma/schema.prisma` and the existing migration history in `prisma/migrations/` first — never guess at current shape. There are 20 tables under one multi-tenant root (`Organization`); every table carries `orgId` and is scoped to it at the query layer.
2. Write the migration through `pnpm db:migrate` (it generates + applies), don't hand-write migration SQL unless you need something Prisma's schema syntax can't express (partial/expression indexes, `CHECK` constraints, GiST exclusion constraints) — in that case, generate the migration first, then hand-edit the generated (not-yet-applied) SQL file before it's committed.
3. Re-run `pnpm db:generate` after any schema change so `@prisma/client` types match before you write code against them.
4. For invariants Prisma cannot model, add raw SQL check constraints in a migration and document why. API validation is helpful, but the database owns durable truth. This codebase leans on this heavily — see "Non-obvious DB invariants" below before assuming an app-layer check is sufficient.
5. **Primary keys in this repo are `uuid(7)`** (`@id @default(uuid(7)) @db.Uuid`, native Postgres `uuid` column), not `cuid()` — `AGENTS.md`'s identifier-strategy section lists `cuid()` as the generic default but explicitly allows UUIDv7 as a documented tradeoff for high-write, multi-tenant schemas; this repo already made that call for every table, so match the existing pattern rather than reverting to `cuid()`. Rationale is written out in `README.md` under "Why UUIDv7 over auto-increment or UUIDv4."

## Non-obvious DB invariants (enforced in migration SQL, not just app code)

- `Allocation`: a **partial unique index** (`WHERE status = 'ACTIVE'`) makes double-allocation of the same asset structurally impossible — `KitAllocation` reuses the same `Allocation` rows/constraint per asset, so bulk-kit allocation can't bypass it.
- `Allocation` / `KitAllocation`: a `CHECK` constraint enforces exactly one of `toEmployeeId`/`toDepartmentId` (XOR, never both/neither).
- `Booking`: a **GiST exclusion constraint** (`EXCLUDE USING gist (assetId WITH =, tsrange(startTime, endTime, '[)') WITH &&)`) makes overlapping bookings for the same asset structurally impossible under concurrent writes — don't reintroduce an app-layer "check then insert" as the primary guard, it has a race window this doesn't.
- `User`: a `CHECK` constraint enforces any non-`PENDING_APPROVAL` user has a password set.
- `AuditCycle`: a `CHECK` constraint enforces `endDate >= startDate` and that scope is at most one of department/location.

## Before You Touch Auth or Route Protection

`proxy.ts`'s `matcher` array is the current source of truth for which path prefixes get the edge-level redirect — check it directly rather than trusting a hardcoded list here, since it changes as routes are added. As of now it covers `/account`, `/activity`, `/admin`, `/moderator`, `/users`, `/organizations`, `/departments`, `/assets`, `/allocations`, `/bookings`, `/maintenance`, `/audit`, `/reports`, `/notifications` (there is no `/products` route in this app — that's an `AGENTS.md` generic-template example, not a real route here). The actual authorization boundary is `getCurrentUser()` in `app/(protected)/layout.tsx`, which re-verifies the session against the database on every request — `proxy.ts` is Edge-safe (no Prisma/Node-only imports) and only does a cheap cookie-presence check for UX. If you add a new protected route, put its `page.tsx` under `app/(protected)/` **and** add its path prefix to `proxy.ts`'s matcher — don't rely on the proxy check alone. See `AGENTS.md` §6 for the full session/authz model.

## Architecture: patterns that span multiple files

- **Generic entity-CRUD engine** (`lib/entities/registry.ts` + `lib/entities/crud-handlers.ts`, with per-entity configs like `lib/entities/assets.ts`, `users.ts`, `organizations.ts`, `departments.ts`): list/search/filter/sort/paginate/create/update/delete for Users, Organizations, Departments, and Assets are driven by one shared handler reading an `EntityConfig`, not bespoke logic per route. When adding a CRUD-shaped entity, extend the registry instead of writing a new one-off route handler; when changing list/filter/sort behavior, change it in the shared handler, not per-entity.
- **CRON sweeps** (`instrumentation.ts` → `lib/cron/`): booking check-in reminders/grace-period/auto-cancel, booking-ending-soon reminders, and overdue-return alerts run via `node-cron`, registered once per server process from `instrumentation.ts` (guarded by a `globalThis` singleton against Next dev-mode hot-reload double-registering jobs) — there is no separate worker deployment. `lib/redis-cache.ts` uses the same `globalThis` singleton pattern for its client.
- **Notifications** (`lib/notifications.ts` + `lib/redis-pubsub.ts` + `/api/notifications`): durable Postgres table is the source of truth, Redis pub/sub pushes live updates over SSE so nothing is lost if a client wasn't connected when an event fired.
- **Resilience layer** (`lib/resilience.ts`): timeout/retry/circuit-breaker wrapping for the LLM proxy (`lib/llm.ts`) and object storage (`lib/object-storage.ts`) calls — both are optional dependencies that degrade to a user-safe `503` rather than hanging or throwing raw errors.
- **Asset Kits**: `AssetKit`/`AssetKitItem`/`KitAllocation` let multiple assets be allocated to one employee/department in one action; every asset in the kit is validated available before anything commits, and each asset still gets its own individual `Allocation` row/history linked back to the batch `KitAllocation` header — see the "Non-obvious DB invariants" section above for how the underlying `Allocation` table's constraints make this race-safe.

## Before You Touch APIs Or Integrations

- Route handlers return through `lib/api.ts`; client code reads through `lib/api-client.ts`.
- Do not hide critical failures. Missing/down required dependencies return a user-safe `503`; optional accelerators degrade with structured `warn` logs.
- Validate body, query, params, headers, filters, sorts, pagination, and idempotency headers before side effects.
- Preserve compensation paths for cross-system writes, especially object storage plus database metadata.
- Preserve guarded transactions for one-time flows like password reset token consumption.
- For dynamic/realtime UI, prefer the Postgres-backed activity stream and polling route before adding external realtime APIs.
- Keep third-party APIs isolated behind route handlers or `lib/` adapters. Do not call LLM or storage providers directly from components.

## Verifying Frontend Changes

For any UI-visible change: start `pnpm dev`, exercise the golden path and at least one edge case (empty state, error state, loading state) in a real browser, and check both light and dark mode before reporting the work as complete. This fast-paced template intentionally has no automated test suite — type-checking confirms type correctness, not behavioral or visual correctness, so manual verification (curl for API/redirect behavior, a real browser pass for UI) is the safety net. Say so explicitly if you weren't able to verify something (e.g. no local database available).

## Commits

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`), one coherent change per commit. There are no Husky, lint-staged, commitlint, CI, or test gates in this template; run `pnpm lint`, `pnpm typecheck`, and `pnpm build` manually before committing meaningful work.
- Only commit when the user asks. When asked to build something multi-step, land it as a sequence of small, reviewable commits rather than one large diff, matching how this template's own history is structured.

## Task Tracking

For any multi-step piece of work (new feature, multi-file refactor, template-wide change), use the task list tool to plan and track progress rather than silently working through a mental checklist — it's how the developer sees progress on longer-running work.
