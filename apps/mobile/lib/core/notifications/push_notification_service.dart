import 'dart:io';
import 'dart:math';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../auth/token_storage.dart';
import '../config/app_config.dart';
import '../database/local_database.dart';
import '../download/download_manager.dart';
import '../sync/sync_service.dart';

/// Top-level background message handler required by Firebase Messaging (ADR-003)
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (err) {
    debugPrint('Firebase initialization failed in background handler: $err');
  }

  final data = message.data;
  debugPrint(
    'Received background push notification: ${message.messageId}, payload: $data',
  );

  final isDisaster =
      data['entity_type'] == 'disaster_mode' || data['type'] == 'disaster_mode';
  final isSyncRequired =
      data['sync_required'] == 'true' ||
      data['content_available'] == 'true' ||
      isDisaster;

  if (isSyncRequired) {
    try {
      final tokenStorage = TokenStorage();
      final token = await tokenStorage.getAccessToken();
      if (token != null && token.isNotEmpty) {
        final config = AppConfig.fromEnvironment();
        final client = ApiClient(
          tokenStorage: tokenStorage,
          baseUrl: config.apiBaseUrl,
        );
        final sync = SyncService(
          apiClient: client,
          localDb: LocalDatabase.instance,
          onEntitlementRevoked: (payload) async {
            final assetId =
                payload['asset_id'] ?? payload['lesson_id'] ?? payload['id'];
            if (assetId != null && assetId.toString().isNotEmpty) {
              await DownloadManager.instance.deleteDownloadedFile(
                assetId.toString(),
              );
            } else {
              await DownloadManager.instance.purgeAllDownloads();
            }
          },
        );
        await sync.syncAll(forceDisasterPack: isDisaster);
        debugPrint(
          'Background sync completed successfully for push notification.',
        );
      }
    } catch (e) {
      debugPrint('Background push sync execution failed: $e');
    }
  }
}

class PushNotificationService {
  final ApiClient apiClient;
  final SyncService syncService;
  String? _fcmToken;

  String? get fcmToken => _fcmToken;

  PushNotificationService({required this.apiClient, required this.syncService});

  /// Initializes Firebase and registers device push token with EduLanka backend (ADR-003, P3-S4)
  Future<void> initialize() async {
    try {
      if (Firebase.apps.isEmpty) {
        final config = AppConfig.fromEnvironment();
        if (config.firebaseApiKey != null &&
            config.firebaseApiKey!.isNotEmpty) {
          await Firebase.initializeApp(
            options: FirebaseOptions(
              apiKey: config.firebaseApiKey!,
              appId: config.firebaseAppId ?? '',
              messagingSenderId: config.firebaseMessagingSenderId ?? '',
              projectId: config.firebaseProjectId ?? '',
            ),
          );
        } else {
          await Firebase.initializeApp();
        }
      }
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      final messaging = FirebaseMessaging.instance;

      // Request notification authorization
      final settings = await messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        _fcmToken = await messaging.getToken();
        if (_fcmToken != null && _fcmToken!.isNotEmpty) {
          await _registerTokenWithBackend(_fcmToken!);
        }
      } else {
        debugPrint(
          'Push notification permission denied or dismissed: ${settings.authorizationStatus}',
        );
      }

      // Listen for token rotations
      messaging.onTokenRefresh.listen((newToken) async {
        _fcmToken = newToken;
        await _registerTokenWithBackend(newToken);
      });

      // Handle foreground notifications
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        debugPrint('Foreground push received: ${message.notification?.title}');
        final data = message.data;
        if (data['entity_type'] == 'disaster_mode' ||
            data['sync_required'] == 'true') {
          syncService.triggerAutoSync();
        }
      });

      // Handle notification clicks when app is in background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        debugPrint('User tapped push notification: ${message.messageId}');
        syncService.triggerAutoSync();
      });
    } catch (e) {
      debugPrint(
        '[PushNotificationService] Firebase credentials / google-services.json not configured or initialization skipped: $e. '
        'Push notifications disabled; resilient background polling, connectivity listener, and app-open fallback will handle sync.',
      );
      // Do not silently swallow — report to Sentry/console
    }
  }

  Future<void> _registerTokenWithBackend(String token) async {
    try {
      final platform = kIsWeb
          ? 'web'
          : (Platform.isAndroid ? 'android' : 'ios');
      await apiClient.registerDeviceToken(
        token: token,
        platform: platform,
        deviceModel: kIsWeb
            ? 'Browser'
            : '${Platform.operatingSystem} ${Platform.operatingSystemVersion}',
      );
      debugPrint(
        'Registered FCM token with backend: ${token.substring(0, min(10, token.length))}...',
      );
    } catch (e) {
      debugPrint('Failed to register device token with backend: $e');
    }
  }
}

final pushNotificationServiceProvider = Provider<PushNotificationService>((
  ref,
) {
  final apiClient = ref.watch(apiClientProvider);
  final syncService = ref.watch(syncServiceProvider);
  return PushNotificationService(
    apiClient: apiClient,
    syncService: syncService,
  );
});
