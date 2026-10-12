import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/token_storage.dart';
import '../auth/auth_state.dart';
import '../config/app_config.dart';

class ApiClient {
  late final Dio dio;
  late final Dio _refreshDio;
  final TokenStorage tokenStorage;
  final String baseUrl;
  final void Function()? onSessionExpired;

  Completer<String?>? _refreshCompleter;

  ApiClient({
    required this.tokenStorage,
    required this.baseUrl,
    this.onSessionExpired,
  }) {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    // Dedicated unintercepted Dio instance for /auth/refresh to eliminate interceptor loops
    _refreshDio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          // The API strictly scopes tenant access from the validated JWT claim
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          final is401 = error.response?.statusCode == 401;
          final isAuthPath = error.requestOptions.path.contains('/auth/login') ||
              error.requestOptions.path.contains('/auth/refresh');

          if (is401 && !isAuthPath) {
            // Concurrency lock: If a refresh is already in-flight, await its completion
            if (_refreshCompleter != null) {
              final newAccess = await _refreshCompleter!.future;
              if (newAccess != null && newAccess.isNotEmpty) {
                error.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
                try {
                  final retryRes = await dio.fetch(error.requestOptions);
                  return handler.resolve(retryRes);
                } catch (retryErr) {
                  return handler.next(error);
                }
              } else {
                return handler.next(error);
              }
            }

            _refreshCompleter = Completer<String?>();

            final refreshToken = await tokenStorage.getRefreshToken();
            if (refreshToken != null && refreshToken.isNotEmpty) {
              try {
                // Route refresh through unintercepted Dio instance
                final refreshRes = await _refreshDio.post(
                  '/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                final data =
                    refreshRes.data is Map &&
                        refreshRes.data.containsKey('data')
                    ? refreshRes.data['data']
                    : refreshRes.data;

                final newAccess = data?['accessToken'] as String?;
                // Crucial: Rotate and store the NEW refresh token returned by backend
                final newRefresh = data?['refreshToken'] as String? ?? refreshToken;

                if (newAccess != null && newAccess.isNotEmpty) {
                  final tenantId = await tokenStorage.getTenantId() ?? '';
                  final role = await tokenStorage.getUserRole() ?? '';
                  final userId = await tokenStorage.getUserId() ?? '';

                  await tokenStorage.saveTokens(
                    accessToken: newAccess,
                    refreshToken: newRefresh,
                    tenantId: tenantId,
                    role: role,
                    userId: userId,
                  );

                  _refreshCompleter?.complete(newAccess);
                  _refreshCompleter = null;

                  // Retry original request with newly minted access token
                  error.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
                  final retryRes = await dio.fetch(error.requestOptions);
                  return handler.resolve(retryRes);
                } else {
                  throw Exception('Invalid token payload in refresh response');
                }
              } catch (_) {
                _refreshCompleter?.complete(null);
                _refreshCompleter = null;
                await tokenStorage.clearAll();
                onSessionExpired?.call();
              }
            } else {
              _refreshCompleter?.complete(null);
              _refreshCompleter = null;
              await tokenStorage.clearAll();
              onSessionExpired?.call();
            }
          }
          return handler.next(error);
        },
      ),
    );
  }

  // ── Authentication ──────────────────────────────────────────────────

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    String? tenantId,
  }) async {
    final payload = <String, dynamic>{
      'identifier': identifier,
      'password': password,
    };
    if (tenantId != null && tenantId.trim().isNotEmpty) {
      payload['tenantId'] = tenantId.trim();
    }

    final response = await dio.post('/auth/login', data: payload);
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    throw Exception('Unexpected response format from server');
  }

  // ── Mobile Sync Operations (ADR-002) ────────────────────────────────

  Future<Map<String, dynamic>> appendSyncEvent({
    required String clientUuid,
    required String entityType,
    required String entityId,
    required String eventType,
    required Map<String, dynamic> payload,
  }) async {
    final response = await dio.post(
      '/mobile/sync-events',
      data: {
        'clientUuid': clientUuid,
        'entityType': entityType,
        'entityId': entityId,
        'eventType': eventType,
        'payload': payload,
      },
    );
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> getSyncEvents({
    int since = 0,
    int limit = 50,
  }) async {
    final response = await dio.get(
      '/mobile/sync-events',
      queryParameters: {'since': since, 'limit': limit},
    );
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> getSnapshot() async {
    final response = await dio.get('/mobile/snapshot');
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  // ── Disaster Pack & Emergency Operations (P3-S8) ────────────────────

  Future<Map<String, dynamic>> getDisasterPack() async {
    final response = await dio.get('/mobile/disaster-pack');
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<List<dynamic>> getEmergencyContacts() async {
    final response = await dio.get('/mobile/emergency-contacts');
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }

  Future<List<dynamic>> getShelters() async {
    final response = await dio.get('/mobile/shelters');
    final rawData = response.data;
    if (rawData is Map &&
        rawData.containsKey('data') &&
        rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final config = ref.watch(appConfigProvider);
  return ApiClient(
    tokenStorage: tokenStorage,
    baseUrl: config.apiBaseUrl,
    onSessionExpired: () => ref.read(authProvider.notifier).logout(),
  );
});
