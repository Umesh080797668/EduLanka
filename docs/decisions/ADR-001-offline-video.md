# ADR-001: Offline Video Strategy (HLS vs Chunked Encrypted MP4)

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead, Systems Architect
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0)

---

## Context

EduLanka serves students and teachers across Sri Lanka, including rural schools with intermittent 3G/4G connectivity, frequent power disruptions, and strict mobile data budget constraints. Phase 3 introduces offline educational content, including video tutorials hosted on Cloudinary.

We evaluated two architectural approaches for offline video playback on low-end mobile devices (target hardware class: Android 10/11 Go Edition, 2GB RAM):

1. **Approach 1: Offline HLS (HTTP Live Streaming)**
   - Download the HLS master playlist, variant playlists, and hundreds of individual `.ts` segment chunks.
   - Encrypt individual segments at rest on device storage.
   - Playback via local loopback HTTP server (`http://127.0.0.1:port`) on the device or custom native ExoPlayer `DataSource`.

2. **Approach 2: Progressive MP4 with Byte-Offset AES-CTR Encryption**
   - Transcode uploaded videos via Cloudinary eager transformations into optimized 360p (default for mobile) and 720p progressive MP4s.
   - Download the target MP4 file directly into the app's sandboxed storage using standard HTTP `Range` requests (`206 Partial Content`).
   - Encrypt the file using **AES-CTR (AES/CTR/NoPadding)**. The encryption key is generated per device/session and stored securely in Android Keystore / iOS Keychain.
   - Play back via a custom native ExoPlayer `DataSource` (`AesCtrEncryptedDataSource`) or local loopback HTTP server that decrypts byte-ranges on the fly without loading the complete file into RAM.

### Architectural Pivot: Progressive MP4 + AES-CTR vs P3-S0 HLS Spec
While the initial Phase 3 Sprint 0 (P3-S0) specification proposed offline HLS, empirical testing and field constraints revealed critical limitations:
1. **Filesystem and Inode Exhaustion on Low-End Devices:**
   A 30-minute educational video segmented into 4-second `.ts` chunks generates over 450 individual files per video. On low-end Android Go hardware with slow eMMC or cheap FAT32/exFAT micro-SD cards, creating, encrypting, and tracking hundreds of files causes file system lock contention, inode exhaustion, and catastrophic corruption if power or download is interrupted.
2. **Download Resumption Fragility:**
   Orchestrating resumable multi-part downloads across hundreds of segmented chunks and dynamic `.m3u8` variant playlists introduces immense state-machine complexity. In rural Sri Lanka with flaky 3G/4G connectivity, partial segment failures lead to broken playlists.
3. **Progressive MP4 + AES-CTR Superiority:**
   A single progressive MP4 file with the `moov` atom at the start (`faststart`) downloaded via standard HTTP `Range` requests (`206 Partial Content`) provides atomic resumability, single-file sandboxing (`.enc.mp4`), and zero inode explosion. AES-CTR enables exact byte-range decryption on the fly with $O(1)$ seek math, requiring $\le 64\text{ KB}$ RAM.
4. **Conclusion:**
   We deliberately diverge from the original P3-S0 offline HLS proposal. **Progressive MP4 + AES-CTR** is adopted for all offline storage, while Cloudinary adaptive HLS remains exclusively for live online web and mobile streaming.

### Technical Challenges & Resolution:
- **Seekability & Low Memory:** Block modes like AES-CBC require chaining from block 0; AES-GCM requires authenticating the whole ciphertext tag before releasing bytes. Decrypting a 45 MB to 120 MB video entirely into RAM causes immediate Out-Of-Memory (OOM) crashes on 2 GB RAM Android Go devices. 
- **The AES-CTR Mathematical Seeking Solution:**
  - AES block size is fixed at 16 bytes.
  - In Counter (CTR) mode, keystream blocks are generated independently: `Keystream(i) = AES_Encrypt(Key, IV + i)`.
  - For any byte seek position `position`:
    - Counter block index = `position / 16`.
    - In-block offset = `position % 16`.
    - Counter initialization: `effective_iv = base_iv + (position / 16)`.
    - If `in-block offset > 0`, the first `position % 16` bytes of the initial keystream block are discarded.
  - This allows **O(1) random-access seeking** to any arbitrary byte offset with zero whole-file decryption and a RAM buffer capped at ≤ 64–128 KB.
