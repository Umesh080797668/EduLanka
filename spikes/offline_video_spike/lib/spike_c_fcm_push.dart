import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Top-level background isolate entry point for FCM data-only messages.
/// Required by FlutterFire to handle pushes when app is in background or terminated/swiped-away (Android).
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  final receivedAt = DateTime.now().toIso8601String();
  final logEntry = {
    'timestamp': receivedAt,
    'source': 'Background Isolate (App Swiped Away / Background)',
    'messageId': message.messageId,
    'sentTime': message.sentTime?.toIso8601String(),
    'data': message.data,
  };
  debugPrint('[FCM Background Handler] Swiped-away push received: $logEntry');

  // Persist to local disk so app can display it upon relaunch
  try {
    final tempDir = Directory.systemTemp;
    final logFile = File('${tempDir.path}/fcm_background_events.log');
    await logFile.writeAsString('${jsonEncode(logEntry)}\n', mode: FileMode.append);
  } catch (e) {
    debugPrint('Failed writing background log: $e');
  }
}

/// Payload shape for Disaster Mode high-priority trigger.
class DisasterModePushPayload {
  final String tenantId;
  final String reason;
  final String expectedClosureDuration;
  final int issuedAtTimestamp;

  DisasterModePushPayload({
    required this.tenantId,
    required this.reason,
    required this.expectedClosureDuration,
    required this.issuedAtTimestamp,
  });

  factory DisasterModePushPayload.fromMap(Map<String, dynamic> map) {
    return DisasterModePushPayload(
      tenantId: map['tenant_id']?.toString() ?? '',
      reason: map['reason']?.toString() ?? 'NATURAL_DISASTER',
      expectedClosureDuration: map['expected_duration']?.toString() ?? '3_DAYS',
      issuedAtTimestamp: int.tryParse(map['timestamp']?.toString() ?? '') ?? DateTime.now().millisecondsSinceEpoch,
    );
  }
}

/// Spike C: Real Firebase Cloud Messaging Engine & Terminated State Fallback.
class SpikeCPushEngine with WidgetsBindingObserver {
  String? currentUserId;
  String? currentTenantId;
  String? currentDeviceToken;
  String? authToken;
  String apiBaseUrl;
  bool isDisasterModeCached = false;
  bool isFirebaseInitialized = false;

  final StreamController<String> _logController = StreamController<String>.broadcast();
  Stream<String> get logs => _logController.stream;

  final List<Map<String, dynamic>> receivedPushes = [];

  SpikeCPushEngine({
    this.apiBaseUrl = 'http://127.0.0.1:3001',
    this.authToken,
  });

  Future<void> initialize({
    required String userId,
    required String tenantId,
    String? token,
    String? baseUrl,
  }) async {
    currentUserId = userId;
    currentTenantId = tenantId;
    if (token != null) authToken = token;
    if (baseUrl != null) apiBaseUrl = baseUrl;
    WidgetsBinding.instance.addObserver(this);

    _log('Initializing Spike C with Firebase Messaging for tenant $tenantId...');

    try {
      if (Firebase.apps.isEmpty) {
        if (kIsWeb || Platform.isAndroid || Platform.isIOS) {
          try {
            await Firebase.initializeApp();
            isFirebaseInitialized = true;
            _log('Firebase.initializeApp() succeeded');
          } catch (e) {
            _log('Notice: Firebase initialized in development/simulation mode ($e).');
          }
        }
      } else {
        isFirebaseInitialized = true;
      }

      if (isFirebaseInitialized) {
        FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

        final settings = await FirebaseMessaging.instance.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );
        _log('FCM Authorization status: ${settings.authorizationStatus}');

        currentDeviceToken = await FirebaseMessaging.instance.getToken();
        _log('Obtained FCM Device Token: ${currentDeviceToken ?? "null"}');

        if (currentDeviceToken != null) {
          await registerDeviceTokenWithBackend();
        }

        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          _recordMessage('Foreground', message);
        });

        FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
          _recordMessage('Resumed from Notification Tap', message);
        });

        final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
        if (initialMessage != null) {
          _recordMessage('Cold Boot from Notification', initialMessage);
        }
      }

      await _loadPersistedBackgroundEvents();
    } catch (e) {
      _log('Spike C Init Warning: $e');
    }
  }

  Future<void> registerDeviceTokenWithBackend() async {
    if (currentDeviceToken == null) return;
    _log('Registering FCM token with backend POST $apiBaseUrl/api/v1/mobile/device-token...');
    try {
      final client = HttpClient();
      final uri = Uri.parse('$apiBaseUrl/api/v1/mobile/device-token');
      final request = await client.postUrl(uri);
      request.headers.set(HttpHeaders.contentTypeHeader, 'application/json');
      if (authToken != null) {
        request.headers.set('Authorization', 'Bearer $authToken');
      }
      if (currentTenantId != null) {
        request.headers.set('x-tenant-id', currentTenantId!);
      }
      request.write(jsonEncode({
        'token': currentDeviceToken,
        'platform': Platform.isIOS ? 'ios' : 'android',
        'deviceModel': 'SpikeCTestDevice',
      }));
      final response = await request.close().timeout(const Duration(seconds: 4));
      if (response.statusCode == 200 || response.statusCode == 201) {
        _log('Device token successfully saved to backend device_tokens registry.');
      } else {
        _log('Backend returned HTTP ${response.statusCode} for token registration.');
      }
      client.close();
    } catch (e) {
      _log('Token registration network note: $e');
    }
  }

  void _recordMessage(String state, RemoteMessage message) async {
    final entry = {
      'timestamp': DateTime.now().toIso8601String(),
      'state': state,
      'messageId': message.messageId,
      'sentTime': message.sentTime?.toIso8601String(),
      'data': message.data,
    };
    receivedPushes.add(entry);
    _log('[$state Push Received] Type: ${message.data['type']} | Data: ${jsonEncode(message.data)}');

    if (message.data['type'] == 'DISASTER_MODE_ACTIVATED') {
      final payload = DisasterModePushPayload.fromMap(message.data);
      // Security Validation: Verify push tenant_id strictly matches the active user tenant
      if (currentTenantId != null && payload.tenantId != currentTenantId) {
        _log('[CROSS-TENANT SECURITY REJECTION] Dropped push: payload tenant (${payload.tenantId}) does not match user tenant ($currentTenantId).');
        return;
      }

      _log('Tenant matched ($currentTenantId). Executing automated Disaster Pack sync...');
      await _checkAndSyncDisasterPack();
    }
  }

  Future<void> _loadPersistedBackgroundEvents() async {
    try {
      final tempDir = Directory.systemTemp;
      final logFile = File('${tempDir.path}/fcm_background_events.log');
      if (await logFile.exists()) {
        final lines = await logFile.readAsLines();
        for (final line in lines) {
          if (line.trim().isNotEmpty) {
            try {
              final map = jsonDecode(line) as Map<String, dynamic>;
              receivedPushes.add(map);
              _log('[Persisted Background Event Found] ${map['data']}');
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _log('App resumed to foreground — Fallback Layer 4 (App-Open Sync check)');
      _checkAndSyncDisasterPack();
    }
  }

  Future<void> _checkAndSyncDisasterPack() async {
    _log('Querying GET $apiBaseUrl/api/v1/mobile/disaster-pack...');
    try {
      final client = HttpClient();
      final uri = Uri.parse('$apiBaseUrl/api/v1/mobile/disaster-pack');
      final request = await client.getUrl(uri);
      if (authToken != null) {
        request.headers.set('Authorization', 'Bearer $authToken');
      }
      if (currentTenantId != null) {
        request.headers.set('x-tenant-id', currentTenantId!);
      }
      final response = await request.close().timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        final bodyStr = await response.transform(utf8.decoder).join();
        final json = jsonDecode(bodyStr) as Map<String, dynamic>;
        isDisasterModeCached = true;
        _log('Disaster Pack synced successfully from backend. Status: ${json['status'] ?? "READY"} (notices: ${json['notices']?.length ?? 0}, policies: ${json['policies']?.length ?? 0})');
      } else {
        _log('Disaster Pack query returned HTTP ${response.statusCode}');
      }
      client.close();
    } catch (e) {
      _log('Disaster Pack fetch error ($e). Retaining offline cached fallback.');
      isDisasterModeCached = true;
    }
  }

  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _logController.close();
  }

  void _log(String message) {
    final timestamp = DateTime.now().toIso8601String().substring(11, 19);
    _logController.add('[$timestamp] $message');
  }
}
