---
name: backend-design
description: Use this skill whenever backend work touches a database schema, a Prisma model or migration, an index, a REST/API route handler, pagination, caching, rate limiting, idempotency, or search — or when the user asks how to model, index, cache, or design the API for something. Trigger it proactively before writing any new app/api/**/route.ts handler, before any prisma/schema.prisma change, and before adding a query builder, even if the user doesn't say "backend design" out loud. This codebase is evaluated schema-first, then API-correctness, then everything else — skipping this skill produces backend work that looks reasonable in review but fails on missing indexes, unvalidated input, unbounded pagination, or a happy-path-only failure mode.
---

# Backend Design

Backend work here is graded in a specific order: **data model correctness first, then API contract correctness, then robustness/security, then performance polish.** A beautifully validated API sitting on an unindexed, denormalized-by-accident schema is a worse outcome than a slightly rougher API on a correct schema. Work in that order — don't let UI or API ergonomics pull you into skipping schema decisions.

This skill is a compressed checklist + decision guide. It points to four reference files for the reasoning behind each rule — read the relevant one before making a judgment call, not just before writing code.

## Phase 1 — Data layer (do this before writing any route handler)

Before touching `prisma/schema.prisma`:

1. Read the existing schema and migration history first. Never guess at current shape or bolt a new model on without checking what already references it.
2. Every foreign key gets `@@index([fkColumnId])` explicitly — Postgres does not auto-index the FK side.
3. Every column that will appear in a hot-path `WHERE`/`ORDER BY`/`JOIN` gets indexed. For composite indexes, order columns equality-filters-first, sort/range-column-last — match the query, not intuition.
4. Don't index speculatively and don't over-index write-heavy tables — every index taxes every `INSERT`/`UPDATE`.
5. Default to 3NF. Denormalize only for a measured read-heavy hot path, with a schema comment explaining why and a transactional write path keeping it in sync.
6. `createdAt`/`updatedAt` on every mutable model, via `@default(now())`/`@updatedAt` — never managed by hand.
7. Add raw SQL check constraints for invariants Prisma can't express (positive amounts, temporal ordering, minimum lengths). The database owns durable truth; API validation is a helpful second layer, not a substitute.
8. One logical change per migration, generated through the project's migration command — hand-edit generated SQL only for things Prisma's schema syntax can't express (partial/expression/`pg_trgm` indexes), and only before it's applied anywhere.

Full detail, worked examples, and the Prisma query-discipline rules (N+1 avoidance, `Promise.all` batching, `$transaction` for atomic multi-step writes, mass-assignment prevention) are in **`references/data-layer.md`**.

## Phase 2 — API layer

Every route handler follows one order: **authenticate → authorize → validate → mutate → observe → respond.** Don't reorder validation after a side effect, and don't skip a step because the happy path doesn't need it.

- Responses go through one consistent envelope (`{ data, meta }` / `{ error: { message, code, details } }`) with exact status codes — 200/201/204 success, 400/401/403/404/409/429 client-caused, 503 for a down required dependency, 500 for the genuinely unexpected. Never leak a stack trace or driver error into `details`.
- Every body/query/param/header is parsed with a schema validator's `safeParse` (never the throwing variant) before any side effect. Cap every array/string input — unbounded input is a resource-exhaustion vector, not just an edge case.
- Default to offset pagination (capped page size, capped max offset depth) for admin-style tables; switch to cursor/keyset pagination for infinite scroll or tables expected past ~100k rows, and make sure the sort column has a matching composite index.
- Bulk mutations and single-resource deletes are idempotent by construction — deleting an already-gone resource is a `204`, not a `404`. Anything a client might double-submit (payments, one-time actions) accepts an `Idempotency-Key` header and de-dupes against a short-lived store.
- List endpoints may cache-aside through an optional cache layer keyed on every dimension that changes the result (role, search, filters, sort, pagination) — treat the cache as a pure accelerator that fails soft, never as the source of truth, and invalidate by prefix after the write commits.
- Every unauthenticated, state-changing endpoint is rate-limited per IP+route before it does real work, returns `429` + `Retry-After`, and logs at `warn` (expected adversarial traffic), not `error`.

Full contract, the request-handling skeleton, and the search/caching/rate-limit patterns are in **`references/api-design.md`**.

## Phase 3 — Robustness & security

- Design the failure modes before the happy path: null/missing data, a down dependency, a timeout, two concurrent requests on the same resource. Every async boundary needs a defined loading, empty, and error state — not just a spinner that hangs forever.
- Cross-system writes (object storage + database metadata, external API + local record) need a compensation path for the case where the second step fails after the first succeeded.
- One-time flows (token consumption, payment capture) use a guarded transaction or optimistic concurrency check so two simultaneous requests can't both succeed.
- Authorization is a server-side, per-request, DB-fresh role check — never trust a client-supplied field, a cookie value, or an edge-level pass-through check as proof of identity or permission inside a handler. `401` (not authenticated) and `403` (authenticated, not permitted) are distinct and both matter.
- Assume every request body, query param, header, and cookie is adversarial. Never build a server-side `fetch` URL from unvalidated input without an allowlist (SSRF), never render unsanitized user content via a raw-HTML sink (XSS).

Full detail — session/token handling, the zero-trust model, and structured-logging conventions — is in **`references/robustness-security.md`**.

## Before calling backend work done

Run this against your diff:

- [ ] Schema: FKs indexed, hot-path filter/sort columns indexed, composite index column order matches the actual query, no `NOT NULL` column added to a live table without a default/backfill.
- [ ] API: every handler follows authn → authz → validate → mutate → observe → respond; every input path is schema-validated; status codes match the table in `references/api-design.md`.
- [ ] Pagination: bounded page size, bounded max offset (or cursor pagination with an indexed sort column).
- [ ] Idempotency: bulk/delete operations are no-ops on an already-applied state; any double-submittable action has an idempotency path.
- [ ] Caching/search: any cache or search failure degrades to a working fallback and logs a `warn`, never blocks or breaks the response.
- [ ] Robustness: nulls, timeouts, and concurrent writes considered — not just the happy path; cross-system writes have a compensation path.
- [ ] Security: authz check re-verified server-side from the DB; no client-supplied role/id trusted; no internals leaked in error responses.
- [ ] Observability: structured log with request id and duration on every new hot-path handler.

If any box is unchecked, that's the next thing to fix — not a note for later.
