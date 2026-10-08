# ADR-003: Push Notifications, Background BullMQ Processing & Disaster Readiness

- **Status:** Accepted
- **Date:** 2026-10-07 (Updated 2026-10-08)
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 4 (P3-S4), Sprint 8 (P3-S8)

---

## Context

Mobile devices in EduLanka require push notification capabilities for critical school announcements, user alerts, and automated background synchronization (Disaster Pack preparation, event stream invalidation).

### Technical Challenges & Reliability Constraints:
1. **Unreliability of Silent Push (Data-Only Messages):**
   - **iOS:** Apple throttles silent pushes (`apns-priority: 5`, `content-available: 1`). iOS will **never** wake an app that has been force-quit or swiped away from the app switcher until the user explicitly re-launches the app.
   - **Android:** Android Doze mode and aggressive OEM battery optimization daemons (MIUI, EMUI, ColorOS) aggressively defer or discard background data messages when devices are on battery.
2. **Synchronous Push Dispatch Bottlenecks:**
   - Broadcasting a disaster alert to thousands of parents and students in a single school synchronously stalls HTTP request cycles and risks timeout.
3. **Dead / Stale Tokens:**
   - Re-sending pushes to uninstalled devices wastes quota and causes Firebase HTTP v1 API rate limits.
4. **Shared Family Phones:**
   - In rural Sri Lankan households, multiple family members often share a single smartphone. Device tokens must be reassigned atomically to prevent cross-account notification leaks.

---

## Decision

We adopt **Firebase Cloud Messaging (FCM) HTTP v1 via BullMQ Async Worker (`fcm-push`)**, **Batched Token Dispatch with Dead-Token Cleanup**, **Phase 2 Twilio SMS Emergency Fallback**, and a **Standardized Disaster-Readiness Pack Architecture**.

### 1. Asynchronous BullMQ Queue Architecture (`FcmProcessor`)

Disaster alerts and bulk notifications are enqueued to Redis via BullMQ (`fcm-push` queue):
- **Worker Concurrency:** Jobs process in the background without blocking the NestJS HTTP request loop.
- **Batching:** Active device tokens are chunked into batches of up to 500 tokens per FCM API call (`sendEachForMulticast`).
- **Dead-Token Cleanup:**
  - Responses with errors `messaging/registration-token-not-registered`, `messaging/invalid-registration-token`, or `UNREGISTERED` trigger automatic deactivation:
    `UPDATE public.device_tokens SET is_active = FALSE, updated_at = NOW() WHERE token = $token`.
- **SMS Fallback Trigger:**
  - For high-priority disaster mode alerts (`DISASTER_MODE_ACTIVATED`), the processor automatically invokes the Phase 2 Twilio SMS pipeline (`SmsService.sendBatchSms`) to deliver emergency SMS notifications to registered parent and guardian phone numbers.

### 2. Device Token Registry & Ownership Reassignment

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

When a user logs in via `POST /api/v1/mobile/device-token`, ownership is atomically transferred to the current tenant and user:
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

### 3. Disaster-Readiness Pack Blueprint Schema (`GET /mobile/disaster-pack`)

The Disaster Pack response bundles all essential offline resources for students and teachers:
1. **Closure Status & Metadata:**
   - Active state (`is_active`), incident reason (`reason`), expected duration, and expected resume date from `public.disaster_events`.
2. **Emergency Contacts:**
   - Sourced from `school_policy.extra_config->emergency_contacts` (e.g. Principal, Police 119, Disaster Management Centre 117, local hospitals).
3. **Official Circulars & Notices:**
   - Urgent notices from `public.notices` containing `content_html` and attachment references (not empty or truncated text).
4. **Offline Academic Content (Last 7 Days):**
   - Active homework assignments and materials issued over the preceding 7 days from `public.homework_assignments`.
   - Associated learning resources and syllabus guides.

### 4. Client-Side Security & Multi-Channel Sync Fallback

```text
[ Disaster Mode Activated ]
           │
           ├─► Layer 1: High-Priority FCM Push (wakes background app if system budget permits)
           ├─► Layer 2: Twilio SMS Blast (100% reach to feature phones and offline devices)
           ├─► Layer 3: Periodic Background Fetch (WorkManager on Android / BGAppRefresh on iOS)
           └─► Layer 4: Foreground Launch Sync (App-Open check: if disaster_mode=true, fetch immediately)
```

- **Cross-Tenant Validation:**
  When `SpikeCPushEngine` receives a push notification with `type: 'DISASTER_MODE_ACTIVATED'`, it verifies that the incoming `tenant_id` matches the active user's `currentTenantId`. Cross-tenant payloads are immediately dropped with security audit logging.
- **Fail-Safe Caching:**
  The mobile client updates its cached disaster pack only upon receiving an authentic HTTP 200 response with status `DISASTER_PACK_READY`. Network errors or HTTP 500 failures leave prior cached data intact.

---

## Consequences

### Positive
- High throughput and non-blocking push dispatch via BullMQ background queue.
- Dead tokens are purged automatically, maintaining high FCM delivery rates.
- Multi-channel delivery guarantees 100% reach across offline devices, feature phones, and low-battery smartphones via Twilio SMS fallback.
- Shared family devices never leak cross-sibling notifications due to atomic token ownership reassignment.
- Structured Disaster Pack provides students and teachers with complete academic and safety information during emergency school closures.

### Trade-offs
- Twilio SMS dispatch incurs operational telecom costs, reserved strictly for high-severity disaster mode activations.
