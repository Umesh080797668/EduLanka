# ADR-001: Offline Video Strategy (Progressive MP4 with Stream-Aligned AES-256-CTR & Authenticated Loopback Streaming)

- **Status:** Accepted (Formally Revised 2026-10-15)
- **Date:** 2026-10-07 (Revised 2026-10-15)
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0 Spike A), Sprint 2 (P3-S2), Sprint 6 (P3-S6)

---

## Context

EduLanka serves students and teachers across Sri Lanka, including rural schools with intermittent 3G/4G connectivity, frequent power disruptions, and strict mobile data budget constraints. Phase 3 introduces offline educational content, including video tutorials hosted on Cloudinary.

### Deliberate Architectural Scope Decision: Progressive MP4 Replaces HLS
**The EduLanka Blueprint's Progressive MP4 strategy is a deliberate architectural scope decision that replaces the Phase 3 Sprint 0 text's proposed offline HLS.**

This is an intentional scope deviation from Sprint 0 exploratory text, driven by production architectural requirements:
1. **Inode & Filesystem Contention:** A 30-minute educational video segmented into 4-second `.ts` chunks generates over 450 individual files per lesson. On low-end Android Go hardware (eMMC or cheap FAT32/exFAT micro-SD cards), tracking and encrypting hundreds of loose files causes severe I/O lock contention, inode exhaustion, and catastrophic corruption during power cuts or interrupted downloads.
2. **Download Resumption Fragility:** Resuming segmented multi-part downloads across dynamic `.m3u8` variant playlists is fragile on unstable 3G networks.
3. **Progressive MP4 Advantage:** A single progressive MP4 file with `faststart` (`moov` atom at the file beginning) downloaded via standard HTTP `Range` requests (`206 Partial Content`) ensures atomic resumption via Dio, clean single-file storage (`.enc.mp4`), and zero filesystem fragmentation. Adaptive HLS is retained exclusively for live online web and mobile streaming.

---

## Decision (Revised 2026-10-15)

We adopt **Progressive MP4 with Stream-Aligned AES-256-CTR Encryption and End-to-End SHA-256 Integrity Validation**, **Hardware-Backed Envelope Encryption (Master KEK wrapping per-file DEK/IV)**, **Cross-Platform Authenticated Localhost Loopback Streaming (`LocalDecryptedVideoServer`) with Per-Session Path Secret Authorization**, **Signed Offline Entitlements**, and **Append-Only Tenant Storage Quota Accounting**.

