import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../database/local_database.dart';

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

  SyncService({
    required this.apiClient,
    required this.localDb,
  });

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
        final res = await apiClient.appendSyncEvent(
          clientUuid: clientUuid,
          entityType: entityType,
          entityId: entityId,
          eventType: eventType,
          payload: payload,
        );

        final seq = res['sequence'] is int ? res['sequence'] as int : null;
        await localDb.markOutboxEventSynced(clientUuid, seq);
        pushed++;
      } catch (e) {
        // If server returns error, don't halt entire queue unless auth failed
        if (e is DioException && e.response?.statusCode == 401) {
          rethrow;
        }
      }
    }
    return pushed;
  }

  /// Pulls remote monotonic sync stream since local checkpoint sequence
  Future<int> pullSyncEvents() async {
    final lastSeq = await localDb.getLastSequence();

    try {
      final res = await apiClient.getSyncEvents(since: lastSeq, limit: 50);

      // Check if client cursor predates the 90-day retention window (HTTP 410 Gone / resyncRequired)
      if (res['resyncRequired'] == true) {
        final snapshot = await apiClient.getSnapshot();
        final snapSeq = snapshot['lastSequence'] is int ? snapshot['lastSequence'] as int : 0;
        await localDb.setLastSequence(snapSeq);
        return 1;
      }

      final events = res['events'] is List ? res['events'] as List : [];
      if (events.isEmpty) return 0;

      int maxSeq = lastSeq;
      for (final ev in events) {
        if (ev is Map && ev['sequence'] is int) {
          final s = ev['sequence'] as int;
          if (s > maxSeq) maxSeq = s;
        }
      }

      await localDb.setLastSequence(maxSeq);
      return events.length;
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 410) {
        // Handle 410 Gone snapshot recovery
        final snapshot = await apiClient.getSnapshot();
        final snapSeq = snapshot['lastSequence'] is int ? snapshot['lastSequence'] as int : 0;
        await localDb.setLastSequence(snapSeq);
        return 1;
      }
      return 0;
    }
  }

  /// Downloads active disaster notices, policies, emergency contacts, and evacuation shelters
  Future<void> fetchDisasterPack() async {
    try {
      final pack = await apiClient.getDisasterPack();
      final contacts = pack['emergencyContacts'] is List
          ? pack['emergencyContacts'] as List
          : await apiClient.getEmergencyContacts();
      final shelters = await apiClient.getShelters();

      await localDb.saveDisasterPack(
        contacts: contacts,
        shelters: shelters,
      );
    } catch (_) {
      // Offline fallback: keep existing SQLite cached disaster pack intact
    }
  }

  /// Full bidirectional synchronization
  Future<SyncResult> syncAll() async {
    try {
      final pushed = await pushOutbox();
      final pulled = await pullSyncEvents();
      await fetchDisasterPack();

      return SyncResult(
        pushedCount: pushed,
        pulledCount: pulled,
        success: true,
        message: 'Synchronized $pushed outgoing mutation(s), $pulled incoming event(s).',
      );
    } catch (e) {
      return SyncResult(
        pushedCount: 0,
        pulledCount: 0,
        success: false,
        message: 'Sync failed: ${e.toString()}',
      );
    }
  }
}

final syncServiceProvider = Provider<SyncService>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return SyncService(
    apiClient: apiClient,
    localDb: LocalDatabase.instance,
  );
});
