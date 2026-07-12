# AssetFlow — Problem Statement & Requirements

**Source material:**
- `ps.pdf` (repo root) — the official Odoo hackathon brief.
- Mockup (POC): https://app.excalidraw.com/l/65VNwvy7c4X/5ceOBMjbDby — a **live, shared, multiplayer** Excalidraw board (370+ concurrent participants observed when captured, i.e. shared across many hackathon teams' rooms, not a private board). Screenshots of the AssetFlow-labeled frames were captured automatically and saved to `docs/mockup/` for a stable local reference, since the board is live and could change or become unavailable. Captured 2026-07-12.

This document merges both sources into one requirements reference and adds the things neither source states explicitly: an inferred domain model, explicit state machines, a role/action permission matrix, and a list of open product decisions that need to be made before schema design starts (per this repo's engineering standard, schema design is evaluated first — see `AGENTS.md` §2 — so these decisions are the actual first step of the build, not a footnote).

---

## 1. Vision, Mission, Non-Goals

**Vision.** Digitize how organizations track, allocate, and maintain physical assets and shared resources through a centralized ERP-style platform. Industry-agnostic — any organization with equipment, furniture, vehicles, or shared spaces (offices, schools, hospitals, factories, agencies).

**Mission (hackathon deliverable).** A user-centric, responsive web application giving staff intuitive tools to:
- Set up departments, asset categories, and the employee directory.
- Register and track assets through their full lifecycle.
- Allocate assets to employees/departments with conflict handling.
- Book shared resources (rooms, vehicles, equipment) without overlaps.
- Run a structured maintenance approval workflow.
- Run structured audit cycles to catch discrepancies.
- Get notified of overdue returns, bookings, and maintenance events.

**Explicit non-goals** (stated directly in the brief — treat any feature that drifts into these as scope creep unless the user asks for it):
- No purchasing workflow.
- No invoicing.
- No accounting integration. `Acquisition Cost` is captured on an asset **for ranking/reporting only** — it must never feed a ledger, invoice, or payment concept.

**Platform assumption.** The brief explicitly asks for a **web solution**. Design every feature — including anything that touches "QR code" — assuming the user is at a desk, not necessarily holding a phone. QR code *fields* are in scope (see Screen 4); a QR camera-scan workflow is not implied as a requirement.

---

## 2. User Roles

| Role | Scope | Key permissions from the brief |
|---|---|---|
| **Admin** | Org-wide | Manages departments, asset categories, audit cycles, and employee/role assignment (Organization Setup). Views org-wide analytics. **Only role that can promote an Employee to Department Head or Asset Manager**, and only from the Employee Directory (Screen 3, Tab C). |
| **Asset Manager** | Org-wide (assets) | Registers and allocates assets. Approves transfers, maintenance requests, and audit discrepancy resolution. Approves asset returns and condition check-in notes. |
| **Department Head** | Their department | Views assets allocated to their department. Approves allocation/transfer requests within their department. Books shared resources on behalf of the department. |
| **Employee** | Themselves | Views assets allocated to them. Books shared resources. Raises maintenance requests. Initiates return/transfer requests. |

**Account creation is intentionally non-self-elevating** — this is called out twice in the brief (once in the Problem Statement, once in Screen 1's purpose statement), so treat it as a hard security requirement, not incidental copy:
- Signup creates an **Employee account only**. No role selector at signup.
- Admin promotes Employees to Department Head / Asset Manager from the Employee Directory — **this is the only place roles are assigned**, anywhere in the system.
- This maps directly onto this repo's existing authorization doctrine (`AGENTS.md` §6): role must be read fresh from the database per request, never from a client-supplied field — the brief's "no self-assigned admin roles" requirement is that same principle expressed as a product rule instead of a code rule. The existing `PATCH` bulk-update path in `lib/entities/crud-handlers.ts` has a `restrictedFields`/`allowedRoles` mechanism already built for exactly this "only some roles may set this field" shape — role promotion should reuse that pattern rather than a bespoke check.

**Open question:** can one employee hold both Department Head and Asset Manager simultaneously, or are the two elevated roles mutually exclusive? The brief never says. Mockup's `role` column (Screen 3 Tab C, implied) isn't visible in the captured frames. Needs a decision before the `User`/`Role` schema is finalized — a single `role` enum column forces mutual exclusivity; anything else needs a join table.

---

## 3. Screens — Functional Requirements

Every screen (2 through 10) shares one **left sidebar**, in this fixed order: `Dashboard · Organization setup · Assets · Allocation & Transfer · Resource Booking · Maintenance · Audit · Reports · Notifications`. This is a concrete, load-bearing piece of information architecture pulled from the mockup (every screen's sidebar renders identically) — treat it as the app's primary navigation, not a per-screen detail to reinvent.

### Screen 1 — Login / Signup
*Mockup: `docs/mockup/01-login-orgsetup-assets.png`*

**Purpose:** Authenticate with realistic, non-self-elevating account creation.

- Fields: Email, Password.
- "Forgot password" link.
- "New here?" panel with explicit copy: *"Sign up creates an employee account — admin roles assigned later"* — this string should probably appear near-verbatim in the actual signup UI, since it's the user-facing explanation of the security model above.
- "Create Account" primary action.
- Brief also requires: email & password login, forgot password, **session validation** (i.e. every protected screen must re-check the session — matches this repo's existing `(protected)/layout.tsx` + `getCurrentUser()` boundary; no new pattern needed here, just apply the existing one).

### Screen 2 — Dashboard / Home
*Mockup: `docs/mockup/02-dashboard-allocation-booking.png`*

**Purpose:** Real-time operational snapshot, role-aware.

- KPI cards: **Available**, **Allocated**, a second **Available** card (mockup shows two "Available" cards with different numbers — likely "assets available" vs. "resources available"; needs disambiguating, see Open Questions), **Active Bookings**, **Pending Transfers**, **Upcoming returns**.
- A distinct, visually separated banner for overdue items: mockup shows a red/pink banner *"N assets overdue for return — flagged for follow-up"* — this must be a separate element from the KPI cards, not folded into one of them, per the brief's explicit requirement that overdue items are "highlighted separately from upcoming ones."
- Quick actions: **+ Register asset**, **Book resource**, **Raise requests**.
- "Recent Activity" feed — plain-language lines, e.g. *"Laptop AF-0114 — allocated to Priya Shah — IT dept"*, *"Room B2 — booking confirmed — 2:00 to 3:00 PM"*, *"Projector AF-0062 — maintenance resolved"*. This is a role-agnostic activity stream — maps directly onto this repo's existing `ActivityEvent` + `/api/activity` polling pattern (`AGENTS.md` §4A); reuse it, extend the `ActivityAction` enum for AssetFlow's action types instead of inventing a parallel mechanism.
- Content should be **role-scoped**: brief says "give every role a real-time operational snapshot," implying an Employee's dashboard shows their own allocations/bookings while Admin/Asset Manager see org-wide figures — not explicitly detailed further, treat as an open question (see §6).

### Screen 3 — Organization Setup (Admin only, 3 tabs)
*Mockup: `docs/mockup/01-login-orgsetup-assets.png`*

**Purpose:** Maintain master data everything else depends on.

**Tab A — Department Management**
- Create/edit/deactivate a department.
- Fields: **Head** (a Department Head), optional **Parent Department** (hierarchy), **Status** (Active/Inactive).
- Mockup table columns: Department, Head, Parent Dept, Status. Sample rows: `Engineering / aditi rao / — / Active`, `Facilities / rohan mehta / — / Active`, `Field ops (east) / sana iqbal / Field Ops / Inactive` (this last row demonstrates the hierarchy: "Field ops (east)" has parent "Field Ops").
- Explicit footnote in the mockup: *"Editing a department here also drives the picklist in Screen 4 & 5."* — i.e. the Department list is a live foreign-key source for the asset registration form (Screen 4) and the allocation/transfer form (Screen 5), not a static copy. Any department rename/deactivation needs to propagate correctly to those pickers (an inactive department should probably not appear as a selectable allocation target for *new* allocations, while still being valid for *historical* records — a soft-delete-style concern, see `AGENTS.md` §2 on soft deletes).

**Tab B — Asset Category Management**
- Create/edit categories (Electronics, Furniture, Vehicles, etc.).
- **Optional category-specific fields**, e.g. a warranty period field that only applies to Electronics. This is a schema-design-relevant requirement: categories need a way to declare extra typed fields, and assets in that category need to store values for them. A JSON column on `Asset` for category-specific attributes (with the category's declared field list as the validation source) is the standard way to model this without an EAV table explosion — worth deciding explicitly rather than defaulting into it.

**Tab C — Employee Directory**
- Fields: Name, Email, Department, Role, Status (Active/Inactive).
- **This is the only screen where Admin promotes an Employee to Department Head or Asset Manager** — restated here because it's the security-critical action on this tab, not incidental CRUD.

### Screen 4 — Asset Registration & Directory
*Mockup: `docs/mockup/01-login-orgsetup-assets.png`*

**Purpose:** Register assets; search/track them centrally.

**Registration fields** (from the brief; not all visible in the captured list-view mockup, which shows the directory/search table, not the registration form):
- Name, Category (sourced from Screen 3 Tab B), **auto-generated Asset Tag** (e.g. `AF-0001`), Serial Number, Acquisition Date, Acquisition Cost (ranking/reports only — see Non-Goals), Condition, Location, photo/documents, a **"shared/bookable" boolean flag**.
- The "shared/bookable" flag is the fork point between the Allocation module (Screen 5, one holder at a time) and the Booking module (Screen 6, time-sliced). **Open question:** is this flag mutually exclusive (an asset is either individually-allocatable or bookable, never both) or can a single asset support both flows? The brief's example (a laptop being allocated) and (a conference room being booked) suggest two different asset *shapes* in practice, but the spec doesn't say they're structurally exclusive.

**Directory/search view** (what's actually visible in the mockup):
- Search bar: *"Search by tag, serial, or QR code…"*.
- Filter chips: Category, Status, Department.
- Table columns: **Tag, Name, Category, Status, Location**. Sample rows: `AF-0012 / Dell Laptop / Electronics / Allocated / bengaluru`, `AF-0062 / Projector / Electronics / Maintenance / HQ Floor 2`, `AF-0201 / Office chair / Furniture / Available / Warehouse`.
- Note the asset tag format is **inconsistent across the mockup's own sample data** (`AF-0012`, `AF-0062`, `AF-0201` here vs. `AF-114`, `AF-003`, `AF-873`, `AF-9921` elsewhere) — that's mockup sloppiness, not a spec requirement. Pick one fixed-width, zero-padded format (e.g. always `AF-` + 4 digits) and generate it server-side, sequentially, inside the same transaction as the insert (a race between two concurrent registrations must not produce a duplicate tag — this is exactly the "guarded transaction" pattern `AGENTS.md` §11 calls out for one-time flows).
- Per-asset detail should show **allocation history + maintenance history** (explicit requirement) — i.e. an asset detail page distinct from this list view, not shown in the captured mockup frames.
- Lifecycle status values shown across the mockups: **Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed** (see the state machine in §5).

### Screen 5 — Asset Allocation & Transfer
*Mockup: `docs/mockup/02-dashboard-allocation-booking.png`, `docs/mockup/03-allocation-booking-maintenance.png`*

**Purpose:** Manage who holds what, with explicit conflict rules.

- Allocate an asset to an employee/department, with an optional **Expected Return Date**.
- **The double-allocation block** (the brief's flagship business rule, and the mockup's most detailed interaction): attempting to allocate an already-held asset is blocked with an inline red banner reading, near-verbatim: *"Already Allocated to [Holder] ([Department]) — Direct re-allocation is blocked, submit a transfer request below."* The UI then pivots into a **Transfer Request** sub-form instead of a dead end:
  - Fields: **From** (current holder, pre-filled, read-only), **To** (employee picker), **Reason** (free text).
  - Submit button: **"Submit Request"**.
- Transfer workflow (from the brief): `Requested → Approved (by Asset Manager or Department Head) → Re-allocated`, with history updated automatically on completion.
- **Allocation history** shown per asset: dated entries, e.g. *"Mar 12 — Allocated to Priya Shah — Engineering"*, *"Jan 04 — Returned by Arjun Nair — condition: good"*. Confirms allocation history entries carry a condition note on return, not just a date/actor.
- Return flow: mark returned, capture condition check-in notes, asset status reverts to Available.
- Overdue allocations (past Expected Return Date) auto-flag and feed the Dashboard + Notifications — this is the same "time passes, not a user action" detection problem discussed for the notification system; it needs the sweep mechanism already planned (lazy sweep-on-read plus a scheduled cron sweep, per the earlier notification-architecture decision), applied uniformly across overdue allocations, overdue bookings, and overdue maintenance.

### Screen 6 — Resource Booking
*Mockup: `docs/mockup/02-dashboard-allocation-booking.png`, `docs/mockup/03-allocation-booking-maintenance.png`*

**Purpose:** Time-slot booking of shared resources with no overlaps.

- Resource + date picker, e.g. *"Conference room B2 — Tue, 7 Jul"*.
- Day timeline view of existing bookings for that resource (mockup shows hourly rows 9:00 through 1:00).
- **Overlap validation, with the exact boundary rule spelled out in the brief:** Room B2 booked 9:00–10:00. A request for 9:30–10:30 is rejected (overlaps). A request for 10:00–11:00 succeeds (starts exactly when the prior booking ends — **not** a conflict). This is a closed/open interval question that a naive `startA < endB AND endA > startB` overlap check gets right by default, but it's worth stating explicitly as a test case since an off-by-one on the boundary (`<=`/`>=` vs `<`/`>`) is the single easiest way to get this business rule wrong.
- Mockup shows the rejected request rendered as a **red dashed block** overlaid on the existing **blue confirmed block**, labeled *"Requested 9:30 to 10:30 — conflict — slot is unavailable"* — a good concrete UX reference for how to surface the conflict inline rather than just a toast/alert.
- Booking status values: **Upcoming, Ongoing, Completed, Cancelled**.
- Cancel/reschedule; a reminder notification before the slot starts (another "time passes" trigger — same sweep mechanism as overdue detection).

### Screen 7 — Maintenance Management
*Mockup: `docs/mockup/03-allocation-booking-maintenance.png`, `docs/mockup/04-maintenance-reports-notifications.png`*

**Purpose:** Route repairs through approval before work starts.

- Raise request: select asset, describe issue, set priority, attach photo.
- **Rendered as a kanban board** in the mockup — this is a concrete, deliberate UI choice worth keeping, not just a workflow-diagram simplification. Columns observed: **Pending → Approved → Technician Assigned → In Progress → Resolved**.
  - Sample cards: `AF-0062 Projector bulb not turning on` (Pending); `AF-003 ac unit noisy compressor` (Approved); `AF-0078 forklift — tech: R Varma` (Technician Assigned); `AF-897 Printer Jam — parts ordered` (In Progress); `AF-873 Chair repair — resolved 7 Jul` (Resolved, shown in green).
  - The brief's textual workflow additionally names a **Rejected** outcome at the approval step (`Pending → Approved / Rejected`) that isn't rendered as its own kanban column in the mockup — treat Rejected as a terminal status the card exits the board into (e.g. a filtered/archived view), not a 6th visible column, unless the user says otherwise.
- Footnote in the mockup, stated as a hard state-transition rule: *"Approving a card moves the asset to Under Maintenance; resolving returns it to Available."* — i.e. the asset's lifecycle status is a **derived side effect** of the maintenance card's column, not an independently-editable field while a maintenance request is open against that asset.
- Maintenance history retained per asset (feeds the Screen 4 asset detail view).

### Screen 8 — Asset Audit
*Mockup: `docs/mockup/04-maintenance-reports-notifications.png`, `docs/mockup/05-audit-reports.png`*

**Purpose:** Structured verification cycles, not a single form.

- Create an **Audit Cycle**: scope (department/location), date range, one or more assigned **auditors**. Mockup example banner: *"Q3 audit: Engineering dept — 1–15 Jul — Auditors: A. Rao, S. Iqbal"*.
- Auditor marks each asset against an **Expected Location**, with a verification status: **Verified / Missing / Damaged**. Mockup table: `AF-003 Dell laptop / Desk E12 / Verified`, `AF-9921 Office chair / Desk E14 / Missing`, `AF-9838 Monitor / Desk E15 / Damaged`.
- System auto-generates a discrepancy report for flagged items — mockup shows this as an inline yellow banner, *"N assets flagged — discrepancy report generated automatically"*, live-updating as the auditor works, not a separate step run after the fact.
- **Close Audit Cycle**: locks the cycle (no further edits) and updates affected asset statuses — a confirmed-**Missing** item transitions the asset's lifecycle status to **Lost**. (The brief doesn't say what happens to a confirmed-**Damaged** item's lifecycle status — plausibly it should route into the Maintenance workflow rather than silently sit as "Damaged" with no next step; flag as an open question.)
- Audit history retained per cycle.

### Screen 9 — Reports & Analytics
*Mockup: `docs/mockup/04-maintenance-reports-notifications.png`, `docs/mockup/05-audit-reports.png`*

**Purpose:** Actionable operational insight for managers.

Mockup shows two chart panels side by side — **"Utilization by department"** (bar chart) and **"Maintenance Frequency"** (line chart, trending up) — plus three text-list panels:
- **Most used assets**: e.g. *"Room B2: 34 bookings this month"*, *"Van AF-343: 21 trips this month"*, *"Projector AF-335: 18 uses"*.
- **Idle assets**: e.g. *"Camera AF-0301: unused 60+ days"*, *"Chair AF-0410: unused 45 days"*.
- **Assets due for maintenance / nearing retirement**: e.g. *"Forklift AF-0087: service due in 5 days"*, *"Laptop AF-0020: 4 years old, nearing retirement"* — note "nearing retirement" here is driven by **asset age**, which at least partially answers one of the open questions from the earlier feature-ideation round (a retirement signal needs *some* computed criterion — age-vs-category is the one concrete example the brief itself gives, even if it doesn't rule out combining it with condition/maintenance-frequency later).
- **Export report** action.
- The brief additionally asks for a **"Resource booking heatmap (peak usage windows)"** and a **department-wise allocation summary** — neither is visible in the captured frames (likely below the fold or on a second tab of this screen). Both are still requirements; just not visually confirmed by the mockup.

### Screen 10 — Activity Logs & Notifications
*Mockup: `docs/mockup/04-maintenance-reports-notifications.png`*

**Purpose:** Keep every role informed without digging for updates.

- Filter tabs: **All, Alerts, Approvals, Bookings**.
- Feed entries observed, each with a relative timestamp: *"Laptop AF-0014 assigned to Priya Shah"* (2m ago), *"Maintenance request AF-0055 approved"* (18m ago), *"Booking confirmed: Room B2, 2:00 to 3:00 PM"* (1h ago), *"Transfer approved: AF-0033 to Facilities dept"* (3h ago), *"Overdue return: AF-0021 was due 3 days ago"* (1d ago), *"Audit discrepancy flagged: AF-0088 damaged"* (2d ago).
- The brief's fuller notification-type list: Asset Assigned, Maintenance Approved/Rejected, Booking Confirmed/Cancelled/Reminder, Transfer Approved, Overdue Return Alert, Audit Discrepancy Flagged.
- Also required on this screen: a **full audit log of admin/manager/employee actions** (who did what, when) — this is the "activity log" half of the screen, distinct from the "notifications" half (a personalized, filtered, read/unread inbox). The mockup's single feed may be showing both blended together; keep them as two backing concepts even if they render in one UI (an org-wide immutable audit trail vs. a per-user notification inbox with read state) — this matches the `ActivityEvent` (audit trail) vs. `Notification` (personalized inbox) split already agreed on for the notification system design.

---

## 4. Core Workflow (end-to-end, from the brief)

1. Admin sets up departments, asset categories, and promotes select employees to Department Head / Asset Manager.
2. Asset Manager registers a new asset — enters the system as **Available**.
3. Asset is allocated to an employee/department (blocked if already allocated — a transfer request is required instead), or marked as a shared bookable resource.
4. Employees book shared resources by time slot; overlapping requests are rejected automatically.
5. If an asset needs repair, the holder raises a maintenance request, which must be approved before work begins and before the asset flips to Under Maintenance.
6. Assets are transferred or returned as needs change; overdue returns are flagged automatically.
7. Periodic audit cycles assign auditors, verify assets, and auto-generate discrepancy reports before closing.
8. All activity is tracked through notifications, logs, and reports.

---

## 5. Asset Lifecycle — State Machine (inferred, needs sign-off)

The brief lists the full state set (`Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed`) and gives two explicit example transitions (`Available ↔ Under Maintenance`, `Allocated → Available`) but does not give the complete transition graph. Inferred from the workflow descriptions across all screens:

| From | To | Trigger |
|---|---|---|
| Available | Allocated | Allocation (Screen 5), succeeds only if not already allocated |
| Allocated | Available | Return flow (Screen 5), or a completed Transfer re-allocation passes through here conceptually |
| Available | Reserved | Booking confirmed, **if** "Reserved" applies to bookable shared resources rather than individually-allocated assets (see open question below) |
| Reserved | Available | Booking completed/cancelled |
| Available ↔ Under Maintenance | Maintenance card approved (→) / resolved (←) — driven by the Screen 7 kanban, not directly editable |
| Allocated → Under Maintenance | Plausible but unconfirmed — can a maintenance request be raised against a currently-*allocated* asset (e.g. the holder reports it broken) without a return step first? The brief's flow ("holder raises a maintenance request") suggests yes, which means Under Maintenance needs a way to remember "was Allocated to X before this" so it can return there instead of to Available on resolution — **this directly contradicts the mockup's stated rule that resolving returns the asset to Available**. This is the single most important open question to resolve before the state machine is finalized. |
| Available/Allocated → Lost | Audit cycle closes with a confirmed-Missing verification |
| Any non-terminal → Retired | Admin/Asset Manager action, age/condition-driven (Reports screen surfaces candidates) |
| Any non-terminal → Disposed | Admin/Asset Manager action, presumably only reachable from Retired |

**Open questions this table surfaces:**
- Does resolving a maintenance request always return the asset to Available, or back to its prior holder if it was Allocated when the request was raised?
- Is Reserved a status on the *asset* record at all, or purely a *booking* record's status, with the asset's own lifecycle status staying Available the whole time a shared resource is booked? (This changes whether "Reserved" belongs on `Asset.status` or only on `Booking.status`.)
- Are Lost/Retired/Disposed strictly one-way (no path back to Available), or can a "Lost" item be found again? The brief never shows a reverse transition, but real-world asset audits do sometimes recover "lost" items.

---

## 6. Cross-Cutting Business Rules

These are the rules explicit enough in the brief/mockup to encode as tested logic, not vague guidance:

1. **No double allocation.** An asset with an active allocation cannot be allocated again; the only path forward is a Transfer Request against the current holder.
2. **Booking overlap uses a half-open interval.** `[start, end)` — a booking ending at `T` and one starting at `T` do not conflict; any actual time overlap does.
3. **Role assignment has exactly one entry point.** Only Admin, only from the Employee Directory (Screen 3 Tab C). Signup can never produce anything but an Employee.
4. **Maintenance approval gates the lifecycle transition**, not the request creation. Raising a request never changes asset status; only an *approved* request flips it to Under Maintenance, and only a *resolved* one flips it back.
5. **Acquisition Cost is informational only** — must never be summed into, referenced by, or exposed through anything resembling an invoice/ledger/payment feature.
6. **Department edits cascade live** into the Screen 4 (asset registration) and Screen 5 (allocation) picklists — these are foreign-key relationships to `Department`, not a copied/cached department name string.
7. **Audit cycles are append-then-lock.** Verification entries can be added/edited while the cycle is open; **Close Audit Cycle** is a one-way action that locks the cycle and commits any status-changing side effects (e.g. Missing → Lost) — this is exactly the kind of one-time, guarded-transaction flow `AGENTS.md` §11 calls out (two auditors closing the same cycle simultaneously must not double-apply the side effects).
8. **Overdue detection is time-based, not action-based**, for three separate cases (allocations past Expected Return Date, bookings that were never checked into/no-showed if that feature is added, maintenance requests aging past an implicit SLA). All three need the same underlying "time passed" detection mechanism — build it once, not three times.

---

## 7. Implied Domain Entities (for schema design — not a final schema)

This is a first pass at the entities the above requires, meant to seed the actual `prisma/schema.prisma` design conversation (per `AGENTS.md` §2, that conversation should happen deliberately, checking existing migration history and indexing against real query shapes — this list is not a substitute for that).

- **Department** — name, head (→ User), parent department (self-relation, nullable), status.
- **AssetCategory** — name, and a mechanism for declaring optional category-specific fields (e.g. warranty period on Electronics).
- **User** (extends the existing template's `User`) — add department (→ Department), and an AssetFlow-specific role concept layered on top of (or replacing) the existing `UserRole` enum: Admin / Asset Manager / Department Head / Employee. Resolve the "can a user hold two elevated roles" open question before finalizing this as a single enum column vs. a join table.
- **Asset** — tag (unique, generated), name, category (→ AssetCategory), serial number, acquisition date, acquisition cost (report-only), condition, location, photos/documents, `isBookable` flag, lifecycle status enum, category-specific attributes (JSON, validated against the category's declared fields).
- **Allocation** — asset (→ Asset), holder (→ User and/or → Department), allocated-at, expected return date, returned-at (nullable), return condition note. Only one *open* (not-yet-returned) allocation per asset at a time — this is the double-allocation rule, and it wants a partial unique index or an equivalent guarded-transaction check, not just application-level validation.
- **TransferRequest** — asset (→ Asset), from-holder, to-holder, reason, status (Requested/Approved/Rejected), approver, resulting allocation.
- **Resource** — could be the same table as `Asset` (an asset with `isBookable = true`) or a distinct table — depends on the open question in §3 Screen 4.
- **Booking** — resource (→ Asset/Resource), booker (→ User), start time, end time, status (Upcoming/Ongoing/Completed/Cancelled). Wants an overlap-safe index/constraint per resource on the time range.
- **MaintenanceRequest** — asset (→ Asset), raised-by (→ User), issue description, priority, photo, status (Pending/Approved/Rejected/Technician Assigned/In Progress/Resolved), technician, approver, resolved-at.
- **AuditCycle** — scope (department and/or location), date range, status (Open/Closed), closed-at.
- **AuditCycleAuditor** — join table, AuditCycle ↔ User.
- **AuditItem** — audit cycle (→ AuditCycle), asset (→ Asset), expected location, verification status (Verified/Missing/Damaged).
- **Notification** — per-user inbox row (already designed in an earlier planning pass): recipient, type, title, related entity, read-at, email-sent-at.
- **ActivityEvent** — reuse the template's existing model; extend `ActivityAction` with AssetFlow's action vocabulary (asset registered, allocated, transferred, returned, booking confirmed/cancelled, maintenance raised/approved/resolved, audit opened/closed, etc.).

---

## 8. Open Questions (need a decision before schema design)

Numbered for reference in follow-up conversations:

1. Can one employee simultaneously hold both Department Head and Asset Manager roles?
2. Is the "shared/bookable" flag mutually exclusive with individual allocation, or can one asset support both flows?
3. Does resolving a maintenance request return the asset to Available always, or to its prior holder if it was Allocated when the request was raised? (Directly contradicts the mockup's literal footnote if the answer is "prior holder.")
4. Is "Reserved" a status that lives on `Asset`, or only on `Booking`, with the asset itself staying "Available" throughout?
5. What does closing an audit cycle do to a confirmed-**Damaged** item (as opposed to Missing → Lost, which is explicit)? Auto-raise a maintenance request, or just tag it?
6. Are Lost/Retired/Disposed strictly terminal, or can an item be recovered from Lost back to Available?
7. Does role/permission scope cascade down a department hierarchy (e.g. can a parent department's Head see/approve for child departments), or is every department's scope flat regardless of `parentDepartmentId`?
8. What exactly are the two distinct "Available" KPI cards on the Dashboard (Screen 2) counting? (Likely "assets available" vs. "resources available," but the mockup doesn't label them differently enough to be certain.)
9. Should the Dashboard be role-scoped (an Employee sees only their own allocations/bookings; Admin/Asset Manager see org-wide), and if so, exactly which KPI cards change per role?
10. Who can cancel/reschedule a booking — only the original booker, or also a Department Head / Asset Manager acting on someone else's behalf?

---

## 9. Cross-References

- Notification system architecture (in-app inbox + nodemailer email for a curated subset + lazy sweep-on-read plus a scheduled cron sweep for overdue detection) was already decided in an earlier planning conversation this session — apply it to the three "time passes" triggers identified above (overdue allocations, overdue/no-show bookings, aging maintenance requests) rather than re-deciding it here.
- Backend design work on this project (schema, indexing, API contracts, caching, robustness) should go through the `.claude/skills/backend-design/` skill in this repo, which encodes `AGENTS.md`'s standards as an actionable checklist.
