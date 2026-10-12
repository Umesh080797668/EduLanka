import 'package:flutter_secure_storage/flutter_secure_storage.dart';

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

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