- **Cloudinary Storage Quota Accounting:**
  - Derived progressive MP4 renditions count against Cloudinary account storage.
  - The backend tenant storage ledger (`public.tenant_storage_ledgers`) must account for both the master uploaded video and all generated MP4 renditions against the school's `plans.storage_quota_gb`.

---

## Spike A Architecture & Verification Protocol

The architecture was prototyped in `spikes/offline_video_spike`:

### 1. Native Android Implementation (`AesCtrEncryptedDataSource.kt`)
- Implements `androidx.media3.datasource.DataSource`.
- Directly interfaces with Media3 / ExoPlayer pipeline.
- Uses Java Cryptography Architecture `Cipher.getInstance("AES/CTR/NoPadding")`.
- On `open(dataSpec)`, reads requested `dataSpec.position` and calculates `adjustedIv = baseIv + (position / 16)`.
- Discards `position % 16` bytes if seek is not aligned to a 16-byte boundary.
- Reads encrypted bytes in 64 KB buffers, decrypts via `cipher.update()`, and yields directly to ExoPlayer's demuxer.

### 2. Flutter / Dart Video Player Integration (`spike_a_chunked_video.dart`)
- Implements `LoopbackEncryptedVideoServer` running on `127.0.0.1:$port`.
- Handles standard HTTP `Range: bytes=start-end` requests from `video_player`.
- Employs PointyCastle `CTRStreamCipher(AESEngine())` initialized with `incrementIv(baseIv, start ~/ 16)`.
- Streams decrypted bytes with `HTTP 206 Partial Content` and `Content-Range: bytes $start-$end/$fileLength`.

### 3. Physical Hardware Benchmark Protocol
Measurements on target devices (e.g. Samsung Galaxy A03 Core / Xiaomi Redmi 9A) must be gathered using the following procedure:
1. **Memory Profiling (OS level):**
   ```bash
   adb shell dumpsys meminfo lk.edulanka.offline_video_spike
   ```
   Record `TOTAL PSS` and `Native Heap` before playback, during initial buffering, and after 10 scrub operations.
2. **Airplane Mode Verification:**
   - Put device in Airplane Mode (Cellular and Wi-Fi toggled OFF).
   - Launch app, verify zero network interface connectivity.
   - Start video playback and execute scrubs across 10%, 50%, and 90% timeline marks.
3. **Latency Measurement:**
   - Use `Stopwatch` from UI trigger to video playback first-frame event (`startupLatencyMs`).
   - Use `Stopwatch` from seek request to frame presentation (`seekLatencyMs`).
   - Latencies are recorded as exact measurements (no synthetic floored constants).

---

## Decision

We **adopt Progressive MP4 + AES-CTR encryption at rest** decoded via `AesCtrEncryptedDataSource` (ExoPlayer) and loopback playback (`video_player`).

1. **Online Streaming:** Cloudinary HLS (adaptive bitrate) remains the standard for live/online playback across web and mobile.
2. **Offline Download Pipeline:**
   - Client requests download for a selected rendition (360p default for mobile, 720p optional).
   - Download manager utilizes HTTP `Range` headers for pause/resume resilience.
   - Stream is written to disk through AES-CTR cipher.
   - File key is stored securely in Android Keystore / iOS Keychain.
3. **Playback Pipeline:**
   - Native playback uses `AesCtrEncryptedDataSource` with ExoPlayer.
   - Cross-platform Flutter fallback uses loopback AES-CTR server feeding `video_player`.
   - Seeking queries the MP4 `moov` atom directly by decrypting only requested byte offsets.
4. **Quota Accounting:**
   - Cloudinary upload webhook notifies API of generated MP4 renditions.
   - The total storage size (master + renditions) is charged to `tenant_storage_ledgers`.

---

## Consequences

### Positive
- Zero OOM risk on 2 GB RAM phones (memory usage bounded; decryption buffer held at ≤ 64 KB).
- Predictable, low-latency seeking without full-file decryption delays.
- Clean file system: exactly 1 file per offline lesson on device storage (`.enc.mp4`), preventing inode exhaustion on cheap SD cards.
- Clean resume of interrupted downloads on unstable rural networks via HTTP `Range` headers.

### Trade-offs
- Cloudinary generates MP4 renditions alongside HLS manifests, increasing tenant storage consumption (tracked in the quota ledger).
