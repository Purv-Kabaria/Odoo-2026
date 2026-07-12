# AssetFlow — 5-Minute Demo Script

A judge-facing walkthrough for a screen recording. Total runtime target: **5:00**. Don't linger on any single screen — the goal is breadth (every feature touched, every edge case shown once) over depth. Log in fresh for each role switch called out below; demo data is seeded via `pnpm db:reset:populate` (see README for the full credential table).

| Time | Screen | Show | Say |
| --- | --- | --- | --- |
| 0:00–0:15 | — | Nothing on screen yet, or the landing page | "AssetFlow is an enterprise asset-management app — register assets, allocate them, book shared resources, run maintenance, audit inventory, and report on all of it, behind real RBAC." |
| 0:15–0:45 | `/login` → `/assets` | Log in as `admin@assetflow.demo` / `Password123!`. Point out the role badge / nav changes. | "Four roles: Admin, Asset Manager, Department Head, Employee — every API route re-checks the role server-side, not just the UI." |
| 0:45–1:15 | Asset Directory (`/assets`) | Search by tag/name, filter by status, open one asset's detail page showing its allocation + maintenance history inline. | "Assets get an auto-generated tag, category-specific custom fields, and full history in one place. Search is Meilisearch with a Postgres fallback if it's down." |
| 1:15–1:55 | Allocation & Transfer (`/allocations`) | Allocate an available asset to an employee. **Edge case:** try to allocate an already-held asset — show the red conflict banner naming the current holder, then submit a transfer request instead of a raw error. Approve it as a Department Head or Asset Manager. | "Double-allocation isn't just blocked in the UI — there's a partial-unique index in Postgres backing it, so it can't happen even under a race." |
| 1:55–2:30 | Resource Booking (`/bookings`) | Book a bookable resource on the day timeline. **Edge case:** attempt an overlapping slot — show the live conflict preview before submit, then book back-to-back (should succeed — half-open interval). | "Overlap is enforced by a GiST exclusion constraint at the database level, not just an app-side check — the API is the belt, the DB is the suspenders." |
| 2:30–3:15 | Maintenance Kanban (`/maintenance`) | Raise a request (mention the mic button — dictate the issue description live, or note it works if the browser prompts for mic access). Drag a card Pending → Approved. Approve → assign a technician → progress → resolve. Point out the AI-flagged card and click "Verify & Retire." | "Resolving fires a non-blocking LLM call that looks at acquisition cost and maintenance history and flags assets not worth repairing. A manager reviews the reasoning and retires with one click — the asset is globally retired, not just this one ticket." |
| 3:15–3:40 | Maintenance again, or Allocation return flow | Show the Condition Notes field with voice dictation on the asset-return modal. | "Voice input is a reusable component — same hook and button power both this and the maintenance description, and it degrades gracefully with a toast if the browser doesn't support the Web Speech API or the mic is denied." |
| 3:40–4:10 | Audit Cycles (`/audit`) | Open the one seeded closed cycle — show the discrepancy report (a DAMAGED item that auto-raised a maintenance request). Briefly show creating/scoping a new cycle to a department. | "Audits verify assets against their expected holder or location; anything missing or damaged gets flagged, and a damaged item automatically raises a maintenance ticket — no manual handoff." |
| 4:10–4:40 | Reports (`/reports`) | Show the KPI tiles, utilization-by-department chart, and the compact-by-default tables — click the chevron to expand one. Export a CSV. | "Tables default to compact, Vercel-dashboard style — click the arrow to expand. Every report is Redis-cached for 60 seconds and exports to CSV regardless of the collapsed/expanded state." |
| 4:40–5:00 | Notifications bell (any screen) | Trigger an action that fires a notification (e.g. approve something as a different role in another tab, or just open the bell) and show it arriving live. | "Notifications push over server-sent events backed by Redis pub/sub, with a durable Postgres row so nothing's lost if you weren't online when it fired. That's the whole app — thanks for watching." |

## Edge cases worth calling out verbally if time allows (skip if tight)

- **Pending approval**: a self-signed-up user can't log in until an Admin approves them — the login error message says so explicitly, not a generic "invalid credentials."
- **Illegal Kanban drag**: dragging a card backwards or skipping a stage is rejected client-side with a toast and the card snaps back — the drag only ever calls a legal transition endpoint.
- **Booking overlap**: shown above — this is the single most impressive "the database, not just the app, prevents this" moment, worth the extra 5 seconds if you have them.
- **Unsupported browser for voice input**: if recording in a browser without `SpeechRecognition` support, the mic button is visibly disabled with a tooltip rather than silently doing nothing.

## Recording tips

- Use a light-mode and dark-mode pass if you have 2 takes in you — the toggle is in the navbar — but pick ONE for the actual 5-minute submission to stay on time.
- Keep the browser at a standard laptop width (~1440px) for the main walkthrough; a 10-second mobile-width cutaway on the Maintenance Kanban (resize to ~390px) is a good way to prove the responsive claim without a second full pass.
- Narrate over actions rather than pausing dead air — the table above is paced assuming continuous talking.
