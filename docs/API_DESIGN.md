# AssetFlow — API Design

REST over the Prisma schema. Every handler runs in one order: **authn → authz → validate → mutate → observe → respond.** No step skipped, validation never after a side effect.

## Conventions

**Envelope**
```
success: { data: T, meta?: { total, page, limit, totalPages } }
error:   { error: { message, code, details? } }
```
`details` carries field-level validation output only — never a stack trace or driver message.

**Status codes**
200 read/update · 201 create · 204 delete (idempotent, even if already gone) · 400 validation · 401 no session · 403 authenticated-but-denied · 404 genuinely absent · 409 state/unique conflict · 429 rate-limited (+`Retry-After`) · 503 required dependency down · 500 unexpected only.

**Auth**
Opaque session token in an `httpOnly`, `secure`, `sameSite=lax` cookie. Stored as sha256 hash server-side; raw value never logged or persisted. Every protected route re-loads the session + user + role fresh from the DB per request — the cookie's presence is never the authorization boundary. Role comes from the DB row, never from the request body.

**Pagination**
Offset (`?page`, `?limit` capped at 100, max offset depth bounded) for all admin tables. The notification feed and activity log use keyset (`?cursor`) — both are append-heavy and expected past 100k rows, and both have the matching composite index (`[userId, createdAt]`, `[orgId, createdAt]`).

**Validation**
Every body/query/param `safeParse`d before business logic. Arrays capped (bulk ops ≤ 500 ids), strings capped (search ≤ 200 chars). Writes built from named validated fields only — never a spread of the raw body, so a client can't smuggle `role`/`status`/`orgId`.

**Multi-tenancy**
`orgId` is derived from the session user, never accepted from the client. Every query is filtered by it; every create injects it.

**Rate limiting**
Per IP+route, before real work, on all unauthenticated state-changing routes (login, signup, forgot/reset password). `429` + `Retry-After`, logged at `warn`.

## Roles

| | Employee | Dept Head | Asset Manager | Admin |
|---|---|---|---|---|
| View own allocations / book resources / raise maintenance / init transfer | ✓ | ✓ | ✓ | ✓ |
| View + approve within own department | | ✓ | ✓ | ✓ |
| Register/allocate assets, approve transfers/maintenance/returns | | | ✓ | ✓ |
| Org setup (depts, categories, directory, role assignment), audit cycles, org analytics | | | | ✓ |

Roles are assigned only by Admin via the directory endpoint. Signup can't set one.

---

## Auth

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | Creates `EMPLOYEE` only. `role`/`orgId` in body are ignored (not errored — stripped before the write). Rate-limited. |
| POST | `/auth/login` | public | Timing-safe hash compare. Rate-limited before the hash step. Sets session cookie. |
| POST | `/auth/logout` | any | Deletes the current session row. `204`. |
| POST | `/auth/forgot-password` | public | Always `204` regardless of whether the email exists (no account enumeration). Rate-limited. |
| POST | `/auth/reset-password` | public | Single-use token consumed in a guarded transaction; success invalidates all of the user's sessions. |
| GET | `/auth/me` | any | Current user + role, loaded fresh. |

## Organization setup (Admin)

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/departments` · `/departments/:id` (PATCH) | `deactivate` sets status, never hard-deletes (referenced by users/allocations). `409` on duplicate name in org. Self-parent / cycle rejected in validation. |
| GET/POST/PATCH | `/categories` · `/categories/:id` | `fieldSchema` validated as an array of `{key,label,type,required}`. |
| GET | `/employees` | Directory. Filter `?departmentId`, `?role`, `?status`, `?q`. |
| PATCH | `/employees/:id/role` | The only role-assignment path. Body `{ role }`. Admin only. Logged. |
| PATCH | `/employees/:id/status` | Activate/deactivate. |

## Assets

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/assets` | any (org-scoped) | Filters `?category`, `?status`, `?departmentId`, `?location`; search `?q` (tag/serial exact → trigram name fallback). Uses `[orgId,status,createdAt]`. |
| GET | `/assets/:id` | any | Includes allocation + maintenance history. |
| GET | `/assets/lookup?tag=` / `?serial=` / `?qr=` | any | Exact-match scan resolution. |
| POST | `/assets` | Asset Mgr | Tag generated server-side (see below). Enters `AVAILABLE`. |
| PATCH | `/assets/:id` | Asset Mgr | Status transitions validated against the allowed state machine, not set freely. |

