import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../auth/auth_state.dart';
import '../database/local_database.dart';
import '../download/download_manager.dart';

class SyncResult {
  final int pushedCount;
  final int pulledCount;
  final bool success;
  final String message;

  const SyncResult({
    required this.pushedCount,
    required this.pulledCount,
    required this.success,
    required this.message,
  });
}

class SyncService {
  final ApiClient apiClient;
  final LocalDatabase localDb;
  final void Function(Map<String, dynamic> payload)? onEntitlementRevoked;
  final Ref? ref;

  SyncService({
    required this.apiClient,
    required this.localDb,
    this.onEntitlementRevoked,
    this.ref,
  });

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Timer? _periodicTimer;
  bool _isSyncing = false;
  int? _planRetentionDays;
  int? _videoRetentionDays;

  int? get planRetentionDays => _planRetentionDays;
  int? get videoRetentionDays => _videoRetentionDays;

  // Exponential backoff configuration
  int _currentBackoffMs = 2000;
  static const int _initialBackoffMs = 2000;
  static const int _maxBackoffMs = 60000;
  DateTime? _nextAllowedSyncTime;

  /// Starts automatic background synchronization with connectivity listener and exponential backoff
  void startAutoSync({Duration period = const Duration(seconds: 30)}) {
    stopAutoSync();

    // 1. Connectivity listener: triggers sync when network becomes available
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen((
      results,
    ) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      if (isOnline) {
        _currentBackoffMs = _initialBackoffMs;
        _nextAllowedSyncTime = null;
        triggerAutoSync();
      }
    });

    // 2. Periodic background sync timer
    _periodicTimer = Timer.periodic(period, (_) {
      triggerAutoSync();
    });

