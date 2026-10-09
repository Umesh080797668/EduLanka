# ADR-003: Push Notifications, Background BullMQ Processing & Disaster Readiness

- **Status:** Accepted
- **Date:** 2026-10-07 (Updated 2026-10-08)
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0 Spike C), Sprint 4 (P3-S4), Sprint 8 (P3-S8)

---

## Context

Mobile devices in EduLanka require push notification capabilities for critical school announcements, user alerts, and automated background synchronization (Disaster Pack preparation, event stream invalidation).

### Technical Challenges & Reliability Constraints:
1. **Unreliability of Silent Push (Data-Only Messages):**
   - **iOS:** Apple throttles silent pushes (`apns-priority: 5`, `content-available: 1`). iOS will **never** wake an app that has been force-quit or swiped away from the app switcher until the user explicitly re-launches the app.
   - **Android:** Android Doze mode and aggressive OEM battery optimization daemons (MIUI, EMUI, ColorOS) aggressively defer or discard background data messages when devices are running on battery.
2. **Synchronous Push Dispatch Bottlenecks:**
   - Broadcasting a disaster alert to thousands of parents and students in a single school synchronously stalls HTTP request cycles and risks timeout.
3. **Dead / Stale Tokens:**
   - Re-sending pushes to uninstalled devices wastes quota and triggers Firebase HTTP v1 API rate limits.
4. **Shared Family Phones:**
   - In rural Sri Lankan households, multiple family members often share a single smartphone. Device tokens must be reassigned atomically to prevent cross-account notification leaks.

---

## Decision

We adopt **Firebase Cloud Messaging (FCM) HTTP v1 via BullMQ Async Worker (`fcm-push`)**, **Batched Token Dispatch with Dead-Token Cleanup**, **Phase 2 Twilio SMS Emergency Fallback**, and a **Standardized Disaster-Readiness Pack Architecture**.
### 1. Asynchronous BullMQ Queue Architecture (`FcmProcessor`)

Disaster alerts and bulk notifications are enqueued to Redis via BullMQ (`fcm-push` queue):
- **Fail-Loud Production Enforcement:** When `NODE_ENV === 'production'`, `FcmProcessor` throws an explicit error if `FIREBASE_SERVICE_ACCOUNT` is missing, preventing silent delivery failures. In local development or test without cloud credentials, it logs simulation warnings.
- **Worker Concurrency & Retry:** Jobs process in the background. If an FCM batch dispatch fails, the worker throws an error so BullMQ executes automatic exponential backoff retries instead of swallowing failures.
- **Cross-Platform Delivery Headers:**
  - **Android:** `android: { priority: 'high' }`
  - **iOS (APNs Background / Silent Push):**
    ```typescript
    apns: {
      headers: {
        'apns-push-type': 'background',
        'apns-priority': '5',
      },
      payload: {
        aps: {
          'content-available': 1,
        },
      },
    }
    ```
- **Batching & Dead-Token Cleanup:**
  - Active device tokens are chunked into batches of up to 500 tokens per FCM call (`sendEachForMulticast`).
  - Responses with errors `messaging/registration-token-not-registered`, `messaging/invalid-registration-token`, or `UNREGISTERED` trigger automatic deactivation:
    `UPDATE public.device_tokens SET is_active = FALSE, updated_at = NOW() WHERE token = $token`.
- **Safety-Critical SMS Fallback Trigger:**
  - High-priority disaster alerts (`DISASTER_MODE_ACTIVATED`) query emergency contacts from `school_policy.extra_config->emergency_contacts` and registered parent phone numbers, invoking `SmsService.sendBatchSms` with `{ bypassQuota: true, isSafetyCritical: true }`.

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
When a user is deactivated or removed, their registered `device_tokens` are immediately deactivated (`is_active = FALSE`) to prevent subsequent alert leakage.

### 3. Disaster-Readiness Pack Blueprint Schema (`GET /mobile/disaster-pack`)

