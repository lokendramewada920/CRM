# Arts of Finance — Lead & Admission Management System (PRD)

## Original problem statement
Build a Lead & Admission Management System for Arts of Finance (finance training institute in India). Reception fills a walk-in Visit Form, system auto-assigns counsellors round-robin, sends WhatsApp click-to-chat messages (wa.me — no API), applies a same-day 10% offer (registration ₹1000 default, expires 23:59 visit day), generates Razorpay payment links (test mode, polling every 45s since no webhooks reach localhost), creates PDF receipts, tracks status through New→Contacted→Interested→Registered/Lost, has RBAC (Admin/Counsellor/Reception + editable permission matrix), duplicate-detection by phone, audit log, follow-ups, soft-delete trash, admin reports, daily automatic backup. Runs on localhost + office LAN.

## Chosen stack
React + FastAPI + MongoDB (deviating from Next.js/Prisma/SQLite because Emergent platform is configured for it — same monolithic simplicity, mobile-friendly, hot-reload).

## Personas
- **Reception** — walk-in intake only; single-page big-touch form.
- **Counsellor** — My Leads dashboard, lead detail, WhatsApp send, payment link, notes, follow-ups.
- **Admin** — full access: dashboard/reports, all leads, users, permission matrix, courses, templates, offer settings, payments, audit, trash, backup.

## Implemented (Phase 1–4, Feb 2026)- Argon2 password hashing, JWT auth, slowapi login rate-limit
- Role-based permission matrix stored in DB (`roles` coll + per-user overrides/revokes), server-enforced via `require_permission`
- Seed: 1 admin, 2 counsellors, 1 reception, 3 courses, default WhatsApp template, settings singleton
- Leads CRUD with round-robin counsellor assignment, duplicate-phone check, soft-delete + restore
- Notes, Follow-ups (with "my pending" endpoint)
- Templates with variable substitution + WhatsApp `wa.me` link builder; message log
- Razorpay Payment Links provider (with MockProvider fallback when keys missing), APScheduler polling every 45s + manual poll button, PDF receipt via reportlab
- Admin dashboard KPIs (visits today/week/month, conversion %, revenue) + counsellor performance chart
- CSV export, audit log, trash, daily Mongo → JSON backup (last 30 kept)
- Reception WhatsApp send is gated by an admin toggle; counsellors can be given "view all" via toggle

- **Bulk & manual (Jun 2026):** Bulk lead import via Excel/CSV — `POST /api/leads/bulk-upload` (openpyxl for .xlsx, csv for .csv), matches course by name, skips rows without phone + duplicate phones, tags `entry_mode="bulk"`. UI: "Upload Excel" dialog with sample-CSV download + import summary. Manual "Add Lead" now needs only phone (name falls back to phone; course/consent optional). Visited page = strictly `entry_mode=="visit_form"`; bulk/manual leads appear only under All Leads.
- **Refinements (Jun 2026):** Reception Visit Form no longer picks a counsellor (auto round-robin); added "When do they want to join?" (Within 1-2 days / a week / 15 days / Not sure → `join_timeline`). Lead statuses expanded: New, Contacted, Visited, Interested, Possible Joining, Future Joining, Registered, Lost (shared `lib/statuses.js` + slugified CSS badge classes). Leads now carry `entry_mode` (visit_form|manual). Visited page shows only form-filled leads (`form_leads`) with a status filter + search; dashboard gained a separate **All Leads** section (`all_leads`). Counsellor dashboard has a one-tap **Aaj ka Plan** (Today's Plan) dialog listing today's + overdue calls/WhatsApps.

## Follow-up Module add-on (Jun 2026)
- **Phase A (done):** `lead_updates` collection (discussion timeline). New perms `followup.add_own`, `followup.view_all`, `lead.assign`. Lead gains `next_followup_date` (YYYY-MM-DD, IST) + `next_followup_time`. Endpoints: `POST /api/leads/{lid}/updates` (validates: next date required unless Registered/Lost; Lost needs reason; updates lead status & next date), `DELETE /api/updates/{uid}` (admin only). LeadDetail inline "Add Follow-up Update" form + latest-first timeline; admin-only delete.
- **Visited page (done):** Dedicated `/visited` route + sidebar nav item for both admin (in Dashboard/Payments/Courses line) and counsellor (below My Leads). Shows all visited/manually-added enquiries with search + per-row Call/WhatsApp/Add Update + Add Lead Manually. `FollowupDashboard` now takes `variant="followups"|"visited"`; dashboard shows only day-wise sections.
- **Phase B (done):** Redesigned dashboard via shared `components/FollowupDashboard.jsx`. Sections: Aaj/Today, Kal/Tomorrow, Overdue (red), No-date. Visited list moved to its own page. Per-lead Call (tel:), WhatsApp (template picker → wa.me + message log), Add Update. "Add Lead Manually" dialog (counsellor self-assigns; admin can pick counsellor + round-robin). Counsellor now has `lead.create`. Admin dashboard = same sections + counsellor filter + counsellor names, with KPIs/chart below. Endpoint `GET /api/dashboard/followups?counsellor_id=` buckets by IST calendar day. Demo follow-up leads seeded (idempotent, `demo:true`). Frontend E2E tested 100% (iteration_1.json).
- **Phase C (pending):** Lead assignment/reassignment from lead page + bulk-assign from All Leads list; assignment history in timeline + audit log; unassigned leads visible only to Admin.

## Backlog (not yet built)
- P1: Real Razorpay webhook endpoint with signature verification (code structured behind provider interface — ready to slot in)
- P1: In-app "New Lead alert" real-time toast to counsellor (currently must refresh)
- P2: Email receipts, SMS notifications
- P2: Bulk WhatsApp campaign UI for admin (one-by-one sends already possible)
- P2: Timeline view combining notes + status changes + messages in one column