**Asset tag generation** — inside the create transaction:
```
UPDATE "Organization" SET "assetSeq" = "assetSeq" + 1 WHERE id = $org RETURNING "assetSeq";
-- tag = "AF-" + pad(seq, 4)
```
Atomic increment; two concurrent registrations can't collide. Never a `SELECT max()+1`.

## Allocation & transfer

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/allocations` | Asset Mgr | Allocate to employee **or** department. Blocked if asset already held → `409` with the current holder + a hint to open a transfer. |
| POST | `/allocations/:id/return` | Asset Mgr | Captures condition + check-in notes; asset → `AVAILABLE`. |
| GET | `/allocations?overdue=true` | Dept Head+ | Uses the overdue partial index. |
| POST | `/transfers` | any | `fromEmployee` is the current holder; status `REQUESTED`. |
| POST | `/transfers/:id/approve` | Asset Mgr / Dept Head | Transaction below. |
| POST | `/transfers/:id/reject` | Asset Mgr / Dept Head | Sets `REJECTED`, notifies requester. |

**Allocate (double-allocation block)** — one transaction:
1. Load asset by `(orgId, id)`; `404` if absent.
2. Insert `Allocation`. The `allocation_one_active_per_asset` partial-unique index rejects a second active row → catch the unique violation and return `409 { code: "ASSET_ALREADY_ALLOCATED", details: { currentHolder } }`. Don't pre-check-then-insert (that races); let the constraint be the arbiter.
3. Set asset `status = ALLOCATED`.
4. Notify (`ASSET_ASSIGNED`) + activity log, after commit.

**Transfer approve** — one transaction:
1. Re-check status is `REQUESTED` with a guarded update (`WHERE status = 'REQUESTED'`) so two approvers can't both win.
2. Close the current active allocation (`returnedAt = now`).
3. Create the new active allocation for `toEmployee`.
4. Set transfer `COMPLETED`, `approvedById`, `decidedAt`.
5. Notify (`TRANSFER_APPROVED`) + log, after commit.

## Resource booking

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/assets/:id/bookings?from=&to=` | any | Calendar for a bookable asset over a window. `[assetId, startTime]`. |
| POST | `/bookings` | any | Overlap → `409`. Only assets with `isBookable=true`. |
| POST | `/bookings/:id/cancel` | owner / Dept Head | Sets `CANCELLED` (frees the slot for the exclusion constraint). |
| PATCH | `/bookings/:id` | owner | Reschedule = same overlap check. |

**Create booking** — validate `endTime > startTime` at the boundary, then insert. The `booking_no_overlap` GiST exclusion constraint is the authoritative guard: on violation return `409 { code: "BOOKING_OVERLAP" }`. The app may pre-scan `[assetId, startTime]` to render a friendly conflict, but the constraint is what actually prevents the concurrent double-book. Fire `BOOKING_CONFIRMED` after commit; a scheduled sweep sends `BOOKING_REMINDER` before the slot.

