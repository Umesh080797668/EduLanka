import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class TokenStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _keyAccessToken = 'edulanka_access_token';
  static const _keyRefreshToken = 'edulanka_refresh_token';
  static const _keyTenantId = 'edulanka_tenant_id';
  static const _keyUserRole = 'edulanka_user_role';
  static const _keyUserId = 'edulanka_user_id';
  static const _keyDeviceId = 'edulanka_device_id';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required String tenantId,
    required String role,
    required String userId,
  }) async {
    await Future.wait([
      _storage.write(key: _keyAccessToken, value: accessToken),
      _storage.write(key: _keyRefreshToken, value: refreshToken),
      _storage.write(key: _keyTenantId, value: tenantId),
      _storage.write(key: _keyUserRole, value: role),
      _storage.write(key: _keyUserId, value: userId),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: _keyAccessToken);
  Future<String?> getRefreshToken() => _storage.read(key: _keyRefreshToken);
  Future<String?> getTenantId() => _storage.read(key: _keyTenantId);
  Future<String?> getUserRole() => _storage.read(key: _keyUserRole);
  Future<String?> getUserId() => _storage.read(key: _keyUserId);

  Future<String> getOrCreateDeviceId() async {
    final existing = await _storage.read(key: _keyDeviceId);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    final newId = const Uuid().v4();
    await _storage.write(key: _keyDeviceId, value: newId);
    return newId;
  }

  Future<String?> getDeviceId() => _storage.read(key: _keyDeviceId);

  Future<void> clearAll() async {
    final deviceId = await _storage.read(key: _keyDeviceId);
    await _storage.deleteAll();
    if (deviceId != null) {
      await _storage.write(key: _keyDeviceId, value: deviceId);
    }
  }
}

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());
