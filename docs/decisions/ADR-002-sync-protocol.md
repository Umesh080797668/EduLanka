# ADR-002: Offline Sync Protocol — Event-Sourced Push Architecture

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 2 (P3-S2)

---

## Context

Mobile users (teachers marking attendance, students submitting homework, users chatting) require seamless operation without internet connectivity. When connectivity returns, local writes must synchronize with the backend without data corruption, sequence gaps, or cross-tenant leakage.

### Flaws in Naive Implementations:
1. **Missed Events via Postgres Identity Sequences:** If `sequence` is an identity column assigned at `INSERT`, concurrent transactions can commit out of order (e.g. Tx 1 gets sequence 10, Tx 2 gets sequence 11; Tx 2 commits first; a client pulls `since=11` and skips event 10 permanently).
2. **Attendance Conflict Flaw:** Using "higher server sequence wins" means a teacher who syncs late always overwrites newer records from another teacher.
3. **Global Idempotency Leak:** `client_uuid TEXT UNIQUE` globally across all tenants allows one tenant's idempotency key to collide or cause denial of service with another tenant.
4. **PII in Immutable Logs:** Storing raw student PII indefinitely in an append-only event stream conflicts with privacy regulations and school data erasure requests.
5. **Entity Key Data Type:** Using `TEXT` allows malformed strings to trigger database-level cast failures.

---

## Decision

We adopt an **Event-Sourced Push Architecture** with transactional sequence counters, teacher timestamp conflict resolution, per-tenant idempotency, and strict data retention rules.

### 1. Database Schema (`tenant_sync_counters` & `sync_events`)

```sql
-- 1. Per-Tenant Monotonic Sequence Counter (Prevents Commit Race Condition)
CREATE TABLE public.tenant_sync_counters (
    tenant_id       UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    last_sequence   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sync Events Table
CREATE TABLE public.sync_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL,                                              -- 'attendance', 'homework_submission', 'chat_message'
    entity_id       UUID NOT NULL,                                              -- Strict UUID
    event_type      TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'DELETED')),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_uuid     TEXT NOT NULL,                                              -- Client idempotency key (UUIDv4)
    sequence        BIGINT NOT NULL,                                            -- Monotonically allocated per tenant
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, client_uuid)                                             -- Unique PER TENANT
);

CREATE INDEX idx_sync_events_tenant_seq ON public.sync_events (tenant_id, sequence);
CREATE INDEX idx_sync_events_entity ON public.sync_events (tenant_id, entity_type, sequence);
```

### 2. Transactional Sequence Assignment (No Silent Drops)

To guarantee that sequence numbers strictly mirror commit order without gaps:
Every write transaction acquires a row lock on the tenant's counter:

```sql
WITH next_seq AS (
    UPDATE public.tenant_sync_counters
    SET last_sequence = last_sequence + 1, updated_at = NOW()
    WHERE tenant_id = $tenant_id
    RETURNING last_sequence
)
INSERT INTO public.sync_events (
    tenant_id, entity_type, entity_id, event_type, payload, client_uuid, sequence
)
SELECT $tenant_id, $entity_type, $entity_id, $event_type, $payload, $client_uuid, next_seq.last_sequence
FROM next_seq
ON CONFLICT (tenant_id, client_uuid) DO UPDATE
    SET tenant_id = EXCLUDED.tenant_id -- no-op update to return existing row
RETURNING sequence, id;
```

If a client re-submits a duplicate `client_uuid` (due to network timeout), the query returns the existing event's `sequence` and `id`, enabling the client to clear its local outbox safely.

### 3. Conflict Resolution Strategy Matrix

| Entity | Resolution Strategy | Conflict Rule & Skew Clamping |
|---|---|---|
| **Attendance** | Latest Teacher `marked_at` (clamped) | Compare the device timestamp `marked_at` when the teacher took roll. Device clock skew is clamped to `[server_time - 5min, server_time + 1min]`. The record with the newer clamped `marked_at` wins. All conflicting revisions are recorded in `attendance_conflicts_log` for administrative audit. |
| **Homework Submissions** | Append-Only with Versioning | Each submission creates a new submission record with `version = version + 1`. Destructive overwrites are disallowed. |
| **Chat Messages** | Append-Only by Sequence | Messages are immutable once written. Local messages render optimistically with status `SENDING` until the server event sequence confirms persistence. |
| **Grades / Marks** | Server-Authoritative Only | Read-only on mobile; edits require authenticated web portal sessions. |

### 4. PII Retention & Scrubbing Rule

1. **Reference-First Payloads:** `payload` stores entity references (`student_id`, `class_id`, `status`, `marked_at`) rather than wide denormalized PII (such as student full name, parent contact numbers, address).
2. **90-Day Event Log Retention:** An automated database worker purges `sync_events` older than 90 days. Active clients sync daily/weekly; devices offline longer than 90 days perform a clean snapshot re-hydration from primary entity tables.
3. **GDPR / Privacy Scrubbing:** When a student account is deleted or deactivated with data erasure, an administrative RPC scrubs all matching `entity_id` payloads in `sync_events` replacing payload content with `{"redacted": true}`.

---

## Consequences

### Positive
- Zero missed sync events: strict monotonic per-tenant sequences allocated under row locks guarantee sequence order equals commit order.
- Attendance edits from late-syncing devices cannot overwrite more recent teacher updates.
- Per-tenant `client_uuid` scoping prevents cross-tenant idempotency collisions.
- Compliant with student data protection policies through payload minimization and 90-day retention rules.

### Trade-offs
- High-concurrency writes for a single tenant serialize at the `tenant_sync_counters` row lock. For school environments (tens of writes per second during attendance roll call), this serialization latency is negligible (< 2 ms).
