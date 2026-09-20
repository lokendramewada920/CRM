# Arts of Finance — Lead & Admission Management System (PRD)

## Original problem statement
Build a Lead & Admission Management System for Arts of Finance (finance training institute in India). Reception fills a walk-in Visit Form, system auto-assigns counsellors round-robin, sends WhatsApp click-to-chat messages (wa.me — no API), applies a same-day 10% offer (registration ₹1000 default, expires 23:59 visit day), generates Razorpay payment links (test mode, polling every 45s since no webhooks reach localhost), creates PDF receipts, tracks status through New→Contacted→Interested→Registered/Lost, has RBAC (Admin/Counsellor/Reception + editable permission matrix), duplicate-detection by phone, audit log, follow-ups, soft-delete trash, admin reports, daily automatic backup. Runs on localhost + office LAN.

## Chosen stack
React + FastAPI + MongoDB (deviating from Next.js/Prisma/SQLite because Emergent platform is configured for it — same monolithic simplicity, mobile-friendly, hot-reload).

## Personas
- **Reception** — walk-in intake only; single-page big-touch form.
- **Counsellor** — My Leads dashboard, lead detail, WhatsApp send, payment link, notes, follow-ups.
- **Admin** — full access: dashboard/reports, all leads, users, permission matrix, courses, templates, offer settings, payments, audit, trash, backup.

## Implemented (Phase 1–4, Feb 2026)
- Argon2 password hashing, JWT auth, slowapi login rate-limit
- Role-based permission matrix stored in DB (`roles` coll + per-user overrides/revokes), server-enforced via `require_permission`
- Seed: 1 admin, 2 counsellors, 1 reception, 3 courses, default WhatsApp template, settings singleton
- Leads CRUD with round-robin counsellor assignment, duplicate-phone check, soft-delete + restore
- Notes, Follow-ups (with "my pending" endpoint)
- Templates with variable substitution + WhatsApp `wa.me` link builder; message log
- Razorpay Payment Links provider (with MockProvider fallback when keys missing), APScheduler polling every 45s + manual poll button, PDF receipt via reportlab
- Admin dashboard KPIs (visits today/week/month, conversion %, revenue) + counsellor performance chart
- CSV export, audit log, trash, daily Mongo → JSON backup (last 30 kept)
- Reception WhatsApp send is gated by an admin toggle; counsellors can be given "view all" via toggle

## Backlog (not yet built)
- P1: Real Razorpay webhook endpoint with signature verification (code structured behind provider interface — ready to slot in)
- P1: In-app "New Lead alert" real-time toast to counsellor (currently must refresh)
- P2: Email receipts, SMS notifications
- P2: Bulk WhatsApp campaign UI for admin (one-by-one sends already possible)
- P2: Timeline view combining notes + status changes + messages in one column