    // Initial background attempt
    triggerAutoSync();
  }

  /// Cancels background sync timers and connectivity subscriptions
  void stopAutoSync() {
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
    _periodicTimer?.cancel();
    _periodicTimer = null;
  }

  /// Evaluates backoff delays and triggers sync
  Future<void> triggerAutoSync() async {
    if (_isSyncing) return;
    if (_nextAllowedSyncTime != null &&
        DateTime.now().isBefore(_nextAllowedSyncTime!)) {
      return;
    }

    final result = await syncAll();
    if (!result.success) {
      // Exponential backoff upon failure
      _nextAllowedSyncTime = DateTime.now().add(
        Duration(milliseconds: _currentBackoffMs),
      );
      _currentBackoffMs = min(_currentBackoffMs * 2, _maxBackoffMs);
    } else {
      // Reset backoff on success
      _currentBackoffMs = _initialBackoffMs;
      _nextAllowedSyncTime = null;
    }
  }

  /// Pushes queued offline mutations from local SQLite outbox to server monotonic event log
  Future<int> pushOutbox() async {
    final pending = await localDb.getPendingOutboxEvents();
    if (pending.isEmpty) return 0;

    int pushed = 0;
    for (final event in pending) {
      final clientUuid = event['client_uuid'] as String;
      final entityType = event['entity_type'] as String;
      final entityId = event['entity_id'] as String;
      final eventType = event['event_type'] as String;
      final payloadStr = event['payload'] as String;
      final payload = jsonDecode(payloadStr) as Map<String, dynamic>;

      try {
        final outboundPayload = Map<String, dynamic>.from(payload);

        // Upload any offline homework attachments to Cloudinary before syncing
        if (entityType == 'homework_submission' &&
            outboundPayload['attachments'] is List) {
          final attList = outboundPayload['attachments'] as List;
          final sanitizedList = <Map<String, dynamic>>[];
          for (final rawAtt in attList) {
            if (rawAtt is Map) {
              final att = Map<String, dynamic>.from(rawAtt);
              final localPath =
                  att['localPath']?.toString() ?? att['path']?.toString();
              String currentUrl = att['url']?.toString() ?? '';

              if (!currentUrl.startsWith('http') &&
                  localPath != null &&
                  File(localPath).existsSync()) {
                final cloudUrl = await apiClient.uploadAttachment(
                  filePath: localPath,
                  fileName: att['name']?.toString(),
                );
                currentUrl = cloudUrl;
                att['url'] = cloudUrl;
              }

              // Strictly drop path and localPath from the payload sent over the wire
              att.remove('path');
              att.remove('localPath');
              sanitizedList.add(att);
            }
          }
          outboundPayload['attachments'] = sanitizedList;
        }

        final res = await apiClient.appendSyncEvent(
          clientUuid: clientUuid,
          entityType: entityType,
          entityId: entityId,
          eventType: eventType,
          payload: outboundPayload,
        );

        final seq = res['sequence'] is int ? res['sequence'] as int : null;
        await localDb.markOutboxEventSynced(clientUuid, seq);
        pushed++;
      } catch (e) {
        // If auth failed, rethrow so session/token refresh can intervene
        if (e is DioException && e.response?.statusCode == 401) {
          rethrow;
        }

        // Check if transient network error or 5xx server error
        bool isTransient = false;
        if (e is DioException) {
          final type = e.type;
          final status = e.response?.statusCode;
          if (type == DioExceptionType.connectionTimeout ||
              type == DioExceptionType.sendTimeout ||
              type == DioExceptionType.receiveTimeout ||
              type == DioExceptionType.connectionError ||
              (status != null && (status >= 500 || status == 429))) {
            isTransient = true;
          }
        } else if (e is SocketException || e is TimeoutException) {
          isTransient = true;
        }

        if (isTransient) {
          // Do NOT mark as FAILED. Keep event PENDING and abort this pass for exponential retry
          break;
        }

        // Record permanent failed state (e.g. 400 Bad Request, 422 Unprocessable)
        String errorMsg = e.toString();
        if (e is DioException) {
          final data = e.response?.data;
          if (data is Map && data['message'] != null) {
            errorMsg = data['message'] is List
                ? (data['message'] as List).join(', ')
                : data['message'].toString();
          } else if (e.message != null && e.message!.isNotEmpty) {
            errorMsg = e.message!;
          }
        }
        await localDb.markOutboxEventFailed(clientUuid, errorMsg);
      }
    }
    return pushed;
  }

  /// Pulls remote monotonic sync stream since local checkpoint sequence, paginating while hasMore is true
  Future<int> pullSyncEvents() async {
    int totalPulled = 0;
    bool hasMore = true;
    int currentSeq = await localDb.getLastSequence();

    while (hasMore) {
      try {
        final res = await apiClient.getSyncEvents(since: currentSeq, limit: 50);

        if (res['retentionDays'] is int) {
          _planRetentionDays = res['retentionDays'] as int;
        }

        // Check if client cursor predates the 90-day retention window (HTTP 410 Gone / resyncRequired)
        if (res['resyncRequired'] == true) {
          await _recoverFromSnapshot();
          return totalPulled + 1;
        }

        final events = res['events'] is List ? res['events'] as List : [];
        if (events.isEmpty) {
          break;
        }

        int maxSeqInPage = currentSeq;
        for (final rawEv in events) {
          if (rawEv is Map) {
            final ev = Map<String, dynamic>.from(rawEv);
            await _applyEventLocally(ev);
            final s = ev['sequence'] is int ? ev['sequence'] as int : null;
            if (s != null && s > maxSeqInPage) {
              maxSeqInPage = s;
            }
          }
        }

        currentSeq = maxSeqInPage;
        await localDb.setLastSequence(currentSeq);
        totalPulled += events.length;

        hasMore = res['hasMore'] == true;
      } catch (e) {
        if (e is DioException && e.response?.statusCode == 410) {
          await _recoverFromSnapshot();
          return totalPulled + 1;
        }
        if (e is DioException && e.response?.statusCode == 401) {
          rethrow;
        }
        break;
      }
    }
    return totalPulled;
  }

  /// Recovers from 410 Gone by pulling full snapshot and correctly reading latestSequence
  Future<void> _recoverFromSnapshot() async {
    final snapshot = await apiClient.getSnapshot();
    // Server returns 'latestSequence' (with fallback to 'lastSequence')
    final snapSeq =
        (snapshot['latestSequence'] ?? snapshot['lastSequence']) as int? ?? 0;
    await localDb.applySnapshot(snapshot);
    await localDb.setLastSequence(snapSeq);
  }

  /// Dispatches remote events into local SQLite tables
  Future<void> _applyEventLocally(Map<String, dynamic> event) async {
    final entityType = event['entity_type']?.toString();
    final entityId = event['entity_id']?.toString();
    final payload = event['payload'] is Map
        ? Map<String, dynamic>.from(event['payload'] as Map)
        : <String, dynamic>{};

    switch (entityType) {
      case 'attendance':
        await localDb.saveSyncedAttendance(payload, entityId: entityId);
        break;
      case 'chat_message':
        await localDb.saveSyncedChatMessage(payload, entityId: entityId);
        break;
      case 'entitlement_revocation':
        onEntitlementRevoked?.call(payload);
        break;
      case 'blog_post':
        await localDb.saveSyncedBlogPost(
          payload,
          entityId: entityId,
          eventType: event['event_type']?.toString(),
        );
        break;
      case 'blog_comment':
        await localDb.saveSyncedBlogComment(
          payload,
          entityId: entityId,
          eventType: event['event_type']?.toString(),
        );
        break;
      case 'blog_reaction':
        await localDb.saveSyncedBlogReaction(
          payload,
          entityId: entityId,
          eventType: event['event_type']?.toString(),
        );
        break;
    }
  }

  DateTime? _lastDisasterPackFetch;

  /// Downloads active disaster notices, policies, emergency contacts, and evacuation shelters
  /// Throttled to at most once per hour unless force is true (e.g. from silent disaster push)
  Future<void> fetchDisasterPack({bool force = false}) async {
    if (!force &&
        _lastDisasterPackFetch != null &&
        DateTime.now().difference(_lastDisasterPackFetch!) <
            const Duration(hours: 1)) {
      return;
    }

    try {
      final pack = await apiClient.getDisasterPack();
      final license = pack['license'] is Map ? pack['license'] as Map : null;
      if (license != null) {
        if (license['retentionDays'] is int) {
          _planRetentionDays = license['retentionDays'] as int;
        }
        if (license['videoRetentionDays'] is int) {
          _videoRetentionDays = license['videoRetentionDays'] as int;
        }
      }
      final contacts = pack['emergencyContacts'] is List
          ? pack['emergencyContacts'] as List
          : await apiClient.getEmergencyContacts();
      final shelters = await apiClient.getShelters();

      await localDb.saveDisasterPack(contacts: contacts, shelters: shelters);
      _lastDisasterPackFetch = DateTime.now();
    } catch (_) {
      // Offline fallback: keep existing SQLite cached disaster pack intact
    }
  }

  /// Full bidirectional synchronization
  Future<SyncResult> syncAll({bool forceDisasterPack = false}) async {
    if (_isSyncing) {
      return const SyncResult(
        pushedCount: 0,
        pulledCount: 0,
        success: true,
        message: 'Sync already in progress.',
      );
    }

    _isSyncing = true;
    try {
      final pushed = await pushOutbox();
      final pulled = await pullSyncEvents();
      await fetchDisasterPack(force: forceDisasterPack);

      // Prune expired offline cache records according to plan retention days (S3)
      // Starter: 7 days. Growth & Institutional: 0 (unlimited retention - no pruning).
      final plan = ref?.read(authProvider).tenantPlan;
      final fallbackDays = (plan == 'GROWTH' || plan == 'INSTITUTIONAL')
          ? 0
          : 7;
      final retentionDays = _planRetentionDays ?? fallbackDays;
      if (retentionDays > 0) {
        await localDb.pruneExpiredCache(retentionDays);
      }
      await DownloadManager.instance.purgeExpired();

      return SyncResult(
        pushedCount: pushed,
        pulledCount: pulled,
        success: true,
        message:
            'Synchronized $pushed outgoing mutation(s), $pulled incoming event(s).',
      );
    } catch (e) {
      return SyncResult(
        pushedCount: 0,
        pulledCount: 0,
        success: false,
        message: 'Sync failed: ${e.toString()}',
      );
    } finally {
      _isSyncing = false;
    }
  }

  void dispose() {
    stopAutoSync();
  }
}

final syncServiceProvider = Provider<SyncService>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  final service = SyncService(
    apiClient: apiClient,
    localDb: LocalDatabase.instance,
    ref: ref,
    onEntitlementRevoked: (payload) async {
      final assetId =
          payload['asset_id'] ?? payload['lesson_id'] ?? payload['id'];
      if (assetId != null && assetId.toString().isNotEmpty) {
        await DownloadManager.instance.deleteDownloadedFile(assetId.toString());
      } else {
        // Account deactivation or full entitlement revocation (ADR-001)
        await DownloadManager.instance.purgeAllDownloads();
      }
    },
  );
  ref.onDispose(() => service.dispose());
  return service;
});
