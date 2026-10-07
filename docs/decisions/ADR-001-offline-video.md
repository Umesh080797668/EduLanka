# ADR-001: Offline Video Strategy (HLS vs Encrypted MP4)

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0)

---

## Context

EduLanka serves students and teachers across Sri Lanka, including rural areas with intermittent 3G/4G connectivity, periodic power cuts, and severe data constraints. Phase 3 introduces offline educational content, including video lessons hosted on Cloudinary.

We evaluated two architectural approaches for offline video playback on low-end mobile devices (target benchmark: Android 10+, 2GB RAM):

1. **Approach 1: Offline HLS (HTTP Live Streaming)**
   - Download the HLS master playlist, variant playlists, and all individual `.ts` segment chunks.
   - Encrypt segments with AES-256-CBC at rest on device storage.
   - To play back via standard Flutter `video_player` / ExoPlayer, either:
     - Run a local loopback HTTP server (`http://127.0.0.1:port`) on the device that decrypts chunks on-the-fly and streams them to the player.
     - Or implement a custom native ExoPlayer `DataSource` via platform channels.

2. **Approach 2: Progressive MP4 with AES-256 File-Level Encryption**
   - Transcode uploaded videos via Cloudinary into optimized 360p and 720p progressive MP4s.
   - Download the target MP4 file directly into the app's sandboxed storage.
   - Encrypt the file using AES-256-GCM (key stored securely in Android Keystore / iOS Keychain).
   - Decrypt to an ephemeral in-memory buffer or a transient encrypted temp pipe during playback, or use a custom native ExoPlayer encrypted file stream.

---

## Evaluation & Spike Findings

| Evaluation Criterion | Offline HLS (Spike A) | Encrypted Progressive MP4 |
|---|---|---|
| **Storage Overhead & Fragmentation** | High: hundreds of small `.ts` files per video; FAT32/ext4 inode exhaustion on cheap SD cards / low-end flash. | Low: single contiguous file per video lesson. High write throughput, zero fragmentation. |
| **Local Loopback Reliability** | Fragile: OS power-saving modes (Android Doze, aggressive OEM task killers like MIUI/EMUI) kill background loopback sockets during pause/resume. | High: direct file stream or native ExoPlayer `CipherInputStream`; no local HTTP socket needed. |
| **Download Resume & Network Resilience** | Complex: managing download queues of 300+ segment files; interrupted downloads require complex chunk manifest reconciliation. | Simple: HTTP `Range` header support (`206 Partial Content`) allows seamless pause and resume of a single MP4 file. |
| **Storage Encryption Overhead** | High CPU overhead encrypting/decrypting hundreds of separate segment files. | Deterministic AES-256-GCM streaming encryption with hardware acceleration (ARMv8 crypto extensions). |
| **Bandwidth Selection** | Adaptive bitrate is valuable *online*, but for *offline* downloads, users explicitly choose resolution (e.g., "Download in 360p — 45MB" vs "720p — 120MB"). | Optimal: user chooses resolution prior to download; predictable storage footprint. |

---

## Decision

We **adopt Progressive MP4 + AES-256 encryption** as the primary offline video architecture for EduLanka Phase 3.

- **Online Streaming:** Cloudinary HLS (adaptive bitrate) remains the standard for live/online playback in both web and mobile apps.
- **Offline Download & Playback:**
  1. Web/Mobile initiates download requesting a specific rendition (360p default for mobile data savings, 720p optional).
  2. The mobile download manager downloads the MP4 using resumable HTTP byte ranges.
  3. The downloaded file is encrypted at rest using AES-256-GCM. The encryption key is derived per device and stored in the Android Keystore / iOS Keychain.
  4. Playback utilizes a native Flutter platform-channel ExoPlayer `EncryptedFileDataSource` or streaming decryption into the player controller.

---

## Consequences

### Positive
- Zero risk of socket port conflicts or local HTTP loopback crashes during battery-saver mode.
- Simple, atomic file integrity verification (SHA-256 checksum in download manifest).
- Resumable downloads work reliably on unstable 3G networks using standard HTTP `Range` headers.
- Dramatically faster file I/O on low-end Android storage (no inode spam).

### Negative / Trade-offs
- Offline files cannot dynamically adapt bitrate mid-playback (not required once downloaded, as the file is already stored locally).
- Server/Cloudinary must generate MP4 renditions alongside HLS manifests during video processing (handled via Cloudinary eager transformations).
