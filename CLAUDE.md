# CLAUDE.md

This file is Claude Code's entry point for this repository. The full engineering standard — schema/indexing rules, API design, performance, security, and project structure — lives in one place to avoid drift between agent docs:

@AGENTS.md

Everything in `AGENTS.md` applies to you exactly as written. What follows here is operational guidance specific to working in this repo through Claude Code.

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
pnpm dev                     # start dev server
pnpm lint                    # ESLint
pnpm typecheck               # tsc --noEmit
pnpm build                   # production build — run before declaring a change done if it touches routing, config, or build-sensitive code
pnpm db:migrate              # apply a new Prisma migration
pnpm db:generate             # regenerate Prisma client after a schema change
pnpm db:reset:populate       # DESTRUCTIVE — wipes and reseeds local DB; confirm with the developer first
```

Full script catalog is in `README.md` — keep both in sync if you add a script.

## Before You Touch the Schema

1. Check `prisma/schema.prisma` and the existing migration history in `prisma/migrations/` first — never guess at current shape.
2. Write the migration through `pnpm db:migrate` (it generates + applies), don't hand-write migration SQL unless you need something Prisma's schema syntax can't express (partial/expression indexes) — in that case, generate the migration first, then hand-edit the generated (not-yet-applied) SQL file before it's committed.
3. Re-run `pnpm db:generate` after any schema change so `@prisma/client` types match before you write code against them.
4. For invariants Prisma cannot model, add raw SQL check constraints in a migration and document why. API validation is helpful, but the database owns durable truth.

## Before You Touch Auth or Route Protection

This template gates `/account`, `/admin`, `/moderator`, `/users`, `/products`, and `/organizations` behind a real session check in `app/(protected)/layout.tsx`, with `proxy.ts` doing a cheap edge-level redirect for UX only. If you add a new protected route, put its `page.tsx` under `app/(protected)/` and add its path prefix to `proxy.ts`'s matcher — don't rely on the proxy check alone; the layout's `getCurrentUser()` call is the actual authorization boundary. See AGENTS.md §6 for the full session/authz model.

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
