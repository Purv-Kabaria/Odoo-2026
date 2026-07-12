# Data Layer: Schema, Indexing, and Query Discipline

The schema is graded before anything built on top of it. An elegant API on a schema that will need a rewrite at 10k rows is a worse deliverable than a plain API on a schema that scales. Get this right first.

## Identifier strategy

Primary keys are `cuid()` (`@id @default(cuid())`): collision-resistant, sortable-enough, URL-safe, and doesn't leak sequential business volume the way an auto-increment int does (a competitor can't infer "we have 40,000 orders" from watching the URL bar). Don't switch to UUIDv4 — worse index locality for no real gain — unless interoperating with an external system that mandates it. For a genuinely high-write table where index locality at scale matters, ULID/UUIDv7 is a reasonable alternative — document the tradeoff in the migration if you make that call. Never expose an internal auto-increment sequence number to the client, even if one exists for internal tooling.

## Foreign key delete behavior

Every relation needs a deliberate `onDelete` choice — this isn't a detail to leave at the ORM default, because the wrong choice either corrupts history or breaks a delete with a foreign-key-violation error at the worst possible time.

- **`Cascade`** for genuinely owned child rows that have no meaning without the parent — a user's sessions, an order's line items. Deleting the parent should delete these; keeping them around as orphans is the bug.
- **`Restrict`** (or the ORM's equivalent block-the-delete behavior) for a reference to a row that has independent meaning and a history that must survive — an order line item's reference to the `Product` it was purchased from. Letting a product delete cascade into silently deleting historical order data is a data-loss bug wearing a delete button; the right fix is to block the product delete (or require an explicit archive/deactivate flow instead of a hard delete) while the order history still references it.
- **`SetNull`** for an optional, informational reference where losing the link is acceptable but the referencing row should survive — an activity event's `actorId` when the actor's account is later deleted; the event stays as a historical record with the actor field cleared, rather than vanishing or blocking the account deletion.

Pick per relation, not per table — a model can reasonably cascade on one FK and restrict on another depending on what each relation actually means.

## Indexing rules

These are non-negotiable, in priority order:

1. **Every foreign key gets an index.** Postgres (and Prisma) only auto-indexes the *referenced* side of a relation, not the FK column itself. `@@index([userId])` on the child model is mandatory, not optional polish.
2. **Every column in a hot-path `WHERE`, `ORDER BY`, or `JOIN` gets evaluated for an index.** "Hot path" means a real query shape from the query-building code, not a hypothetical future filter. Don't index a column nobody queries yet.
3. **Composite indexes match query order**: equality filters first, the sort/range column last. A query that does `WHERE status = X ORDER BY createdAt DESC` wants `@@index([status, createdAt])` — one composite index, not two singles. A B-tree composite index only serves left-to-right prefix lookups, so column order isn't cosmetic.

   This repo's `Product` model is a working example — it filters by `category` or `status` and sorts by `createdAt`, so it carries both single-column indexes (for filter-only or sort-only queries) *and* the composite pairs `[status, createdAt]` / `[category, createdAt]` for the combined case. Mirror that pattern: single index for "just this filter, default sort" plus a composite for "this filter, this sort."

4. **Don't over-index write-heavy tables.** Every index adds write amplification — each `INSERT`/`UPDATE` touches every index on the row. A session or event table with high write throughput should carry only indexes with a proven read need.
5. **Unique constraints already are indexes.** Don't add a redundant plain index on a column that has `@unique`.
6. **Partial indexes for filtered hot paths on large tables** — e.g. an "active sessions" lookup wants `CREATE INDEX ... ON "AuthSession" (userId) WHERE "expiresAt" > now()`, not a full-table index. Prisma's schema syntax can't express the `WHERE` clause, so generate the migration, then hand-edit the *not-yet-applied* SQL file to add it.
7. **Never use a leading-wildcard `ILIKE '%x%'` as the primary search path at scale** — it can't use a B-tree index and forces a sequential scan. A typo-tolerant external search index is the right primary path for real fuzzy search; a Postgres `contains`/`mode: insensitive` filter is an acceptable *degraded* fallback for small tables or when that search index is down, not the primary strategy for anything expected to pass ~50k rows. If Postgres genuinely has to be the primary fuzzy-search path, add a `pg_trgm` GIN index: `CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (name gin_trgm_ops)`.
8. **Verify with `EXPLAIN ANALYZE` before assuming an index helped.** The planner correctly chooses a sequential scan on small tables — don't add an index to a 200-row lookup table and call it optimization. Missing indexes only matter once row counts are realistic.
9. **Add raw SQL check constraints for invariants the ORM schema syntax can't express** — positive counts, non-negative money, minimum security parameters, temporal ordering (`endDate > startDate`). API-level validation catches the request before it hits the database, but the constraint is what makes the invariant durable against any write path, including scripts, seeds, and future code that forgets the rule.

Before adding any index, find the actual query builder for that entity (the code assembling `where`/`orderBy`/`skip`/`take`) and index against what it actually constructs — not what a filter *might* look like someday.

## Normalization vs. denormalization

Default to 3NF. Denormalize deliberately, only for a measured read-heavy hot path, and document *why* in a schema comment — e.g. a materialized `totalOrders` counter that avoids a `COUNT(*)` join on every list render. Every denormalized field needs an explicit, tested write path that keeps it in sync — a transaction, not "we'll remember to update it in the other place." An out-of-sync denormalized field is a correctness bug, not a performance footnote.

Prefer enums over free-text status columns. An enum is validated at the database level, takes less space, and indexes/compares faster than a string — and it makes "what are the valid states" a schema fact instead of a convention someone has to remember.

## Timestamps, soft deletes, auditability

Every mutable model gets `createdAt @default(now())` and `updatedAt @updatedAt`, never set by hand in application code. If a project needs audit history or "undo" beyond hard deletes, introduce `deletedAt DateTime?` with a partial index (`WHERE "deletedAt" IS NULL`) and filter it *everywhere* that model is queried — a half-adopted soft delete (present on one table, absent on its siblings) is worse than no soft delete, because it creates an inconsistent mental model across the codebase.

## Migrations

- One logical schema change per migration. Never hand-edit a migration that's already been applied anywhere outside your own unstarted local branch — create a new migration instead.
- For a zero-downtime change against a live system, use expand/contract: add the new column/table nullable or with a default → backfill → deploy code that writes both old and new → flip reads to the new path → drop the old column in a *later* migration. Never ship a `NOT NULL` column with no default against a table that already has rows, without a backfill step — that migration fails the moment it runs against real data.
- Migration history is committed history, not a scratch pad. A destructive reset-and-reseed command is for local/dev only — never run it against a database anyone else depends on without asking first.

## Prisma (or equivalent ORM) query discipline

- **Select only what you need.** Prefer an explicit `select` over the bare model return for list endpoints — don't ship password hashes, internal tokens, or unrelated columns to the client by default.
- **Kill N+1 before it starts.** If the code is about to loop over rows and issue a query per row, stop — use one `include`/`select` with nested relations, or a single batched `WHERE ... IN (...)` query instead.
- **Batch independent reads with `Promise.all`.** A list endpoint doing `findMany` and `count` for the same filter is two independent queries — never `await` them sequentially.
- **Use a transaction for multi-step writes that must be atomic.** Credential upsert + token consumption + session invalidation on a password reset is the canonical example — a partial write there is a security bug, not just a data bug.
- **Never build raw SQL by string interpolation.** Parameterized/tagged-template queries only. String-concatenated SQL is a SQL injection vector with no exceptions.
- **Mass assignment is a security bug.** Never spread a raw request body into a `data:` object. Construct the write payload from named, schema-validated fields only — this is what stops a client from sneaking a `role` or `id` field into a create/update payload that the handler never intended to accept. Route handlers that need to check "did the caller try to set a restricted field" should check the *raw* body against an allowlist before validation defaults fill it in, not after.
