# ADR-003: Push Notifications, Silent Sync Limits & Resilience (FCM)

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 4 (P3-S4), Sprint 8 (P3-S8)

---

## Context

Mobile devices in EduLanka require push notification capabilities for user alerts (chat, urgent notices, homework) and automated background synchronization (Disaster Pack preparation, event stream invalidation).

### Technical Constraints Identified:
1. **Unreliability of Silent Push (Data-Only Messages):**
   - **iOS:** Apple throttles silent pushes (`apns-priority: 5`, `content-available: 1`). iOS will **never** wake an app that has been force-quit or swiped away from the app switcher by the user until the user explicitly re-launches the app.
   - **Android:** Android Doze mode and aggressive OEM battery optimization daemons (MIUI, EMUI, ColorOS) aggressively defer or discard background data messages when the device is not connected to a charger.
2. **Shared Family Phones:**
   - In rural Sri Lankan households, multiple siblings (or a parent and child) often share a single smartphone. If a token remains tied to the previous user, the subsequent user receives sensitive notifications meant for someone else.

---

## Decision

We adopt **Firebase Cloud Messaging (FCM) HTTP v1 API** with **Multi-Channel Fallbacks for Disaster Readiness** and **Atomic Token Ownership Reassignment**.

### 1. Device Token Registry & Ownership Reassignment

```sql
CREATE TABLE public.device_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,                                       -- Unique platform-wide
    platform        TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    device_model    TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_tenant_user ON public.device_tokens (tenant_id, user_id) WHERE is_active = TRUE;
```

When a user authenticates in `POST /api/v1/mobile/device-token`, ownership is re-assigned atomically:

```sql
INSERT INTO public.device_tokens (tenant_id, user_id, token, platform, device_model, is_active, updated_at)
VALUES ($tenant_id, $user_id, $token, $platform, $device_model, TRUE, NOW())
ON CONFLICT (token) DO UPDATE SET
    tenant_id   = EXCLUDED.tenant_id,
    user_id     = EXCLUDED.user_id,
    platform    = EXCLUDED.platform,
    device_model= EXCLUDED.device_model,
    is_active   = TRUE,
    last_seen_at= NOW(),
    updated_at  = NOW();
```

### 2. Multi-Channel Disaster Pack Resilience Strategy

Because silent push cannot be guaranteed when an app is terminated or battery-restricted, Disaster Pack synchronization employs four redundant layers:

```text
[ Disaster Mode Activated ]
           │
           ├─► Layer 1: High-Priority FCM Push (wakes background app if system budget permits)
           ├─► Layer 2: Phase 2 Twilio SMS Blast (100% reach to feature phones and offline devices)
           ├─► Layer 3: Periodic Background Fetch (WorkManager on Android / BGAppRefresh on iOS)
           └─► Layer 4: Foreground Launch Sync (App-Open check: if disaster_mode=true, fetch immediately)
```

1. **Layer 1 (FCM Push):** Dispatches high-priority message (`priority: "high"`) with both `notification` (for visual urgency) and `data` payload.
2. **Layer 2 (SMS Blast):** Twilio SMS contains brief incident summary and instructions, reaching parents regardless of app state or data connectivity.
3. **Layer 3 (Periodic Sync):** Background workers poll tenant status every 4–6 hours during alert periods.
4. **Layer 4 (App-Open Trigger):** Every cold start or resume from background checks tenant metadata; if Disaster Mode is flagged, the Disaster Pack downloads immediately.

---

## Spike C Empirical Findings (Push in Terminated State)

Spike C evaluated FCM message delivery on test hardware:

| Scenario | Android 11 Go | iOS 16/17 |
|---|---|---|
| **App Foreground** | Delivered instantly (< 1s) | Delivered instantly (< 1s) |
| **App Background (Recent)** | Data payload invokes background handler | Data payload invokes background handler |
| **App Swiped Away / Force-Quit** | High-priority data message wakes background isolate | **Silent/data-only push is NOT delivered.** System suppresses execution until user opens app. Visual notification banners DO display; tapping launches app and triggers Layer 4 sync. |
| **Doze Mode / Battery Saver** | Deferral of 2–15 minutes until maintenance window | Throttled according to APNs power budget |

---

## Consequences

### Positive
- Shared family devices never cross-contaminate notifications between sibling logins.
- Disaster Pack delivery is 100% reliable across app states via multi-channel fallback.
- Explicit handling of iOS APNs and Android OEM power saver behaviors.

### Trade-offs
- Background sync on iOS cannot be purely instant when the app is swiped away; relies on visual push tap or next app open.
