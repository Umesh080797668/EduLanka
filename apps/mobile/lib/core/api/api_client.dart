import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/token_storage.dart';

class ApiClient {
  late final Dio dio;
  final TokenStorage tokenStorage;
  final String baseUrl;

  ApiClient({
    required this.tokenStorage,
    String? baseUrl,
  }) : baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_BASE_URL',
              defaultValue: 'http://10.0.2.2:8081/api/v1',
            ) {
    dio = Dio(BaseOptions(
      baseUrl: this.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStorage.getAccessToken();
          final tenantId = await tokenStorage.getTenantId();

          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          if (tenantId != null && tenantId.isNotEmpty) {
            options.headers['X-Tenant-Id'] = tenantId;
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401 &&
              !error.requestOptions.path.contains('/auth/login') &&
              !error.requestOptions.path.contains('/auth/refresh')) {
            // Attempt auto refresh
            final refreshToken = await tokenStorage.getRefreshToken();
            if (refreshToken != null) {
              try {
                final refreshRes = await dio.post(
                  '/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                final data = refreshRes.data is Map && refreshRes.data.containsKey('data')
                    ? refreshRes.data['data']
                    : refreshRes.data;

                final newAccess = data?['accessToken'];

                if (newAccess != null) {
                  final tenantId = await tokenStorage.getTenantId() ?? '';
                  final role = await tokenStorage.getUserRole() ?? '';
                  final userId = await tokenStorage.getUserId() ?? '';

                  await tokenStorage.saveTokens(
                    accessToken: newAccess,
                    refreshToken: refreshToken,
                    tenantId: tenantId,
                    role: role,
                    userId: userId,
                  );

                  // Retry original request
                  error.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
                  final retryRes = await dio.fetch(error.requestOptions);
                  return handler.resolve(retryRes);
                }
              } catch (_) {
                await tokenStorage.clearAll();
              }
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
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is Map) {
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
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> getSyncEvents({int since = 0, int limit = 50}) async {
    final response = await dio.get(
      '/mobile/sync-events',
      queryParameters: {'since': since, 'limit': limit},
    );
    final rawData = response.data;
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> getSnapshot() async {
    final response = await dio.get('/mobile/snapshot');
    final rawData = response.data;
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is Map) {
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
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<List<dynamic>> getEmergencyContacts() async {
    final response = await dio.get('/mobile/emergency-contacts');
    final rawData = response.data;
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }

  Future<List<dynamic>> getShelters() async {
    final response = await dio.get('/mobile/shelters');
    final rawData = response.data;
    if (rawData is Map && rawData.containsKey('data') && rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  return ApiClient(tokenStorage: tokenStorage);
});
