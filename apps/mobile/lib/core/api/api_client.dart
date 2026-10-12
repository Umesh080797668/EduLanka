import 'package:dio/dio.dart';
import '../auth/token_storage.dart';

class ApiClient {
  late final Dio dio;
  final TokenStorage tokenStorage;

  ApiClient({
    required this.tokenStorage,
    String baseUrl = 'http://10.0.2.2:8081/api/v1',
  }) {
    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
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
          if (tenantId != null) {
            options.headers['X-Tenant-Id'] = tenantId;
          }
          return handler.next(options);
        },
        onError: (DioException error, handler) async {
          if (error.response?.statusCode == 401) {
            // Attempt auto refresh
            final refreshToken = await tokenStorage.getRefreshToken();
            if (refreshToken != null) {
              try {
                final refreshRes = await dio.post(
                  '/auth/refresh',
                  data: {'refreshToken': refreshToken},
                );

                final newAccess = refreshRes.data['data']?['accessToken'] ??
                    refreshRes.data['accessToken'];

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
}
