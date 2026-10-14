import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../database/local_database.dart';
import 'token_storage.dart';

enum AuthStatus { initial, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final String? role;
  final String? tenantId;
  final String? userId;

  const AuthState({
    required this.status,
    this.role,
    this.tenantId,
    this.userId,
  });

  bool get isAuthenticated => status == AuthStatus.authenticated;
}

class AuthNotifier extends StateNotifier<AuthState> {
  final TokenStorage tokenStorage;

  AuthNotifier({required this.tokenStorage})
    : super(const AuthState(status: AuthStatus.initial)) {
    checkInitialAuth();
  }

  Future<void> checkInitialAuth() async {
    final token = await tokenStorage.getAccessToken();
    final role = await tokenStorage.getUserRole();
    final tenantId = await tokenStorage.getTenantId();
    final userId = await tokenStorage.getUserId();

    if (token != null && role != null) {
      state = AuthState(
        status: AuthStatus.authenticated,
        role: role.toUpperCase(),
        tenantId: tenantId,
        userId: userId,
      );
    } else {
      state = const AuthState(status: AuthStatus.unauthenticated);
    }
  }

  Future<void> login({
    required String identifier,
    required String password,
    String? tenantId,
    required ApiClient apiClient,
  }) async {
    final response = await apiClient.login(
      identifier: identifier,
      password: password,
      tenantId: tenantId,
    );

    final accessToken = response['accessToken'] as String?;
    final refreshToken = response['refreshToken'] as String?;
    final user = response['user'] is Map
        ? Map<String, dynamic>.from(response['user'])
        : null;

    if (accessToken == null || refreshToken == null || user == null) {
      throw Exception('Incomplete authentication response from server');
    }

    final userId = user['id']?.toString() ?? '';
    final role = user['role']?.toString().toUpperCase() ?? 'STUDENT';
    final resolvedTenantId = user['tenantId']?.toString() ?? tenantId ?? '';

    await setAuthenticated(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tenantId: resolvedTenantId,
      role: role,
      userId: userId,
    );
  }

  Future<void> setAuthenticated({
    required String accessToken,
    required String refreshToken,
    required String tenantId,
    required String role,
    required String userId,
  }) async {
    final prevUserId = await tokenStorage.getUserId();
    final prevTenantId = await tokenStorage.getTenantId();

    // Prevent cross-user or cross-tenant sync outbox leak and state pollution
    if ((prevUserId != null && prevUserId != userId) ||
        (prevTenantId != null && prevTenantId != tenantId)) {
      await LocalDatabase.instance.clearAll();
    }

    await tokenStorage.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tenantId: tenantId,
      role: role,
      userId: userId,
    );

    state = AuthState(
      status: AuthStatus.authenticated,
      role: role.toUpperCase(),
      tenantId: tenantId,
      userId: userId,
    );
  }

  Future<void> logout() async {
    await LocalDatabase.instance.clearAll();
    await tokenStorage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthNotifier(tokenStorage: tokenStorage);
});
