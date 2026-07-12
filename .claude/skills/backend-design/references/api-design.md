# API Design: Contract, Lifecycle, Pagination, Caching, Search

## The response envelope

Every response — success or error — goes through one consistent shape. Never hand-roll a raw JSON response inline; a route handler that returns something outside the envelope breaks every client-side consumer that parses responses generically.

```ts
// Success
{ data: T, meta?: { total, page, limit, totalPages, ...extra } }
// Error
{ error: { message: string, code: string, details?: unknown } }
```

Status codes are exact, not "close enough":

| Code | Meaning | When |
|---|---|---|
| 200 | OK | read/update |
| 201 | Created | create |
| 204 | No Content | delete — idempotent, even for an already-gone resource |
| 400 | Bad Request | validation failure |
| 401 | Unauthorized | no session |
| 403 | Forbidden | authenticated, but not permitted |
| 404 | Not Found | resource genuinely doesn't exist (not used for delete-of-already-gone) |
| 409 | Conflict | unique constraint / state conflict |
| 429 | Too Many Requests | rate limited — include `Retry-After` |
| 503 | Service Unavailable | a *required* dependency is down |
| 500 | Internal Server Error | genuinely unexpected — never the default for a validation failure |

`details` on an error is for structured field-level validation errors (e.g. a Zod `.format()` output) — never a raw stack trace or a driver error message. Leaking either is an information-disclosure bug, not a debugging convenience.

`503` vs `500` is a meaningful distinction, not a style choice: `503` says "this specific dependency is down, retry later" (a down cache, search index, or database) and is the honest response when a *required* dependency can't be reached. `500` says "something we didn't anticipate broke." Collapsing them into one blanket 500 makes an outage look like a bug and a bug look like an outage.

## Request handling skeleton

Every handler follows this order. Don't reorder validation after a side effect — a handler that mutates before validating has no rollback story when validation later fails.

```ts
export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();               // 1. authn
    if (!user) return Api.unauthorized();
    if (!canMutate(user.role)) return Api.forbidden();  // 2. authz

    const body = await req.json().catch(() => null);
    const validation = SomeSchema.safeParse(body);      // 3. validate
    if (!validation.success) return Api.badRequest("...", validation.error.format());

    const result = await prisma.model.create({ data: /* named fields only */ });
    logger.info("resource.create", { requestId, id: result.id }); // 4. observe
    return Api.created(result);
  } catch (error) {
    logger.error("resource.create.failed", error, { requestId }); // 5. never leak internals
    return Api.internalError("Failed to create resource");
  }
}
```

The full collection-handler pattern (list/create/bulk-update/bulk-delete) additionally does: search-index sync (fire-and-forget, after the DB write commits), cache invalidation (same), and an activity-event record — all three *after* the authoritative write, never blocking the response on them.

## Validation

- Every body, query string, route param, and relevant header goes through a schema validator's non-throwing parse (`safeParse`, not `parse`) before touching business logic. An uncaught validation exception should never be what produces the response — that's an accidental 500 for what is actually a 400.
- Coerce and constrain at the schema boundary (e.g. `z.coerce.number().int().min(1).max(100)` for a page size) rather than manual `parseInt` + fallback logic scattered through the handler body.
- Cap every array/string input explicitly — a bulk operation capped at 500 ids, a search string capped at 200 chars. Unbounded input is a resource-exhaustion vector, and "the client would never send that" is not a security argument.

## Pagination

- **Offset pagination** (`page`/`limit`, capped at ~100/page) is the default for admin-style tables with page-number UI — it's simpler, and "jump to page N" only makes sense with an offset. Keep a hard bound on max offset depth too (`(page - 1) * limit` capped) — a user paging to page 5000 on an unbounded offset query forces Postgres to scan and discard everything before it.
- **Cursor/keyset pagination** — `WHERE (createdAt, id) < (lastCreatedAt, lastId) ORDER BY createdAt DESC, id DESC LIMIT N` — is for infinite-scroll feeds or any table expected past ~100k rows. Offset pagination degrades linearly there (`OFFSET 50000` still scans and discards 50,000 rows) and produces skipped/duplicated rows under concurrent writes during the scroll. A cursor-paginated endpoint needs a composite index matching the sort columns, or it's just as slow as the offset version.
- If a user needs to explore deeper than the offset bound allows, that's a signal to make them search/filter, not to raise the bound.

