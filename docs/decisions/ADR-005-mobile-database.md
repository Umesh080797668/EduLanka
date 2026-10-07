# ADR-005: Mobile Encrypted Database — Drift with SQLCipher

- **Status:** Accepted
- **Date:** 2026-10-07
- **Deciders:** Core Engineering Team, Mobile Lead, Security Lead
- **Related Phase:** Phase 3 — Sprint 0 (P3-S0), Sprint 1 (P3-S1), Sprint 2 (P3-S2)

---

## Context

EduLanka caches educational records, offline attendance, chat messages, and student homework on mobile devices. Storing this data unencrypted on local device storage violates student data privacy requirements and exposes sensitive school information on lost, stolen, or shared phones.

We evaluated two local database approaches:
1. **sqflite / sqflite_sqlcipher:** Raw SQL strings, manual object mapping, lacks type safety and automatic schema migration helpers.
2. **Drift (formerly Moor) with SQLCipher (`sqlcipher_flutter_libs`):** Strongly typed Dart DSL, compile-time query verification, automatic reactive streams (`watch()`), migration APIs, and transparent 256-bit AES encryption.

---

## Decision

We adopt **Drift with SQLCipher via `sqlcipher_flutter_libs`**, securing the encryption key via **`flutter_secure_storage`** (backed by Android Keystore and iOS Keychain).

### Architecture & Key Lifecycle:

1. **Key Generation & Storage:**
   - On first application launch, the app generates a cryptographically secure 256-bit passphrase using `Random.secure()`.
   - The passphrase is saved via `flutter_secure_storage`:
     - **Android:** Encrypted with Android Keystore master key (using AES-GCM / EncryptedSharedPreferences).
     - **iOS:** Saved to iOS Keychain with `kSecAttrAccessibleAfterFirstUnlock`.
2. **Database Initialization:**
   ```dart
   LazyDatabase _openConnection(String encryptionKey) {
     return LazyDatabase(() async {
       final dbFolder = await getApplicationDocumentsDirectory();
       final file = File(p.join(dbFolder.path, 'edulanka_encrypted.db'));
       return NativeDatabase.createInBackground(
         file,
         setup: (rawDb) {
           rawDb.execute("PRAGMA key = '$encryptionKey';");
           rawDb.execute('PRAGMA cipher_memory_security = ON;');
         },
       );
     });
   }
   ```
3. **Reactive Query Streams:**
   - All queries expose auto-updating streams: `select(attendanceTable).watch()`.
   - Connected directly to Riverpod providers.

---

## Consequences

### Positive
- Military-grade 256-bit AES encryption at rest for all local student/school data.
- Compile-time SQL safety: Syntax and column type errors are caught during build time.
- Automatic reactive streams update the UI instantly when outbox items sync or new events commit.
- Clean database migrations using Drift's schema migration tooling.

### Trade-offs
- Native binary size increase of ~3–4 MB due to bundled SQLCipher C libraries.
- Cryptographic key recovery: If a device is factory reset or Keychain corrupted, local offline cache is lost and re-hydrated from the server upon re-login.
