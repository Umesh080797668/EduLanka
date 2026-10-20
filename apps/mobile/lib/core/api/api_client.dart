import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform, File;
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
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
  final void Function(Map<String, dynamic>? data)? onUpgradeRequired;
  final void Function(String newPlan)? onPlanUpdated;
  final String? appVersion;

  Completer<String?>? _refreshCompleter;

  ApiClient({
    required this.tokenStorage,
    required this.baseUrl,
    this.onSessionExpired,
    this.onUpgradeRequired,
    this.onPlanUpdated,
    this.appVersion,
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
          final clientVersion =
              appVersion ??
              const String.fromEnvironment(
                'APP_VERSION',
                defaultValue: '1.1.0',
              );
          final clientPlatform = kIsWeb
              ? 'web'
              : (Platform.isIOS ? 'ios' : 'android');
          options.headers['X-Client-Version'] = clientVersion;
          options.headers['X-Client-Platform'] = clientPlatform;
          final deviceId = await tokenStorage.getOrCreateDeviceId();
          options.headers['X-Device-Id'] = deviceId;
          // The API strictly scopes tenant access from the validated JWT claim
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          // Handle 426 Upgrade Required (P3-S4)
          if (error.response?.statusCode == 426) {
            final data = error.response?.data is Map<String, dynamic>
                ? error.response!.data as Map<String, dynamic>
                : null;
            onUpgradeRequired?.call(data);
            return handler.next(error);
          }

          final is401 = error.response?.statusCode == 401;
          final isAuthPath =
              error.requestOptions.path.contains('/auth/login') ||
              error.requestOptions.path.contains('/auth/refresh');

          if (is401 && !isAuthPath) {
            // Concurrency lock: If a refresh is already in-flight, await its completion
            if (_refreshCompleter != null) {
              final newAccess = await _refreshCompleter!.future;
              if (newAccess != null && newAccess.isNotEmpty) {
                error.requestOptions.headers['Authorization'] =
                    'Bearer $newAccess';
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
            if (refreshToken == null || refreshToken.isEmpty) {
              _refreshCompleter?.complete(null);
              _refreshCompleter = null;
              await tokenStorage.clearAll();
              onSessionExpired?.call();
              return handler.next(error);
            }

            String? newAccess;
            String? newRefresh;
            bool refreshSucceeded = false;
            bool isAuthRejection = false;

            dynamic refreshPayload;
            try {
              // Route refresh through unintercepted Dio instance
              final refreshRes = await _refreshDio.post(
                '/auth/refresh',
                data: {'refreshToken': refreshToken},
              );

              refreshPayload =
                  refreshRes.data is Map && refreshRes.data.containsKey('data')
                  ? refreshRes.data['data']
                  : refreshRes.data;

              newAccess = refreshPayload?['accessToken'] as String?;
              newRefresh =
                  refreshPayload?['refreshToken'] as String? ?? refreshToken;

              if (newAccess != null && newAccess.isNotEmpty) {
                refreshSucceeded = true;
              }
            } on DioException catch (refreshErr) {
              final status = refreshErr.response?.statusCode;
              // Only 401 Unauthorized or 403 Forbidden indicates an expired/invalidated session
              if (status == 401 || status == 403) {
                isAuthRejection = true;
              }
              // Network connectivity errors or 5xx server issues MUST NOT log out offline users!
            } catch (_) {
              // Unknown client-side error
            }

            if (refreshSucceeded && newAccess != null) {
              final tenantId = await tokenStorage.getTenantId() ?? '';
              final role = await tokenStorage.getUserRole() ?? '';
              final userId = await tokenStorage.getUserId() ?? '';

              String? refreshedPlan = refreshPayload is Map
                  ? refreshPayload['tenantPlan'] as String?
                  : null;
              if (refreshedPlan == null || refreshedPlan.isEmpty) {
                try {
                  final parts = newAccess.split('.');
                  if (parts.length == 3) {
                    final normalized = base64.normalize(parts[1]);
                    final payloadJson = utf8.decode(
                      base64Url.decode(normalized),
                    );
                    final payload = jsonDecode(payloadJson);
                    if (payload is Map && payload['tenantPlan'] is String) {
                      refreshedPlan = payload['tenantPlan'] as String;
                    }
                  }
                } catch (_) {}
              }
              refreshedPlan ??= await tokenStorage.getTenantPlan();

              await tokenStorage.saveTokens(
                accessToken: newAccess,
                refreshToken: newRefresh ?? refreshToken,
                tenantId: tenantId,
                role: role,
                userId: userId,
                tenantPlan: refreshedPlan,
              );

              if (refreshedPlan != null && refreshedPlan.isNotEmpty) {
                onPlanUpdated?.call(refreshedPlan);
              }

              _refreshCompleter?.complete(newAccess);
              _refreshCompleter = null;

              // Retry original request in an isolated try/catch:
              // Failure of the retried request MUST NEVER clear tokens or log the user out!
              try {
                error.requestOptions.headers['Authorization'] =
                    'Bearer $newAccess';
                final retryRes = await dio.fetch(error.requestOptions);
                return handler.resolve(retryRes);
              } catch (retryErr) {
                return handler.next(error);
              }
            } else {
              _refreshCompleter?.complete(null);
              _refreshCompleter = null;

              // Only clear tokens and trigger logout if the server actively rejected the refresh token
              if (isAuthRejection) {
                await tokenStorage.clearAll();
                onSessionExpired?.call();
              }
              return handler.next(error);
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

  // ── S6 Offline Video Download Manifest (ADR-001, P3-S6) ─────────────

  Future<Map<String, dynamic>> getDownloadManifest(String assetId) async {
    final response = await dio.get('/media/$assetId/download-manifest');
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

  // ── Push Device Token Registration (ADR-003, P3-S4) ─────────────────

  Future<void> registerDeviceToken({
    required String token,
    required String platform,
    String? deviceModel,
  }) async {
    await dio.post(
      '/mobile/device-token',
      data: {'token': token, 'platform': platform, 'deviceModel': deviceModel},
    );
  }

  // ── Homework Flow (P3-S3) ──────────────────────────────────────────

  Future<List<dynamic>> getHomeworkTasks({String? classId}) async {
    final response = await dio.get(
      '/homework',
      queryParameters: classId != null ? {'classId': classId} : null,
    );
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> getClasses({String? teacherId}) async {
    final response = await dio.get(
      '/classes',
      queryParameters: teacherId != null ? {'teacherId': teacherId} : null,
    );
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return (rawData['data'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } else if (rawData is List) {
      return rawData.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> getClass(String id) async {
    final response = await dio.get('/classes/$id');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> createHomeworkTask(
    Map<String, dynamic> data,
  ) async {
    final response = await dio.post('/homework', data: data);
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> getHomeworkTask(String id) async {
    final response = await dio.get('/homework/$id');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<Map<String, dynamic>> submitHomework(
    String id,
    Map<String, dynamic> data,
  ) async {
    final response = await dio.post('/homework/$id/submit', data: data);
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  Future<List<dynamic>> getHomeworkSubmissions(String id) async {
    final response = await dio.get('/homework/$id/submissions');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }

  Future<Map<String, dynamic>> gradeHomeworkSubmission(
    String id,
    Map<String, dynamic> data,
  ) async {
    final response = await dio.patch(
      '/homework/submissions/$id/grade',
      data: data,
    );
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  // ── Chat Realtime & Messages ───────────────────────────────────────

  Future<List<dynamic>> getConversations() async {
    final response = await dio.get('/chat/conversations');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }

  Future<List<dynamic>> getConversationMessages(String conversationId) async {
    final response = await dio.get(
      '/chat/conversations/$conversationId/messages',
    );
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return rawData['data'] as List<dynamic>;
    } else if (rawData is List) {
      return rawData;
    }
    return [];
  }

  Future<Map<String, dynamic>> sendChatMessage(
    String conversationId,
    String content,
  ) async {
    final response = await dio.post(
      '/chat/conversations/$conversationId/messages',
      data: {'content': content},
    );
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  // ── Media & Curriculum Lessons (P3-S5, P3-S6) ──────────────────────────

  Future<Map<String, dynamic>> getMediaAssets({
    int page = 1,
    int limit = 20,
    String? subject,
    int? gradeLevel,
  }) async {
    final response = await dio.get(
      '/media',
      queryParameters: {
        'page': page,
        'limit': limit,
        if (subject != null && subject.isNotEmpty) 'subject': subject,
        'gradeLevel': ?gradeLevel,
      },
    );
    final rawData = response.data;
    if (rawData is Map<String, dynamic>) {
      return rawData;
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {'data': [], 'count': 0};
  }

  Future<Map<String, dynamic>> getMediaAssetById(String id) async {
    final response = await dio.get('/media/$id');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  // ── Past Paper Hub & Schemes (P3-S7) ──────────────────────────────────

  Future<Map<String, dynamic>> getPapers({
    int page = 1,
    int limit = 20,
    String? subject,
    int? gradeLevel,
    String? examType,
    String? medium,
    int? year,
  }) async {
    final response = await dio.get(
      '/papers',
      queryParameters: {
        'page': page,
        'limit': limit,
        if (subject != null && subject.isNotEmpty) 'subject': subject,
        'gradeLevel': ?gradeLevel,
        if (examType != null && examType.isNotEmpty) 'examType': examType,
        if (medium != null && medium.isNotEmpty) 'medium': medium,
        'year': ?year,
      },
    );
    final rawData = response.data;
    if (rawData is Map<String, dynamic>) {
      return rawData;
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {'data': [], 'count': 0};
  }

  Future<Map<String, dynamic>> getPaperById(String id) async {
    final response = await dio.get('/papers/$id');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is Map) {
      return Map<String, dynamic>.from(rawData['data']);
    } else if (rawData is Map) {
      return Map<String, dynamic>.from(rawData);
    }
    return {};
  }

  // ── School Notices & Scoped Announcements ─────────────────────────

  Future<List<Map<String, dynamic>>> getNotices({
    String? classId,
    int? gradeLevel,
  }) async {
    final response = await dio.get(
      '/notices',
      queryParameters: {
        if (classId != null && classId.isNotEmpty) 'classId': classId,
        'gradeLevel': ?gradeLevel,
      },
    );
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return (rawData['data'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } else if (rawData is List) {
      return rawData.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  // ── Student Marks & Term Report Cards ──────────────────────────────

  Future<Map<String, dynamic>?> getStudentMe() async {
    try {
      final response = await dio.get('/students/me');
      final rawData = response.data;
      if (rawData is Map && rawData['data'] is Map) {
        return Map<String, dynamic>.from(rawData['data']);
      } else if (rawData is Map) {
        return Map<String, dynamic>.from(rawData);
      }
    } catch (_) {}
    return null;
  }

  Future<Map<String, dynamic>?> getParentMe() async {
    try {
      final response = await dio.get('/parents/me');
      final rawData = response.data;
      if (rawData is Map && rawData['data'] is Map) {
        return Map<String, dynamic>.from(rawData['data']);
      } else if (rawData is Map) {
        return Map<String, dynamic>.from(rawData);
      }
    } catch (_) {}
    return null;
  }

  Future<List<Map<String, dynamic>>> getStudentMarks(String studentId) async {
    final response = await dio.get('/student-marks/student/$studentId');
    final rawData = response.data;
    if (rawData is Map && rawData['data'] is List) {
      return (rawData['data'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    } else if (rawData is List) {
      return rawData.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  Future<List<int>> downloadReportCard({
    required String studentId,
    required int term,
    required int year,
  }) async {
    final response = await dio.get<List<int>>(
      '/report-cards/student/$studentId/term/$term/year/$year/download',
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? [];
  }

  // ── Media & Attachment Upload ───────────────────────────────────────

  Future<String> uploadAttachment({
    required String filePath,
    String? fileName,
  }) async {
    final file = File(filePath);
    if (!await file.exists()) {
      throw Exception('File does not exist at $filePath');
    }

    // 1. Fetch Cloudinary signed upload token from backend (quota enforced)
    final sigRes = await dio.get(
      '/upload/signature',
      queryParameters: {'folderType': 'attachments'},
    );
    final rawSig = sigRes.data;
    final sig = rawSig is Map && rawSig['data'] is Map
        ? Map<String, dynamic>.from(rawSig['data'])
        : (rawSig is Map
              ? Map<String, dynamic>.from(rawSig)
              : <String, dynamic>{});

    final cloudName = sig['cloudName']?.toString();
    if (cloudName == null || cloudName.isEmpty) {
      throw StateError('Missing cloudName in upload signature response');
    }
    final apiKey = sig['apiKey']?.toString() ?? '';
    final timestamp = sig['timestamp']?.toString() ?? '';
    final signature = sig['signature']?.toString() ?? '';
    final folder = sig['folder']?.toString() ?? '';
    final uploadPreset = sig['uploadPreset']?.toString();
    final allowedFormats = sig['allowedFormats']?.toString();

    // Validate format against allowed formats
    if (allowedFormats != null && allowedFormats.isNotEmpty) {
      final ext = file.path.split('.').last.toLowerCase();
      final allowedList = allowedFormats
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .toList();
      if (!allowedList.contains(ext)) {
        throw FormatException(
          'Unsupported file format .$ext. Allowed formats: $allowedFormats',
        );
      }
    }

    // 2. Direct device-to-Cloudinary signed upload
    final uploadDio = Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
      ),
    );

    final resolvedFileName = fileName ?? file.uri.pathSegments.last;
    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        filePath,
        filename: resolvedFileName,
      ),
      'api_key': apiKey,
      'timestamp': timestamp,
      'signature': signature,
      'folder': folder,
      if (allowedFormats != null && allowedFormats.isNotEmpty)
        'allowed_formats': allowedFormats,
      if (uploadPreset != null && uploadPreset.isNotEmpty)
        'upload_preset': uploadPreset,
    });

    final uploadRes = await uploadDio.post(
      'https://api.cloudinary.com/v1_1/$cloudName/auto/upload',
      data: formData,
    );

    if (uploadRes.statusCode != null &&
        uploadRes.statusCode! >= 200 &&
        uploadRes.statusCode! < 300) {
      final resData = uploadRes.data;
      if (resData is Map && resData['secure_url'] != null) {
        return resData['secure_url'].toString();
      }
      if (resData is Map && resData['url'] != null) {
        return resData['url'].toString();
      }
    }
    throw Exception('Failed to upload attachment to media storage');
  }
}

final apiClientProvider = Provider<ApiClient>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final config = ref.watch(appConfigProvider);
  return ApiClient(
    tokenStorage: tokenStorage,
    baseUrl: config.apiBaseUrl,
    appVersion: config.appVersion,
    onSessionExpired: () => ref.read(authProvider.notifier).logout(force: true),
    onPlanUpdated: (plan) =>
        ref.read(authProvider.notifier).updateTenantPlan(plan),
  );
});