## Maintenance

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/maintenance?status=` | Asset Mgr+ | Kanban columns, grouped by status via `[status, createdAt]`. |
| POST | `/maintenance` | any | `PENDING`. Asset **not** yet flipped. |
| POST | `/maintenance/:id/approve` | Asset Mgr | Guarded `WHERE status='PENDING'`; asset → `UNDER_MAINTENANCE`; `MAINTENANCE_APPROVED`. |
| POST | `/maintenance/:id/reject` | Asset Mgr | `REJECTED`; asset untouched. |
| POST | `/maintenance/:id/assign` | Asset Mgr | Set technician; `TECHNICIAN_ASSIGNED`. |
| POST | `/maintenance/:id/progress` | technician | → `IN_PROGRESS`. |
| POST | `/maintenance/:id/resolve` | technician / Asset Mgr | `RESOLVED`; asset → `AVAILABLE` in the same transaction. |

Asset status flips are transactional with the request-status change — never two separate writes that can half-apply.

## Audit

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/audit-cycles` | Admin | Scope = dept and/or location + date range. Snapshots in-scope assets into `AuditItem` rows (`PENDING`). |
| POST | `/audit-cycles/:id/auditors` | Admin | Assign auditors (`AuditAssignment`). |
| GET | `/audit-cycles/:id/items` | assigned auditor | The checklist. |
| PATCH | `/audit-items/:id` | assigned auditor | Mark `VERIFIED`/`MISSING`/`DAMAGED` + notes. Authz: caller must be assigned to this cycle. |
| GET | `/audit-cycles/:id/discrepancies` | Admin | Flagged items (`[cycleId, verification]`). |
| POST | `/audit-cycles/:id/close` | Admin | Transaction below. Idempotent: closing a `CLOSED` cycle is a no-op `200`. |

**Close cycle** — one transaction:
1. Guarded update `WHERE status='IN_PROGRESS'`.
2. Set confirmed-`MISSING` assets → `LOST`.
3. Generate `DiscrepancyReport` (frozen snapshot: counts + flagged asset list).
4. Set cycle `CLOSED`, `closedAt`.
5. `AUDIT_DISCREPANCY` notifications + log, after commit.

## Reports (Admin/manager)

| Method | Path | Notes |
|---|---|---|
| GET | `/reports/utilization?groupBy=department` | Allocation days / capacity. |
| GET | `/reports/maintenance-frequency?by=asset\|category` | Count over range. |
| GET | `/reports/idle-assets` · `/reports/most-used` | From allocation + booking history. |
| GET | `/reports/due-maintenance` · `/reports/nearing-retirement` | Age / service thresholds. |
| GET | `/reports/booking-heatmap` | Bookings bucketed by weekday×hour. |
| GET | `/reports/:name/export?format=csv` | Streamed; same filters as the JSON view. |

Read-only aggregates may cache-aside, keyed on `orgId + report + every filter`. Cache is a pure accelerator — a miss or a cache-store failure falls through to the query, never a `500`.

## Notifications & activity

| Method | Path | Notes |
|---|---|---|
| GET | `/notifications?cursor=&filter=` | Keyset, newest-first. `filter` ∈ all/alerts/approvals/bookings. |
| GET | `/notifications/unread-count` | Badge; `[userId, isRead]`. |
| POST | `/notifications/:id/read` · `/notifications/read-all` | |
| GET | `/activity-logs?cursor=&entityType=&entityId=` | Admin/manager. Keyset over `[orgId, createdAt]`. |

Activity log is an audit aid, not a source of truth. Each entry stores ids/counts/labels only — never tokens, password fields, or raw bodies.

## Search

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/search?q=` | any (org-scoped) | Backs the Ctrl+K command palette. Fans out to assets (any role) + users/departments/organizations (gated per that entity's own `permissions.read`) in parallel, 5 results per group. Each group tries Meilisearch first (filtered to the caller's `orgId` inside the Meilisearch query itself, not just the Postgres follow-up) and falls back to a Postgres `contains` query on Meilisearch failure, same as every other list endpoint. |

## Robustness notes

- **Concurrency-sensitive writes** (allocate, transfer/maintenance/audit-close approvals) use guarded conditional updates or unique constraints as the arbiter, not read-then-write — so simultaneous requests can't both succeed.
- **Cross-system writes** (asset photo/document upload → storage, then DB row): if the DB write fails after upload, the orphaned object is marked for cleanup. If a post-commit notification/search-index push fails, it's fire-and-forget with a `warn` — the primary request still succeeds.
- **Degradation**: search index down → Postgres `contains`/trigram fallback. Cache down → direct query. Neither becomes an error surfaced to the user. A down *primary* DB is a `503`, not a swallowed success.
- **Health check** `/healthz` reports per-dependency status (db, cache, search) and is extended whenever a new dependency is added.
