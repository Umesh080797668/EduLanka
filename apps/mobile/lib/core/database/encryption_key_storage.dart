import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class EncryptionKeyStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );
  static const _keyName = 'edulanka_sqlcipher_key';

  static String? _cachedKey;

  /// Retrieves or cryptographically generates a 256-bit AES encryption passphrase (ADR-005).
  /// In debug/test environments, configuredKey or compile-time ENCRYPTION_KEY can be used.
  /// In production release mode, keys are strictly generated and retrieved from hardware secure storage.
  static Future<String> getOrCreateKey({String? configuredKey}) async {
    if (_cachedKey != null && _cachedKey!.isNotEmpty) {
      return _cachedKey!;
    }

    // In release mode, compile-time static keys are strictly disallowed to prevent
    // baking a single shared master key into the compiled client binary.
    if (kReleaseMode) {
      const envKey = String.fromEnvironment('ENCRYPTION_KEY', defaultValue: '');
      if (envKey.isNotEmpty) {
        throw StateError(
          'SECURITY VIOLATION: Compile-time ENCRYPTION_KEY must never be baked into release builds. '
          'Keys must be hardware-backed via secure storage (ADR-005).',
        );
      }
      if (configuredKey != null && configuredKey.isNotEmpty) {
        throw StateError(
          'SECURITY VIOLATION: Injected configuredKey is prohibited in release builds.',
        );
      }
    } else {
      if (configuredKey != null && configuredKey.isNotEmpty) {
        _cachedKey = configuredKey;
        return configuredKey;
      }

      const envKey = String.fromEnvironment('ENCRYPTION_KEY', defaultValue: '');
      if (envKey.isNotEmpty) {
        _cachedKey = envKey;
        return envKey;
      }
    }

    try {
      String? key = await _storage.read(key: _keyName);
      if (key == null || key.isEmpty) {
        final random = Random.secure();
        final bytes = List<int>.generate(32, (_) => random.nextInt(256));
        key = base64UrlEncode(bytes);
        await _storage.write(key: _keyName, value: key);
      }
      _cachedKey = key;
      return key;
    } catch (_) {
      if (kReleaseMode) {
        rethrow;
      }
      // Fallback for test/headless runner environments where native secure storage mock is absent
      if (_cachedKey == null) {
        final random = Random.secure();
        final bytes = List<int>.generate(32, (_) => random.nextInt(256));
        _cachedKey = base64UrlEncode(bytes);
      }
      return _cachedKey!;
    }
  }

  static Future<void> clearKey() async {
    _cachedKey = null;
    try {
      await _storage.delete(key: _keyName);
    } catch (_) {}
  }

  static void setMockKey(String mockKey) {
    _cachedKey = mockKey;
  }
}