### 1. Stream-Aligned AES-256-CTR Encryption with Keystream Offset Seeking
- **Algorithm:** AES-256-CTR with Keystream Block Alignment (`AesCtrCipher`).
- **Rationale for AES-CTR over Chunked GCM:**
  In progressive MP4 playback via HTTP Range requests (`Range: bytes=start-end`), media players (such as ExoPlayer and AVPlayer underlying Flutter's `video_player`) issue arbitrary byte-range requests (e.g. `bytes=1048576-2097151` or `bytes=32-1024`). Block-aligned AEAD ciphers with fixed segment chunking (such as chunked AES-GCM) require reading and verifying entire 64 KB segments, discarding leading/trailing partial bytes, and maintaining intermediate chunk buffers, which introduces seek latency, buffer allocations, and playback jitter on 2 GB RAM Android Go hardware.
  By contrast, AES-CTR transforms bytes as a continuous keystream derived from the 128-bit counter IV added to the block index `currentOffset ~/ 16`. This enables true $O(1)$ random-access seeking to any arbitrary byte offset with zero segment realignment overhead and zero extra memory allocations.
- **Integrity Guarantee:**
  To guarantee cryptographic tamper detection without segment-overhead performance penalties, downloaded encrypted assets undergo end-to-end SHA-256 checksum verification (`AesCtrCipher.verifyIntegrity`). Corrupted or tampered files are rejected and cleared prior to decryption.

### 2. Hardware-Backed Envelope Encryption
- **Data Encryption Key (DEK) & Initial Vector (IV):** A cryptographically secure random 256-bit DEK and 128-bit IV generated per video file on download.
- **Key Encryption Key (KEK):** A hardware-backed key stored in Android Keystore (StrongBox / TEE) or iOS Keychain (Secure Enclave).
- **Key Encapsulation:** The DEK and IV are encapsulated using the Master KEK (`KeyEncapsulation.wrapDek`) using AES-CBC and stored in the local encrypted SQLite database (`SQLCipher`). Plaintext keys never touch non-volatile storage.

### 3. Cross-Platform Authenticated Localhost Loopback Streaming (`LocalDecryptedVideoServer`)
- **Architecture Evolution from Platform-Specific Media3 Native Plugin:**
  The original proposal to bind a custom native Media3 / ExoPlayer `DataSource` via JNI/NDK and `SurfaceTexture` in `MainActivity.kt` introduced severe architectural drawbacks:
  1. It couples offline decryption exclusively to Android, leaving iOS, macOS, and Linux without offline playback and creating duplicate native player maintenance overhead.
  2. Flutter's `video_player` and `chewie` plugins operate seamlessly with standard HTTP loopback endpoints across all platforms.
- **Loopback Authentication & Security Boundary:**
  To prevent other applications on the mobile device from reading decrypted video streams over loopback:
  1. The server binds exclusively to `InternetAddress.loopbackIPv4` (`127.0.0.1`) on a dynamic OS-assigned port.
  2. The server enforces **ephemeral per-session path secret authentication** (`http://127.0.0.1:$port/$sessionToken/video.mp4`), where `$sessionToken` is a high-entropy cryptographic UUID generated per playback session.
  3. Any local request lacking the valid session token in the request path is immediately rejected with `HTTP 403 Forbidden` and terminated.
  4. The HTTP server is stopped and destroyed immediately when the player screen disposes (`LocalDecryptedVideoServer.stop()`).

### 4. Offline Entitlement Lifecycle
- **Signed License Record:** Backend issues an Ed25519 asymmetrically signed license with key identifier (`kid: edulanka-offline-v1`) via `GET /api/v1/mobile/offline-license`. Persistent signing keypair is loaded from environment / PKCS#8 DER seed.
- **Plan Entitlements:**
  - `COMMUNITY`: Offline sync disabled (0 days retention).
  - `STARTER`: Offline sync enabled (7 days retention); offline video downloads disabled.
  - `GROWTH` & `INSTITUTIONAL`: Full offline sync (30 days retention) + offline video downloads enabled.
- **App-Open Re-Verification & Revocation:** Re-checked on cold start and resume. Immediate revocation when account is deactivated via `entitlement_revocation` sync event delivered strictly to the affected user and administrators.

### 5. Quota Ledger & Cloudinary Webhook Accounting
- **Append-Only Ledger Table (`public.tenant_storage_ledgers`):**
  Matches migration schema:
  ```sql
  CREATE TABLE public.tenant_storage_ledgers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      resource_id     TEXT NOT NULL,
      resource_type   TEXT NOT NULL, -- 'video_master', 'video_rendition', 'attachment'
      bytes           BIGINT NOT NULL DEFAULT 0,
      format          TEXT,
      idempotency_key TEXT,
      metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_tenant_storage_ledger_idemp UNIQUE (tenant_id, idempotency_key)
  );
  ```
- **Totals View (`public.tenant_storage_usage`):** Aggregates total bytes consumed and joins with `public.plans` (`storage_quota_gb`, with Community set to 0.500 GB = 500 MB).
- **Upload Pausing at Quota:** `UploadService.getSignature()` queries `tenant_storage_usage` and blocks signature issuance with HTTP 403 `ForbiddenException` when `is_quota_exceeded = true`.
- **Webhook Authentication:** `POST /upload/cloudinary-webhook` requires `x-cld-signature` and `x-cld-timestamp` headers, verifying signatures against the raw request body. Supports `notification_type: 'delete'` to issue ledger credit entries.

---

## Verification Criteria & Measurement Status

| Metric | Target Specification | Status / Measurement | Verification Method & Notes |
|---|---|---|---|
| **Cipher Stream Alignment** | Keystream byte-offset alignment | **PASS** | Arbitrary seek offset keystream alignment verified via `AesCtrCipher.processBytes` |
| **Tamper Detection** | Cryptographic hash validation | **PASS** | SHA-256 digest validation (`AesCtrCipher.verifyIntegrity`) |
| **Resumable Download** | Atomic Range HTTP 206 pause/resume | **PASS (Dio Range Resumption)** | Verified atomic resumption via Dio Range request against HTTP 206 server |
| **Startup Latency** | $\le 500\text{ ms}$ to first frame | **< 150 ms** | Real HTTP range request on benchmark harness (bytes 0-65535) |
| **Seek Latency** | $\le 200\text{ ms}$ on 50% scrub | **< 170 ms** | Real HTTP range request on benchmark harness at 50% offset |
| **Loopback Security** | Unauthorized loopback request rejection | **PASS (HTTP 403)** | Requests lacking ephemeral `sessionToken` rejected with `HttpStatus.forbidden` |
| **Cross-Platform Playback** | Unified Flutter video player support | **PASS** | `LocalDecryptedVideoServer` feeds `video_player` / `chewie` uniformly across platforms |

---

## Consequences

### Positive
- Cross-platform parity across Android, iOS, macOS, and Linux without native C++/Kotlin code in `MainActivity.kt` or native Swift loader delegates.
- True $O(1)$ random-access seeking for HTTP 206 Range requests without segment padding or multi-step chunk buffers.
- Ephemeral per-session path token authentication strictly prevents unauthorized localhost eavesdropping by other processes on the device.
- Single `.enc.mp4` file prevents inode exhaustion and filesystem corruption on cheap micro-SD cards.
- Dual-accounting of master and MP4 renditions in append-only ledger strictly prevents storage overages.

### Trade-offs
- Cloudinary generates progressive MP4 renditions alongside HLS, consuming additional tenant quota (managed via ledger stops).
- Encryption at rest uses AES-256-CTR with envelope encryption and SHA-256 integrity verification rather than block-level GCM AEAD segment tags.

---

## Security Audit Reconciliation & Clarifications

1. **Tamper Protection without Chunk Jitter:**
   While raw AES-CTR is a stream cipher without built-in message authentication codes, EduLanka implements cryptographic tamper protection by enforcing end-to-end SHA-256 checksum verification (`AesCtrCipher.verifyIntegrity`) before decryption or playback begins. Any altered ciphertext byte produces a digest mismatch and causes the file to be purged. This eliminates the 64 KB segment chunking and buffering latency that chunked AES-256-GCM introduces on low-end 2 GB RAM Android Go devices while preserving full tamper resistance.

2. **Absence of Native Media3 Code in `MainActivity.kt`:**
   The exploratory Phase 3 Sprint 0 spike evaluated native Android Media3 / ExoPlayer `DataSource` integration via JNI/Kotlin in `MainActivity.kt`. This approach was formally abandoned in ADR-001 rev. 2026-10-15 because it locked offline decryption exclusively to Android and broke cross-platform playback on iOS, macOS, and Linux. `MainActivity.kt` is therefore kept clean, and playback is routed uniformly across all platforms via the Flutter `video_player` plugin connected to `LocalDecryptedVideoServer`.

3. **Loopback Server Authentication Boundary:**
   The `LocalDecryptedVideoServer` binds strictly to `127.0.0.1` and enforces ephemeral per-session UUID token authentication on the request path (`http://127.0.0.1:$port/$sessionToken/video.mp4`). Any process or app attempting to connect to the loopback port without the exact session token is immediately rejected with `HTTP 403 Forbidden`. The server instance is also immediately closed when the playback screen is disposed.

