# EduLanka Mobile Application — Production Release Checklist

This guide provides the mandatory deployment and configuration checklist for publishing release builds of the EduLanka Flutter mobile application (`apps/mobile`) to Google Play Store and Apple App Store.

---

## 1. Firebase Cloud Messaging (FCM) & Push Credentials

FCM HTTP v1 powers background sync triggers, emergency closure notifications, and offline Disaster Pack pushes.

### Android
- **File target**: `apps/mobile/android/app/google-services.json`
- **Source**: Firebase Console &rarr; Project Settings &rarr; General &rarr; Your Apps &rarr; Android App (`lk.edulanka.mobile`).
- **Security**: This file is excluded from Git tracking via `.gitignore`. In CI/CD, decode it from base64 secret `FIREBASE_GOOGLE_SERVICES_JSON_BASE64`:
  ```bash
  echo "$FIREBASE_GOOGLE_SERVICES_JSON_BASE64" | base64 -d > apps/mobile/android/app/google-services.json
  ```

### iOS
- **File target**: `apps/mobile/ios/Runner/GoogleService-Info.plist`
- **Source**: Firebase Console &rarr; Project Settings &rarr; General &rarr; Your Apps &rarr; iOS App (`lk.edulanka.mobile`).
- **Security**: Decoded in CI/CD from `FIREBASE_GOOGLE_SERVICES_INFO_PLIST_BASE64`.

### Server-Side (API)
- **FCM Service Account Key**: Provide `FIREBASE_SERVICE_ACCOUNT_JSON` or individual Firebase credentials in `apps/api/.env` (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).

---

## 2. Android App Signing & Keystore

Release Android App Bundles (`.aab`) must be signed with the production upload key.

### A. Keystore Generation (One-Time)
```bash
keytool -genkey -v -keystore edulanka-release.keystore \
  -alias edulanka-release \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype JKS
```

### B. `android/key.properties` Structure
Create `apps/mobile/android/key.properties` (never commit this file):
```properties
storePassword=<KEYSTORE_PASSWORD>
keyPassword=<KEY_PASSWORD>
keyAlias=edulanka-release
storeFile=/path/to/edulanka-release.keystore
```

### C. CI/CD Environment Secrets
Configure the following secrets in your CI runner (e.g., GitHub Secrets):
- `ANDROID_KEYSTORE_BASE64`: Base64-encoded binary content of `edulanka-release.keystore`
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Keystore alias (`edulanka-release`)
- `ANDROID_KEY_PASSWORD`: Key password

---

## 3. Database Encryption & Master Key Security (ADR-005)

EduLanka utilizes Drift backed by SQLCipher (`sqlcipher_flutter_libs`) for complete local database encryption.

### Production Constraints
- **NO Compile-time Static Keys**: `--dart-define=ENCRYPTION_KEY=...` must **NEVER** be specified in release builds.
- **Hardware Secure Enclave**: In release builds (`kReleaseMode == true`), `EncryptionKeyStorage` enforces generation and storage of device-unique 256-bit AES master passphrases within Android Keystore (via EncryptedSharedPreferences) and iOS Keychain (`KeychainAccessibility.first_unlock`).
- **PRAGMA Formatting**: SQLCipher database keys are formatted as 256-bit raw hex literals (`x'...'`) or escaped string literals to avoid syntax corruption or quote injection.

---

## 4. Pre-Flight Build Commands

Run the full automated verification suite prior to tagging a release:

```bash
# 1. Clean and fetch dependencies
cd apps/mobile
flutter clean
flutter pub get

# 2. Static analysis
flutter analyze lib/

# 3. Unit, Drift SQLCipher, and sync test suite
flutter test

# 4. Build Release Android App Bundle
flutter build appbundle --release \
  --dart-define=API_BASE_URL=https://api.edulanka.lk \
  --dart-define=SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# 5. Build Release iOS Archive
flutter build ipa --release \
  --dart-define=API_BASE_URL=https://api.edulanka.lk \
  --dart-define=SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

---

## 5. Post-Build Smoke Test Checklist

Before promoting to open production tracks:
1. **Fresh Install / First Run**: Launch APK/AAB on an Android 13+ device and iOS 16+ device.
2. **Keystore / Keychain Verification**: Confirm user login succeeds and SQLite database encrypts without crashing.
3. **Disaster Pack Offline Cache**: Turn on Airplane mode. Verify that cached emergency contacts and local evacuation shelters are readable.
4. **Offline Outbox Replay**: Create an attendance mark and blog comment in Airplane mode. Reconnect Wi-Fi and verify automatic sync to server.
5. **Push Notifications**: Trigger test broadcast from school admin dashboard and verify heads-up notification receipt.
