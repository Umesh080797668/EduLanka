# ADR-002: Offline Sync Protocol — Monotonic Event-Sourced Architecture

- **Status:** Accepted
- **Date:** 2026-10-07 (Updated 2026-10-08)
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0 Spike B), Sprint 2 (P3-S2 Production Implementation)

---

## Context

Mobile users (teachers marking attendance, students submitting homework, users chatting) require offline operation without active connectivity. When connectivity resumes, local writes must synchronize with the backend without data corruption, sequence gaps, or cross-tenant leakage.

### Flaws in Naive Implementations:
1. **Missed Events via Postgres Identity Sequences:** Identity sequences assigned at `INSERT` commit out of order. If transaction 2 commits with sequence 11 before transaction 1 commits with sequence 10, a client querying `since=11` skips event 10 permanently.
2. **Attendance Overwrites:** "Higher server sequence wins" causes late-syncing teachers to overwrite newer roll-call edits.
3. **Global Idempotency Leak:** A global `client_uuid UNIQUE` constraint allows one tenant to collide with or block another school.

---

## Decision

We adopt an **Event-Sourced Architecture** with transactional sequence counters, per-tenant idempotency keys, and teacher timestamp conflict resolution. Full production schemas and REST endpoints are scheduled for **Sprint 2 (P3-S2)**; **Sprint 0** validates the protocol via a throwaway SQL prototype.

### 1. Architectural Implementation
1. **Transactional Monotonic Sequence Counter (Per-Tenant Advisory Locks):**
   - Every tenant maintains an isolated sequence counter in `tenant_sync_counters`.
   - To avoid foreign-key lock contention and deadlocks during concurrent school operations, sequence allocation utilizes transactional advisory locking:
     `PERFORM pg_advisory_xact_lock(hashtext('sync_counter_' || p_tenant_id::text));`
   - Atomically increments `last_sequence` within the isolated tenant lock, ensuring sequence order strictly mirrors commit order with zero gaps.
2. **Per-Tenant Idempotency Scoping:**
   - Idempotency is enforced by `UNIQUE (tenant_id, client_uuid)` on `public.sync_events`.
   - Re-transmissions safely return the existing `(sequence, id)` tuple without duplicating the event or interfering with other schools.
3. **Conflict Resolution Strategy & Attendance Storage:**
   - **Attendance Table (`public.attendance`):** Roll call attendance is persisted to `public.attendance` partitioned by `tenant_id`, with unique constraint `(tenant_id, class_id, student_id, date)`.
   - **Clock-Skew Clamping:** Device timestamp `marked_at` is validated and clamped to server time $[-5\text{ min}, +1\text{ min}]$ before comparison.
   - **Conflict Logging (`public.attendance_conflicts_log`):** When competing teacher edits occur, the newest clamped `marked_at` prevails, and conflicting versions are written to `attendance_conflicts_log` recording `client_marked_at`, `server_clamped_at`, and resolution status.
   - **Homework & Chat:** Scoped append-only event streams. Grades and student enrollment remain server-authoritative.
4. **Data Retention, 410 Resync Detection, and Snapshot Re-Hydration:**
   - **90-Day Retention Window:** Events older than 90 days are purged by database worker (`purge_old_sync_events()`).
   - **410 Gone / Resync Required Protocol:** When a device that has been offline $>90$ days requests `GET /api/v1/mobile/sync-events?since=N` where $N < \text{MIN}(\text{retained sequence})$, the server returns **HTTP 410 Gone** with `{ resyncRequired: true }`.
   - **Full Snapshot Endpoint (`GET /api/v1/mobile/snapshot`):** Upon receiving HTTP 410, devices call the snapshot endpoint to re-hydrate complete active tenant state (classes, subjects, student records, circulars, and policies) before resuming incremental streaming.
   - **User Account Erasure:** Deactivating or removing a user invokes `scrub_user_sync_events_pii()` to redact PII in matching event payloads (`{"redacted": true}`).

---

## Production Verification & Endpoints

The Phase 3 sync architecture is fully deployed across database migrations and API controllers:
- `POST /api/v1/mobile/sync-events` (Role-validated write stream with per-tenant idempotency and attendance conflict resolution)
- `GET /api/v1/mobile/sync-events?since=&limit=` (Monotonic paged sync stream with 410 retention detection and role-scoped delivery)
- `GET /api/v1/mobile/snapshot` (Complete snapshot re-hydration bundle)
- `public.sync_events`, `public.attendance`, `public.attendance_conflicts_log`, and `public.tenant_sync_counters` tables.
