# ADR-002: Offline Sync Protocol — Event-Sourced Push Architecture

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 2 (P3-S2)

---

## Context

Mobile users (teachers marking attendance, students submitting homework, users chatting) require seamless operation without internet connectivity. When connectivity returns, local writes must synchronize with the backend without data corruption or cross-tenant leakage.

Initially, a timestamp delta polling mechanism (`?since=updated_at`) was considered. However, evaluating long-term roadmap requirements (Phase 4 AI personalized feedback, Phase 5 ML dropout prediction models, and Phase 6 National Ministry analytics rollups) surfaced major deficiencies with timestamp-based synchronization:
1. **Clock skew:** Discrepancies between device clocks, NTP server drift, and database transactions cause silent update drops.
2. **Deletions / Tombstones:** Timestamp polling requires explicit soft-delete columns on every table, complicating RLS policies.
3. **Auditability & Replayability:** Future AI and analytics engines cannot reconstruct the chronological sequence of actions from mutable state tables.
4. **Concurrent Writers:** Two teachers updating attendance records for the same class concurrently produce indeterminate overwrites.

---

## Decision

We adopt an **Event-Sourced Push Architecture** as the primary synchronization foundation for EduLanka.

### 1. The Immutable Event Stream (`sync_events`)

Every write to a synchronized entity produces an immutable event record in a server-side `sync_events` table:

```sql
CREATE TABLE public.sync_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL,        -- 'attendance', 'homework_submission', 'chat_message'
    entity_id       TEXT NOT NULL,        -- target row ID (UUID or text-compatible identifier)
    event_type      TEXT NOT NULL,        -- 'CREATED' | 'UPDATED' | 'DELETED'
    payload         JSONB NOT NULL,       -- complete entity snapshot at event emission
    client_uuid     TEXT UNIQUE,          -- client-generated idempotency key (UUIDv4)
    sequence        BIGINT GENERATED ALWAYS AS IDENTITY, -- strictly monotonic sequence
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sync_events_tenant_seq ON public.sync_events (tenant_id, sequence);
CREATE INDEX idx_sync_events_entity ON public.sync_events (tenant_id, entity_type, sequence);
```

### 2. Client Cursor & Catch-up Protocol

- The mobile app (via **Drift**) tracks the `last_synced_sequence` per tenant in a local metadata table.
- **Client Pull / Catch-up (`GET /api/v1/sync/events?since=<sequence>`):**
  - Mobile requests events where `sequence > last_synced_sequence`.
  - Server streams events ordered by `sequence ASC`.
  - Drift transaction updates local SQLite tables and advances the local cursor atomically.
- **Real-Time Push (SSE / Supabase Realtime / WebSocket):**
  - When online, the server pushes new `sync_events` directly to connected clients in real time.
  - If a connection drops, reconnecting simply polls `since=last_synced_sequence` to backfill missed events.

### 3. Client Write Pipeline & Idempotency

When a client creates or modifies data offline:
1. **Local Outbox:** The write is committed to the local Drift database along with an entry in the local `outbox` table, tagged with a unique `client_uuid` (generated via `Uuid().v4()`).
2. **Sync Push (`POST /api/v1/sync/push`):**
   - When online, the client pushes un-synced outbox items in batches.
   - The server validates the caller's JWT tenant context (`caller.tenantId`).
   - Using PostgreSQL's `ON CONFLICT (client_uuid) DO NOTHING`, duplicate push attempts (due to network timeout or retry) are discarded without re-processing or duplicate event creation.
3. Once the server responds with HTTP 200/201 and the newly assigned `sequence`, the client clears the item from the local outbox.

---

## Conflict Resolution Strategy Matrix

| Entity | Resolution Strategy | Implementation Details |
|---|---|---|
| **Attendance** | Last-Write-Wins by Server `sequence` | Attendance records are uniquely keyed by `(tenant_id, student_id, date, period)`. If multiple devices upload conflicting records, the higher server-assigned `sequence` wins. All previous versions remain replayable in `sync_events`. |
| **Homework Submissions** | Append-Only with Versioning | Submissions cannot be overwritten destructively. A re-submission creates a new submission record linked to `homework_id` with an incremented revision number. |
| **Chat Messages** | Append-Only Ordered by `sequence` | Messages are immutable once written. Local messages are displayed optimistically with status `SENDING` until the server emits the persisted event with its official `sequence`. |
| **Grades / Marks** | **Server-Authoritative Only** | Grades and exam marks are **read-only on mobile in Phase 3**. Editing is restricted to authenticated web portal sessions to guarantee audit compliance. |

---

## Benefits for Future Phases

- **Phase 4 (AI Tutor):** The AI engine reads the chronological event stream to track student learning progression and pinpoint exact moments of struggle.
- **Phase 5 (ML Early-Warning System):** Predictive models require timeseries data of student attendance patterns and homework submission velocity, directly queryable from `sync_events`.
- **Phase 6 (Ministry Analytics):** Multi-tenant event streaming can be fanned out to ClickHouse or BigQuery without ETL polling or database locks.
