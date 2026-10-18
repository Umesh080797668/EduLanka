import 'package:flutter/material.dart';
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
  final String? tenantPlan;

  const AuthState({
    required this.status,
    this.role,
    this.tenantId,
    this.userId,
    this.tenantPlan,
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
    final tenantPlan = await tokenStorage.getTenantPlan();

    if (token != null && role != null) {
      state = AuthState(
        status: AuthStatus.authenticated,
        role: role.toUpperCase(),
        tenantId: tenantId,
        userId: userId,
        tenantPlan: tenantPlan,
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
    final resolvedTenantPlan = user['tenantPlan']?.toString() ??
        user['plan']?.toString() ??
        user['tenant']?['plan']?.toString();

    await setAuthenticated(
      accessToken: accessToken,
      refreshToken: refreshToken,
      tenantId: resolvedTenantId,
      role: role,
      userId: userId,
      tenantPlan: resolvedTenantPlan,
    );
  }

  Future<void> setAuthenticated({
    required String accessToken,
    required String refreshToken,
    required String tenantId,
    required String role,
    required String userId,
    String? tenantPlan,
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
      tenantPlan: tenantPlan,
    );

    state = AuthState(
      status: AuthStatus.authenticated,
      role: role.toUpperCase(),
      tenantId: tenantId,
      userId: userId,
      tenantPlan: tenantPlan,
    );
  }

  Future<void> logout({bool force = false}) async {
    if (!force) {
      final pendingCount = await LocalDatabase.instance.getPendingOutboxCount();
      if (pendingCount > 0) {
        throw StateError(
          'Cannot logout: $pendingCount unsynced changes in local outbox. Use force: true to wipe anyway.',
        );
      }
    }
    await LocalDatabase.instance.clearAll();
    await tokenStorage.clearAll();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }
}

/// Shows a warning confirmation dialog if the local outbox contains unsynced offline mutations
Future<void> showLogoutConfirmation(BuildContext context, WidgetRef ref) async {
  final pending = await LocalDatabase.instance.getPendingOutboxCount();
  if (pending > 0) {
    if (!context.mounted) return;
    final proceed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626)),
            SizedBox(width: 8),
            Text('Unsynced Changes'),
          ],
        ),
        content: Text(
          'You have $pending unsynced offline change(s) in your outbox. '
          'Logging out will wipe the local database and these changes will be lost permanently.\n\n'
          'Are you sure you want to log out?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFDC2626),
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Log Out Anyway'),
          ),
        ],
      ),
    );

    if (proceed == true) {
      await ref.read(authProvider.notifier).logout(force: true);
    }
  } else {
    await ref.read(authProvider.notifier).logout(force: true);
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return AuthNotifier(tokenStorage: tokenStorage);
});
