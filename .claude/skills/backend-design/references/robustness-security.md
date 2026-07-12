# Robustness & Security

## Design failure modes before the happy path

Before writing the success case, work out: what if this is null, what if the network call times out, what if the dependency is down, what if two requests hit this at the same time. This isn't defensive-programming theater — every async boundary needs a *defined* loading state, empty state, and error state, because a blank screen or a hung request during a slow fetch or a thrown error is always a bug, never an acceptable degradation.

Fail gracefully and *specifically*:
- A degraded search provider still returns results, via a same-database fallback — not an error page.
- A failed log push never breaks the request it's logging.
- A double-submitted delete is a no-op success, not a `500`.
- A rate limiter whose backing store is down degrades to a local fallback, not "no limiting" or "block everything."

The distinction that matters: an *optional accelerator* (cache, search index, non-critical logging sink) degrades silently with a `warn` log. A *required dependency* (the primary database, an auth check) failing is a `503` or an honest error — never silently swallowed into a response that looks successful but isn't.

## Compensation for cross-system writes

Any write that spans two systems — object storage bytes plus a database metadata row, an external API call plus a local record — has a window where the first step succeeds and the second fails. Decide the compensation path at design time, not when it happens in production:
- If the DB write fails after the storage upload succeeded, delete the orphaned object (or mark it for cleanup) rather than leaving it unreferenced.
- If an external API call succeeds but the local record fails to save, either retry the local write or have a reconciliation path — don't let the two systems silently diverge.

This matters more than it looks like it does: an orphaned object in storage is a slow leak; a database row referencing a storage object that was never actually written is a bug a user hits days later.

## Concurrency for one-time flows

Anything that should happen exactly once — consuming a password-reset token, capturing a payment, redeeming an invite — needs a guarded update or a transaction, not a read-then-write in application code. Two simultaneous requests both reading "token not yet used" and then both proceeding to use it is a race condition, and the fix is to make the "check and consume" step atomic at the database level (a conditional update, or a transaction with the right isolation), not to hope the requests don't overlap.

## Authentication & session model (zero-trust defaults)

- Session tokens are opaque random values, stored **hashed** server-side — the raw token exists only in the client-held cookie/header and the response that first sets it. Never log, persist, or return the raw token anywhere else in the system.
- Verify a hash against a stored hash with a timing-safe comparison, never `===` — a naive string comparison on a secret is a timing side-channel, however small.
- Session cookies are `httpOnly`, scoped appropriately, and `secure` in production. `sameSite: "lax"` covers the common cross-site-POST CSRF case; if the frontend ever moves cross-origin (a separate SPA domain, a mobile app) and needs `sameSite: "none"`, add explicit CSRF tokens on state-changing requests at that point — don't ship the laxer cookie setting without the compensating control.
- Passwords are hashed with a slow, salted KDF (PBKDF2 at a high iteration count, or Argon2id if available) — never a fast general-purpose hash. A password reset token is single-use, short-lived, hashed at rest like a session token, and successfully redeeming it invalidates *all* existing sessions for that user — a stolen session shouldn't outlive a password change.
- **Every protected page and every protected API route re-verifies the session against the database, on every request.** An edge-level cookie-presence check is a UX convenience (fast redirect before a full round-trip) — it is never the actual authorization boundary. The authoritative check is the one that loads the session/user fresh from the database. Never treat "the edge layer let this request through" as proof of identity inside a handler.

## Authorization

- Role/permission checks happen server-side, per request, using a role loaded fresh from the database in the current request — never from a client-supplied field, a cookie value, or a cached client-side store. A client can send any role it wants in a request body; the only trustworthy role is the one the server looks up itself.
- `401` and `403` are distinct and both need to be used correctly: `401` means "we don't know who you are," `403` means "we know who you are and the answer is no." Collapsing them into one blanket "access denied" response makes client-side error handling and audit logs ambiguous — a client can't tell "log in" from "you'll never be allowed to do this."

## Input handling

- Assume every request body, query param, header, and cookie is adversarial. Schema validation at the boundary is not optional for any new endpoint, including ones that feel "internal."
- User-generated content rendered back to other users relies on the framework's default escaping — never a raw-HTML sink on unsanitized input. If rich text is genuinely required, sanitize server-side with an allowlist before storage, not just at render time (an unsanitized value stored once and rendered in many places is many XSS opportunities, not one).
- Never build a URL for a server-side `fetch` from unvalidated user input without an allowlist of permitted hosts/schemes — an unconstrained server-side fetch is a standing SSRF vector, letting a request reach internal services the client could never reach directly.

## Secrets & configuration

- A secret never gets a public/client-exposed env var prefix (e.g. `NEXT_PUBLIC_` in Next.js) — that prefix inlines the value into the client bundle at build time, permanently, for every user who ever loaded that build. Double-check the prefix before adding any new env var, not after.
- Required environment variables are validated at process startup — a missing or malformed critical config value should fail loudly at boot, not three requests into production traffic.

## Observability

- Every log call carries structured context (a request id, the entity id involved, duration in ms where relevant) so it's queryable as an event, not just readable as a sentence. A bare unstructured log line is a debugging dead end once there's real traffic volume.
- Log levels mean something specific: `debug` for development detail, `info` for expected business events (created, deleted, logged in), `warn` for expected-but-notable conditions (rate limit hit, a bulk operation, a degraded accelerator), `error` only for genuinely unexpected failures that need someone's attention. Logging at `error` for expected adversarial traffic (a rate limit hit, a validation failure) trains whoever's on call to ignore the error channel.
- A health-check endpoint that reports per-dependency status (database, search, cache, logging) should be extended whenever a new external dependency is added — a health check that silently stops reflecting reality is worse than no health check, because it creates false confidence.
- Logging itself must never throw or block a request — a logging sink failure should be swallowed internally, not propagate up and turn "we couldn't log this" into "the request failed."
