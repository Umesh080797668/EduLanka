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
  final String? supabaseUrl;
  final String? supabaseAnonKey;
  final String? firebaseApiKey;
  final String? firebaseProjectId;
  final String? firebaseMessagingSenderId;
  final String? firebaseAppId;
  final String? encryptionKey;
  final String? offlineLicenseKeyId;
  final String? offlineLicensePublicKey;
  final String? syncfusionLicenseKey;
  final String appVersion;

  const AppConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.wsBaseUrl,
    this.appVersion = '1.1.0',
    this.sentryDsn,
    this.supabaseUrl,
    this.supabaseAnonKey,
    this.firebaseApiKey,
    this.firebaseProjectId,
    this.firebaseMessagingSenderId,
    this.firebaseAppId,
    this.encryptionKey,
    this.offlineLicenseKeyId,
    this.offlineLicensePublicKey,
    this.syncfusionLicenseKey,
  });

  factory AppConfig.fromEnvironment() {
    const envString = String.fromEnvironment('APP_ENV', defaultValue: '');
    const injectedAppVersion = String.fromEnvironment(
      'APP_VERSION',
      defaultValue: '1.1.0',
    );
    const injectedApiUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: '',
    );
    const injectedWsUrl = String.fromEnvironment(
      'WS_BASE_URL',
      defaultValue: '',
    );
    const injectedSentryDsn = String.fromEnvironment(
      'SENTRY_DSN',
      defaultValue: '',
    );
    const injectedSupabaseUrl = String.fromEnvironment(
      'SUPABASE_URL',
      defaultValue: '',
    );
    const injectedSupabaseAnonKey = String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: '',
    );
    const injectedFirebaseApiKey = String.fromEnvironment(
      'FIREBASE_API_KEY',
      defaultValue: '',
    );
    const injectedFirebaseProjectId = String.fromEnvironment(
      'FIREBASE_PROJECT_ID',
      defaultValue: '',
    );
    const injectedFirebaseSenderId = String.fromEnvironment(
      'FIREBASE_MESSAGING_SENDER_ID',
      defaultValue: '',
    );
    const injectedFirebaseAppId = String.fromEnvironment(
      'FIREBASE_APP_ID',
      defaultValue: '',
    );
    const injectedEncryptionKey = String.fromEnvironment(
      'ENCRYPTION_KEY',
      defaultValue: '',
    );
    const injectedLicenseKeyId = String.fromEnvironment(
      'OFFLINE_LICENSE_KEY_ID',
      defaultValue: '',
    );
    const injectedLicensePublicKey = String.fromEnvironment(
      'OFFLINE_LICENSE_PUBLIC_KEY',
      defaultValue: '',
    );
    const injectedSyncfusionLicense = String.fromEnvironment(
      'SYNCFUSION_LICENSE_KEY',
      defaultValue: '',
    );

    // Determine environment tier
    final Environment env;
    if (envString == 'production' ||
        (kReleaseMode &&
            envString != 'staging' &&
            envString != 'development')) {
      env = Environment.production;
    } else if (envString == 'staging') {
      env = Environment.staging;
    } else {
      env = Environment.development;
    }

    // Determine API Base URL strictly from injected configuration
    final String apiBaseUrl;
    if (injectedApiUrl.isNotEmpty) {
      apiBaseUrl = injectedApiUrl;
    } else if (kReleaseMode || env.isProduction) {
      throw StateError(
        'SECURITY EXCEPTION: API_BASE_URL must be injected via build configuration '
        '(--dart-define-from-file=config.json or --dart-define=API_BASE_URL=...). '
        'Hardcoding production endpoints in source code is prohibited.',
      );
    } else {
      // Safe local development loopback for emulator and testing harnesses only
      apiBaseUrl = 'http://10.0.2.2:8081/api/v1';
    }

    if ((kReleaseMode || env.isProduction) &&
        !apiBaseUrl.startsWith('https://')) {
      throw StateError(
        'SECURITY EXCEPTION: In release/production builds, API_BASE_URL must use HTTPS protocol. '
        'Received insecure endpoint: $apiBaseUrl',
      );
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

    // In release or when not overridden via --dart-define, fallback to project config from google-services.json
    final String? firebaseApiKey = injectedFirebaseApiKey.isNotEmpty
        ? injectedFirebaseApiKey
        : (env.isProduction || kReleaseMode ? '' : null);
    final String? firebaseProjectId = injectedFirebaseProjectId.isNotEmpty
        ? injectedFirebaseProjectId
        : (env.isProduction || kReleaseMode ? '' : null);
    final String? firebaseMessagingSenderId =
        injectedFirebaseSenderId.isNotEmpty
        ? injectedFirebaseSenderId
        : (env.isProduction || kReleaseMode ? '' : null);
    final String? firebaseAppId = injectedFirebaseAppId.isNotEmpty
        ? injectedFirebaseAppId
        : (env.isProduction || kReleaseMode ? '' : null);

    return AppConfig(
      environment: env,
      apiBaseUrl: apiBaseUrl,
      wsBaseUrl: wsBaseUrl,
      sentryDsn: injectedSentryDsn.isNotEmpty ? injectedSentryDsn : null,
      supabaseUrl: injectedSupabaseUrl.isNotEmpty ? injectedSupabaseUrl : null,
      supabaseAnonKey: injectedSupabaseAnonKey.isNotEmpty
          ? injectedSupabaseAnonKey
          : null,
      firebaseApiKey: firebaseApiKey,
      firebaseProjectId: firebaseProjectId,
      firebaseMessagingSenderId: firebaseMessagingSenderId,
      firebaseAppId: firebaseAppId,
      encryptionKey: injectedEncryptionKey.isNotEmpty
          ? injectedEncryptionKey
          : null,
      offlineLicenseKeyId: injectedLicenseKeyId.isNotEmpty
          ? injectedLicenseKeyId
          : null,
      offlineLicensePublicKey: injectedLicensePublicKey.isNotEmpty
          ? injectedLicensePublicKey
          : null,
      syncfusionLicenseKey: injectedSyncfusionLicense.isNotEmpty
          ? injectedSyncfusionLicense
          : null,
      appVersion: injectedAppVersion,
    );
  }
}

final appConfigProvider = Provider<AppConfig>((ref) {
  return AppConfig.fromEnvironment();
});