The Disaster Pack response bundles all essential offline resources for students and teachers:
1. **Closure Status & Dynamic Duration:**
   - Active state (`is_active`), incident reason (`reason`), dynamic closure duration calculated from timestamps (`disaster_resume_date - NOW()`), and expected resume date from `public.tenants`.
2. **Emergency Contacts & Verified Phone Numbers:**
   - Sourced from school official contact telephone and `school_policy.extra_config->emergency_contacts` alongside national hotlines (Police 119, DMC 117, Suwa Seriya 1990).
3. **Official Circulars & Notices (Audience Scoped):**
   - Urgent notices from `public.notices` with `content_html` and attachments, filtered by caller role and class scope (CLASS_SPECIFIC notices delivered strictly to targeted classes).
4. **Offline Academic Content (Last 7 Days):**
   - Active homework assignments and learning materials issued over the preceding 7 days (raw student submissions are strictly excluded to protect student privacy).

---

## Spike C Verification Benchmark & Observations

> [!WARNING]
> **Live Delivery Latencies Untested in CI / Local Spike**:
> Without configured live Google Firebase Cloud credentials (`FIREBASE_SERVICE_ACCOUNT` / `google-services.json`), end-to-end cloud push delivery was not measured in this local benchmark. The timings below represent architectural target expectations and are explicitly marked **UNTESTED** pending live Firebase cloud project deployment.

| App Lifecycle State | Platform Handling Architecture | Delivery Status | Latency Expectation |
|---|---|---|---|
| **Foreground** | Received directly in `FirebaseMessaging.onMessage`. Automated sync triggered immediately. | **UNTESTED** (Target: PASS) | Target $\le 1.2\text{ s}$ (Untested live) |
| **Background (In Recent Apps)** | Top-level isolate `firebaseMessagingBackgroundHandler` wakes up. Data persisted to app document directory and pack synced. | **UNTESTED** (Target: PASS) | Target $\le 2.5\text{ s}$ (Untested live) |
| **Terminated (Stock Android / Go)** | OS wakes background isolate for high-priority message. Log written and pack cached. | **UNTESTED** (Target: PASS) | Target $2.8\text{ – }4.5\text{ s}$ (Untested live) |
| **Terminated (Aggressive OEM Battery Optimization)** | On MIUI / EMUI devices with strict battery saver, OS delays background isolate until app open. | **Handled by Layer 4** | Deferred until App Open |
| **Offline / Airplane Mode** | Push queued in cloud until device reconnects. | **Handled by Layer 2 (SMS)** | Immediate via Twilio SMS |

### Battery Optimization Findings:
- Standard Android Doze mode honours high-priority FCM data messages.
- OEM task killers (MIUI "MIUI Battery Saver", Huawei "PowerGenie") restrict background wakeups when the app is swiped away unless the user adds EduLanka to the "No Restrictions" battery whitelist.
- **Multi-Channel Defense:**
  1. High-priority FCM push (Layer 1) with Android `priority: high` and iOS `apns-push-type: background`.
  2. Twilio SMS emergency blast (Layer 2) reaching registered parent emergency contacts.
  3. App-Open / Resume trigger (Layer 4) immediately fetching the pack whenever the app is reopened.

---

## Security Advisory: API Key Rotation
A Google Services configuration credential was committed in earlier commit `25a0268`.

**Action Status:**
1. **Revocation Notice:** The Google / Firebase credential committed in `25a0268` must be revoked in the Google Cloud Console / Firebase Console immediately.
2. **Key Rotation Procedure:**
   - Generate a new Service Account private key in Firebase Console -> Project Settings -> Service Accounts.
   - Inject the base64-encoded JSON or JSON string into the production secret manager (`FIREBASE_SERVICE_ACCOUNT`).
   - Ensure `google-services.json` and service account keys remain excluded from version control (`.gitignore`).
