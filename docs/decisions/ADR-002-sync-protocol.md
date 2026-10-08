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

### 1. Architectural Decisions (Sprint 0 Validation)
1. **Transactional Monotonic Sequence Counter:**
   - Every tenant maintains an isolated sequence counter in `tenant_sync_counters`.
   - Each event write atomically increments the tenant's counter under an exclusive row lock (`INSERT ... ON CONFLICT (tenant_id) DO UPDATE SET last_sequence = last_sequence + 1`).
   - Monotonic allocation under transaction locks guarantees sequence order strictly mirrors commit order with zero gaps.
2. **Per-Tenant Idempotency Scoping:**
   - Idempotency is enforced by `UNIQUE (tenant_id, client_uuid)`.
   - Re-transmissions return the existing `(sequence, id)` tuple without duplicating the event or blocking other schools.
3. **Conflict Resolution Strategy:**
   - **Attendance:** Latest teacher device timestamp `marked_at`, with clock skew clamped to server time $[-5\text{ min}, +1\text{ min}]$. Revisions are logged to `attendance_conflicts_log`.
   - **Homework & Chat:** Append-only event streams. Grades remain server-authoritative.
4. **Data Privacy & Lifecycle:**
   - Payloads store foreign key entity references rather than wide student PII.
   - 90-day retention window: Events older than 90 days are purged by an automated database worker (`purge_old_sync_events()`). Devices offline $>90$ days perform a full snapshot re-hydration.
   - User account erasure replaces matching event payloads with `{"redacted": true}` (`scrub_user_sync_events_pii()`).

---

## Sprint 2 Roadmap (P3-S2 Implementation)

The production migration (`sync_events`, `attendance_conflicts_log`) and REST synchronization endpoints (`POST /mobile/sync-events`, `GET /mobile/sync-events?since=&limit=`) are scheduled for rollout in **Sprint 2 (P3-S2)**. Sprint 0 successfully proves gapless ordering and per-tenant idempotency on the target PostgreSQL database.
