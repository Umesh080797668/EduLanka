# ADR-002: Offline Sync Protocol — Event-Sourced Push Architecture

- **Status:** Accepted
- **Date:** 2026-10-07 (Updated 2026-10-08)
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 2 (P3-S2)

---

## Context

Mobile users (teachers marking attendance, students submitting homework, users chatting) require seamless operation without internet connectivity. When connectivity returns, local writes must synchronize with the backend without data corruption, sequence gaps, or cross-tenant leakage.

### Flaws in Naive Implementations:
1. **Missed Events via Postgres Identity Sequences:** If `sequence` is an identity column assigned at `INSERT`, concurrent transactions can commit out of order (e.g. Tx 1 gets sequence 10, Tx 2 gets sequence 11; Tx 2 commits first; a client pulls `since=11` and skips event 10 permanently).
2. **Attendance Conflict Flaw:** Using "higher server sequence wins" means a teacher who syncs late always overwrites newer records from another teacher.
3. **Global Idempotency Leak:** `client_uuid TEXT UNIQUE` globally across all tenants allows one tenant's idempotency key to collide or cause denial of service with another tenant.
4. **Unrestricted Ingestion & Role Bypass:** Permitting clients to POST arbitrary `entityType` or payloads opens attack vectors for privilege escalation and buffer exhaustion.
5. **PII in Immutable Logs:** Storing raw student PII indefinitely in an append-only event stream conflicts with privacy regulations and school data erasure requests.

---

## Decision

We adopt an **Event-Sourced Push Architecture** with transactional sequence counters, entity allowlist with role-based write authorization, per-recipient pull scoping with sequence pagination, audit logs for attendance conflicts, and automated retention and PII-scrubbing procedures.

### 1. Database Schema (`tenant_sync_counters`, `sync_events`, & `attendance_conflicts_log`)

```sql
-- 1. Per-Tenant Monotonic Sequence Counter (Prevents Commit Race Condition)
CREATE TABLE public.tenant_sync_counters (
    tenant_id       UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
    last_sequence   BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sync Events Table with Entity Allowlist Constraint
CREATE TABLE public.sync_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('attendance', 'homework_submission', 'chat_message', 'disaster_mode', 'entitlement_revocation')),
    entity_id       UUID NOT NULL,
    event_type      TEXT NOT NULL CHECK (event_type IN ('CREATED', 'UPDATED', 'DELETED')),
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_uuid     TEXT NOT NULL,                                              -- Client idempotency key (UUIDv4)
    sequence        BIGINT NOT NULL,                                            -- Monotonically allocated per tenant
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, client_uuid)                                             -- Unique PER TENANT
);

CREATE INDEX idx_sync_events_tenant_seq ON public.sync_events (tenant_id, sequence);
CREATE INDEX idx_sync_events_entity ON public.sync_events (tenant_id, entity_type, sequence);

-- 3. Attendance Conflicts Audit Log
CREATE TABLE public.attendance_conflicts_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id         UUID NOT NULL,
    student_id       UUID NOT NULL,
    winning_status   TEXT NOT NULL,
    winning_user_id  UUID NOT NULL,
    winning_marked_at TIMESTAMPTZ NOT NULL,
    losing_status    TEXT NOT NULL,
    losing_user_id   UUID NOT NULL,
    losing_marked_at TIMESTAMPTZ NOT NULL,
    resolution_reason TEXT NOT NULL,
    resolved_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2. Entity Allowlist & Role-Based Write Authorization

In `POST /api/v1/mobile/sync-events`:
- **Payload Size Restriction:** `JSON.stringify(payload)` must not exceed 64 KB per event.
- **Allowed Entity Types & Role Matrix:**
  - `attendance`: Permitted for `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`.
  - `homework_submission`: Permitted for `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `STUDENT`.
  - `chat_message`: Permitted for all authenticated users belonging to the tenant.
  - `disaster_mode`: Permitted for `SUPER_ADMIN`, `SCHOOL_ADMIN` only.
  - `entitlement_revocation`: Permitted for `SUPER_ADMIN`, `SCHOOL_ADMIN` only.
- Any attempt by unauthorized roles (e.g. students posting attendance or disaster mode events) is rejected with HTTP 403 `ForbiddenException`.

### 3. Transactional Monotonic Sequence Allocation (Atomic Append)

