import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum Environment {
  development,
  staging,
  production;

  bool get isProduction => this == Environment.production;
  bool get isDevelopment => this == Environment.development;
}

/// Centralized, immutable application environment configuration.
/// Values are injected at compile time via `--dart-define` or `--dart-define-from-file`.
class AppConfig {
  final Environment environment;
  final String apiBaseUrl;
  final String wsBaseUrl;
  final String? sentryDsn;

  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    this.sentryDsn,
  });

  factory AppConfig.fromEnvironment() {
    const envString = String.fromEnvironment('APP_ENV', defaultValue: '');
    const injectedApiUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
    const injectedWsUrl = String.fromEnvironment('WS_BASE_URL', defaultValue: '');
    const injectedSentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');

    // Determine environment tier
    final Environment env;
    if (envString == 'production' || (kReleaseMode && envString != 'staging' && envString != 'development')) {
      env = Environment.production;
    } else if (envString == 'staging') {
      env = Environment.staging;
    } else {
      env = Environment.development;
    }

    // Determine API Base URL
    final String apiBaseUrl;
    if (injectedApiUrl.isNotEmpty) {
      apiBaseUrl = injectedApiUrl;
    } else if (env.isProduction) {
      // In production, fallback to production API gateway domain
      apiBaseUrl = 'https://api.edulanka.lk/v1';
    } else {
      // Local development default (Android emulator host loopback)
      apiBaseUrl = 'http://10.0.2.2:8081/api/v1';
    }

    // Determine Realtime WebSocket URL
    final String wsBaseUrl;
    if (injectedWsUrl.isNotEmpty) {
      wsBaseUrl = injectedWsUrl;
    } else {
      // Automatically derive wss:// or ws:// from apiBaseUrl
      wsBaseUrl = apiBaseUrl
          .replaceFirst('https://', 'wss://')
          .replaceFirst('http://', 'ws://')
          .replaceAll('/api/v1', '/ws')
          .replaceAll('/v1', '/ws');
    }

    return AppConfig(
      environment: env,
      apiBaseUrl: apiBaseUrl,
      wsBaseUrl: wsBaseUrl,
      sentryDsn: injectedSentryDsn.isNotEmpty ? injectedSentryDsn : null,
    );
  }
}

final appConfigProvider = Provider<AppConfig>((ref) {
  return AppConfig.fromEnvironment();
});
