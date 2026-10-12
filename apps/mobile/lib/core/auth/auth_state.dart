import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  Future<void> setAuthenticated({
    required String accessToken,
    required String refreshToken,
    required String tenantId,
    required String role,
    required String userId,
  }) async {
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
    await tokenStorage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthNotifier(tokenStorage: tokenStorage);
});