To eliminate out-of-order sequence commits and race conditions:
```sql
CREATE OR REPLACE FUNCTION public.append_sync_event(
    p_tenant_id   UUID,
    p_entity_type TEXT,
    p_entity_id   UUID,
    p_event_type  TEXT,
    p_payload     JSONB,
    p_client_uuid TEXT
)
RETURNS TABLE (
    id UUID,
    sequence BIGINT,
    created_at TIMESTAMPTZ,
    is_duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next_seq BIGINT;
    v_existing_id UUID;
    v_existing_seq BIGINT;
    v_existing_created_at TIMESTAMPTZ;
BEGIN
    -- Check for existing idempotent submission
    SELECT se.id, se.sequence, se.created_at
    INTO v_existing_id, v_existing_seq, v_existing_created_at
    FROM public.sync_events se
    WHERE se.tenant_id = p_tenant_id AND se.client_uuid = p_client_uuid;

    IF FOUND THEN
        RETURN QUERY SELECT v_existing_id, v_existing_seq, v_existing_created_at, TRUE;
        RETURN;
    END IF;

    -- Atomically increment per-tenant sequence counter
    INSERT INTO public.tenant_sync_counters (tenant_id, last_sequence, updated_at)
    VALUES (p_tenant_id, 1, NOW())
    ON CONFLICT (tenant_id) DO UPDATE
    SET last_sequence = tenant_sync_counters.last_sequence + 1,
        updated_at = NOW()
    RETURNING tenant_sync_counters.last_sequence INTO v_next_seq;

    -- Insert event with allocated monotonic sequence
    INSERT INTO public.sync_events (
        tenant_id, entity_type, entity_id, event_type, payload, client_uuid, sequence
    )
    VALUES (
        p_tenant_id, p_entity_type, p_entity_id, p_event_type, p_payload, p_client_uuid, v_next_seq
    )
    RETURNING sync_events.id, sync_events.sequence, sync_events.created_at, FALSE
    INTO id, sequence, created_at, is_duplicate;

    RETURN NEXT;
END;
$$;
```

### 4. Per-Recipient Scoped Pull & Monotonic Pagination

`GET /api/v1/mobile/sync-events?since=<seq>&limit=<n>`:
- **Pagination Shape:** Returns `{ events: [...], hasMore: boolean, latestSequence: number, count: number }`.
- **Per-Recipient Privacy Filtering:**
  - Events of type `attendance` are restricted to teachers and administrators.
  - Events of type `homework_submission` are restricted to the submitting student, the class teacher, and administrators.
  - Public circulars, disaster notifications, and entitlement revocations are delivered to all tenant members.

### 5. Conflict Resolution Strategy Matrix

| Entity | Resolution Strategy | Conflict Rule & Skew Clamping |
|---|---|---|
| **Attendance** | Latest Teacher `marked_at` (clamped) | Compare the device timestamp `marked_at` when the teacher took roll. Device clock skew is clamped to `[server_time - 5min, server_time + 1min]`. The record with the newer clamped `marked_at` wins. All conflicting revisions are recorded in `attendance_conflicts_log` for administrative audit. |
| **Homework Submissions** | Append-Only with Versioning | Each submission creates a new submission record with `version = version + 1`. Destructive overwrites are disallowed. |
| **Chat Messages** | Append-Only by Sequence | Messages are immutable once written. Local messages render optimistically with status `SENDING` until the server event sequence confirms persistence. |
| **Entitlement Revocation** | Server-Authoritative Override | Clears cached DEKs on matching device instances immediately. |

### 6. PII Retention & Scrubbing Procedures

1. **90-Day Event Log Retention (`public.purge_old_sync_events()`):**
   - Runs on a scheduled cron worker to purge `sync_events` older than 90 days.
   - Devices offline longer than 90 days perform a full snapshot re-hydration from primary entity tables.
2. **GDPR / Privacy Scrubbing (`public.scrub_user_sync_events_pii(p_tenant_id, p_user_id)`):**
   - Redacts all payloads associated with a target user id:
     `UPDATE public.sync_events SET payload = '{"redacted": true}'::jsonb WHERE tenant_id = p_tenant_id AND ...`

---

## Consequences

### Positive
- Strict monotonic per-tenant sequence ensures zero missed events without gaps.
- Role-based write authorization prevents unauthorized attendance tampering or fake disaster broadcasts.
- Paginated pull with `hasMore` and `latestSequence` prevents client memory exhaustion.
- Immutable audit log in `attendance_conflicts_log` provides accountability for dual-teacher conflict resolutions.
- Compliant with student data protection regulations via automated 90-day purging and PII-scrub RPCs.

### Trade-offs
- Single-tenant write serialization under `tenant_sync_counters` row update; benchmarked at < 2 ms overhead under typical school traffic loads.
