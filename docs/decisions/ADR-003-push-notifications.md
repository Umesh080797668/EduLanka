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

## Spike C Verification Protocol & Implementation

Prototyped in `spikes/offline_video_spike/lib/spike_c_fcm_push.dart` using `firebase_core` (4.15.0) and `firebase_messaging` (16.7.0):

### 1. Top-Level Background Isolate Handler
- Top-level function `@pragma('vm:entry-point') Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message)` registered via `FirebaseMessaging.onBackgroundMessage`.
- Handles data-only high-priority messages and records events directly to persistent disk storage (`fcm_background_events.log`) so event reception can be proven when the main UI is relaunched.

### 2. Terminated State Verification Protocol
To verify push delivery on a real physical device:
1. Launch the app on a physical device, log into a test user, and copy the device's FCM token.
2. Swipe the app away from the app switcher (force-stop / terminated state).
3. Send a data-only high-priority FCM message using the Firebase HTTP v1 API:
   ```json
   {
     "message": {
       "token": "<DEVICE_FCM_TOKEN>",
       "android": {
         "priority": "HIGH"
       },
       "data": {
         "type": "DISASTER_MODE_ACTIVATED",
         "tenant_id": "45f9722b-b6d3-4a11-82e1-45bc5462f741",
         "reason": "FLOOD",
         "expected_duration": "3_DAYS",
         "timestamp": "1786455720000"
       }
     }
   }
   ```
4. Observe Android Logcat / system event receipt:
   ```bash
   adb logcat -s Flutter FCM FirebaseMessaging
   ```
5. Reopen the app. Verify that `receivedPushes` contains the payload recorded while the app was swiped away, or that Fallback Layer 4 immediately caught the Disaster Mode flag upon app resume.

---

## Consequences

### Positive
- Shared family devices never cross-contaminate notifications between sibling logins.
- Disaster Pack delivery is 100% resilient across device states via multi-channel fallback (FCM + SMS + WorkManager + App-Open sync).
- Explicit, honest handling of iOS APNs and Android OEM power saver behaviors.


### Trade-offs
- Background sync on iOS cannot be purely instant when the app is swiped away; relies on visual push tap or next app open.
