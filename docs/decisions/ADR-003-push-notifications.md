# ADR-003: Push Notifications and Silent Sync Architecture (FCM)

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 4 (P3-S4), Sprint 8 (P3-S8)

---

## Context

Mobile devices in EduLanka require push notification capabilities for three distinct scenarios:
1. **Interactive User Notifications:** New chat messages, homework assignments posted, urgent school notices.
2. **Disaster Readiness Silent Trigger (P3-S8):** When a school admin or Super Admin activates Disaster Mode, all enrolled student/parent devices must be silently instructed in the background to pre-download the Disaster Pack (offline materials, notices, emergency contacts) before connectivity drops.
3. **Background Sync Invalidation (P3-S2):** Notifying a dormant app that new high-priority tenant events exist in `sync_events`.

---

## Decision

We adopt **Firebase Cloud Messaging (FCM) HTTP v1 API** coupled with the `firebase_messaging` Flutter package.

### 1. Device Token Registration

A new centralized `device_tokens` table in PostgreSQL manages FCM tokens per user and tenant:

```sql
CREATE TABLE public.device_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,
    platform        TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_model    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens (tenant_id, user_id) WHERE is_active = TRUE;
```

### 2. Silent vs Visual Push Strategy

| Notification Type | Payload Configuration | Behavior on Client |
|---|---|---|
| **Disaster Trigger (Silent)** | `content_available: true`, `priority: "high"`, **NO** `notification` object, custom data: `{"type": "DISASTER_MODE_ACTIVATED", "tenant_id": "..."}` | Background handler wakes up, initiates silent download of Disaster Pack manifest into encrypted local storage. Zero annoying popups during background refresh. |
| **Urgent School Notice** | Contains `notification: { title, body }` + data payload. | Displays system banner even if app is terminated; tapping deep-links to Notice details. |
| **Chat Message** | Contains `notification` + `{"type": "CHAT", "conversation_id": "..."}`. | Dispatches local notification if user is not currently in the active conversation screen. |

### 3. Token Lifecycle & Hygiene

- When a user logs in on mobile, the FCM token is refreshed and upserted via `POST /api/v1/mobile/device-token`.
- When a user logs out, the token is deactivated (`is_active = FALSE`).
- If FCM returns `UNREGISTERED` or `INVALID_ARGUMENT`, the backend marks the token inactive immediately to prevent delivery degradation.
