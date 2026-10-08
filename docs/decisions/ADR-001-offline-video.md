# ADR-001: Offline Video Strategy (Chunked Encrypted MP4 with Tink Streaming AEAD)

- **Status:** Accepted
- **Date:** 2026-10-07 (Updated 2026-10-08)
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 2 (P3-S2)

---

## Context

EduLanka serves students and teachers across Sri Lanka, including rural schools with intermittent 3G/4G connectivity, frequent power disruptions, and strict mobile data budget constraints. Phase 3 introduces offline educational content, including video tutorials hosted on Cloudinary.

We evaluated architectural approaches for offline video download and playback on low-end mobile devices (target hardware class: Android 10/11 Go Edition, 2GB RAM):

1. **Rejected: Multi-Segment Offline HLS (`.ts` files + dynamic playlists)**
   - A 30-minute educational video segmented into 4-second `.ts` chunks generates over 450 individual files per video.
   - On low-end Android Go hardware with slow eMMC or cheap FAT32/exFAT micro-SD cards, creating, encrypting, and tracking hundreds of files causes file system lock contention, inode exhaustion, and catastrophic corruption if power or download is interrupted.
   - Resumable multi-part downloads across hundreds of segmented chunks and dynamic `.m3u8` variant playlists introduces immense state-machine fragility on flaky 3G/4G connectivity.
   - Cloudinary adaptive HLS remains exclusively for live online web and mobile streaming.

2. **Selected: Progressive MP4 with Chunked Encryption (Google Tink Streaming AEAD)**
   - Cloudinary generates optimized progressive MP4 renditions (360p mobile default, 720p optional) with `faststart` (`moov` atom at the beginning of the file).
   - Single-file sandboxing: exactly 1 file per downloaded lesson on device storage (`.enc.mp4`), preventing inode explosion.
   - Chunked GCM authenticated encryption (Google Tink Streaming AEAD) with 64 KB to 1 MB segments guarantees cryptographic integrity of every segment, preventing ciphertext bit-flipping while enabling fast $O(1)$ seekability.
   - Low memory footprint: Decryption buffer is bounded strictly to segment size ($\le 64\text{ KB}$ to $1\text{ MB}$), eliminating Out-Of-Memory (OOM) risks on 2 GB RAM devices.

---

## Decision

We adopt **Progressive MP4 with Chunked GCM Streaming AEAD Encryption**, **Hardware-Backed Envelope Encryption**, **Custom Native ExoPlayer DataSource**, **Signed Offline Entitlements**, and **Append-Only Tenant Storage Quota Accounting**.

### 1. Chunked Encryption (Google Tink Streaming AEAD)
- **Algorithm:** AES-128-GCM or AES-256-GCM Streaming AEAD (via Google Tink library / native cryptographic providers).
- **Segment Size:** 64 KB to 1 MB segments.
- **Integrity Guarantee:** Each segment contains its own authentication tag. Tampering or corruption is detected immediately on segment decryption rather than at the end of the entire file.
- **Random Access Seeking:** The Tink `SeekableByteChannel` decodes only the specific 64 KB segment containing the requested byte offset, yielding true $O(1)$ seek times without buffering unplayed video segments into RAM.

### 2. Hardware-Backed Envelope Encryption
- **Data Encryption Key (DEK):** A cryptographically secure random 256-bit key generated per video file on download.
- **Key Encryption Key (KEK):** A hardware-backed key stored in Android Keystore (StrongBox / TEE) or iOS Keychain (Secure Enclave).
- **Storage:** The DEK is encrypted by the KEK (wrapped key) and persisted in the local encrypted SQLite database (`SQLCipher`). Plaintext DEKs are never written to disk.

### 3. Custom ExoPlayer DataSource & Playback Pipeline
- **Native Android Plugin:** A custom Media3 / ExoPlayer `DataSource` (`TinkSeekableDataSource` / `AesCtrEncryptedDataSource`) reading directly through the Tink seekable byte channel.
- **Rendering:** Uses ExoPlayer on a Flutter texture or Platform View.
- **Cross-Platform / Development Fallback:** A local loopback HTTP streaming server (`127.0.0.1:$port`) serving authenticated `Range: bytes=start-end` requests (`206 Partial Content`) for cross-platform preview.
- **iOS Implementation:** Requires an `AVAssetResourceLoaderDelegate` native implementation; treated as a spike pending validation.

### 4. Offline Entitlement Lifecycle
- **Signed License Record:** When a student downloads offline content, the backend issues an offline entitlement license signed with HMAC-SHA256 (`GET /api/v1/mobile/offline-license`).
- **Validity & Expiry:** Tied to the school's active subscription plan and the academic term, capped at a maximum of 30 days offline grace window.
- **App-Open Re-Verification:** On every cold boot and resume, the client validates license expiration. If expired and online, it requests a renewal token; if offline past the expiration date, playback is locked.
- **Instant Revocation:** When a student is deactivated or unenrolled, the backend emits an `entitlement_revocation` event into `sync_events`. Upon the next sync pull, the client wipes the cached DEKs from SQLCipher and deletes encrypted media files.

### 5. MP4 Renditions & Quota Ledger
- **Append-Only Ledger Table (`public.tenant_storage_ledgers`):**
  Records every asset addition and deletion with `idempotency_key` to prevent duplicate accounting:
  ```sql
  CREATE TABLE public.tenant_storage_ledgers (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      asset_id        TEXT NOT NULL,
      asset_type      TEXT NOT NULL CHECK (asset_type IN ('VIDEO_MASTER', 'VIDEO_RENDITION', 'ATTACHMENT', 'IMAGE')),
      bytes_change    BIGINT NOT NULL,
      idempotency_key TEXT NOT NULL,
      metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, idempotency_key)
  );
  ```
- **Totals View (`public.tenant_storage_usage`):**
  Aggregates total bytes consumed per tenant and joins with `public.plans` to evaluate `is_quota_exceeded`.
- **Cloudinary Webhook Integration:**
  `POST /api/v1/upload/cloudinary-webhook` validates the Cloudinary HMAC signature (`x-cld-signature`) and records the byte sizes for the uploaded master video and all derived MP4 renditions.
- **Upload Quota Enforcement:**
  `UploadService.getSignature()` queries `tenant_storage_usage`. If `is_quota_exceeded` is true, upload signature requests are blocked with HTTP 403 `ForbiddenException` ("Tenant storage quota exceeded. Upgrade subscription to upload new media.").

---

## Consequences

### Positive
- **Guaranteed Memory Safety:** RAM usage is strictly capped at $\le 64\text{ KB}$–$1\text{ MB}$ per playback pipeline, eliminating OOM crashes on 2 GB Android Go devices.
- **Integrity & Security:** Chunked GCM prevents bit-flipping attacks, while hardware-backed envelope encryption protects DEKs against offline storage extraction.
- **Filesystem Cleanliness:** Single `.enc.mp4` file avoids inode explosion and micro-SD FAT32 corruption.
- **Deterministic Quota Accounting:** Dual-accounting of master and MP4 renditions in an append-only ledger prevents tenant storage overages.
- **Instant Revocation:** Compromised or deactivated accounts lose offline access via `entitlement_revocation` sync events.

### Trade-offs
- Cloudinary generates MP4 renditions alongside HLS manifests, increasing tenant storage consumption (tracked in the quota ledger).
- iOS `AVAssetResourceLoaderDelegate` requires native Swift implementation and remains designated as a platform spike.