## Idempotency & concurrency

- Bulk deletes are idempotent by construction — `deleteMany` on a possibly-empty `id: { in: [...] }` set succeeds whether zero or many rows match. Keep that shape for any new bulk mutation; don't special-case "what if none of the ids exist."
- A single-resource `DELETE` returns `204` whether or not the resource existed at request time. Returning `404` on delete-of-already-deleted turns a network-retry into a false failure on the client — the client sees "not found" for an action that already succeeded.
- For any endpoint where a double-submit is plausible (payments, one-time actions, anything triggered by a button a user might double-click or a client might retry), accept an `Idempotency-Key` header: validate its shape (reasonable min/max length — reject malformed keys with `400`, don't silently ignore them), scope the cache key to the user and the specific action, and replay the cached response if the same key arrives again within a short TTL. An *absent* key is allowed — idempotency is opt-in for the client, not mandatory.
- For one-time flows (password reset consumption, a token redeemed exactly once), a guarded update or a transaction is what prevents two simultaneous requests from both succeeding — check the precondition and perform the state change atomically, not as two separate steps a race condition can interleave.

## Caching

- List endpoints may cache-aside through an optional cache (e.g. Redis), keyed on every dimension that changes the result: entity, role, search string, filters, sorts, and pagination. Missing any of those from the key means two different users (or two different queries) can silently share a cached response that doesn't match what they asked for.
- The cache is never authoritative. A cache read failure returns "no cached value" and falls through to the real query — it does not become a `500`. A cache write failure logs a `warn` and the response still succeeds. If the cache is unreachable, the feature should degrade to "slower," never to "broken."
- Mutations invalidate the entity's cache prefix *after* the database write commits — invalidating before the commit risks a stale read winning a race against the invalidation.
- Never cache an authenticated/per-user response at a shared layer without the role or session-relevant data baked into the cache key.

## Rate limiting

- Every unauthenticated, state-changing endpoint (login, signup, password reset request/confirm) is rate-limited per IP+route *before* it does any real work — this is the single highest-leverage defense against credential stuffing and account enumeration, and it has to run before the expensive part of the handler (password hashing, DB lookups), not after.
- A rate-limit response is `429` with a `Retry-After` header so well-behaved clients back off correctly, and it's logged at `warn`, not `error` — this is expected adversarial traffic, not an application bug.
- Prefer a rate limiter that degrades to an in-memory fallback if its backing store (Redis) is unavailable, rather than either failing open (no rate limiting at all) or failing closed (blocking all traffic) — see the robustness reference for the general "accelerator degrades, doesn't become a single point of failure" pattern.

## Search

- A typo-tolerant external search index (e.g. Meilisearch) is the primary search provider for list/search endpoints, with a same-database fallback (`contains`/`mode: insensitive`) for when it's down or the table is small. Every write path that mutates a searchable entity fires a fire-and-forget index update *after* the database write commits — search consistency is eventual, not transactional, and the response should never block on it.
- Every search call fails soft (returns `null` on network error or non-2xx), and the caller always has a defined fallback path — `searchIds === null` means "degrade to the database filter," not "error out."
- Any bulk import or migration that bypasses the normal write path (direct SQL, seed scripts) skips the index-update hooks — reindex explicitly after those, or the search index silently drifts from the database.

## Activity/audit events

If the system records a durable activity stream for mutations, treat it as a debugging/audit aid, not a source of truth — don't build business logic that depends on replaying it. Keep the write cheap (ids, counts, statuses, safe labels) and never put secrets, raw prompts, tokens, or large request bodies into event metadata; that turns an audit log into a second, less-protected copy of sensitive data.
