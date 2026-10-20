import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:edulanka_mobile/core/auth/token_storage.dart';
import 'package:edulanka_mobile/core/api/api_client.dart';
import 'package:edulanka_mobile/core/database/local_database.dart';
import 'package:edulanka_mobile/core/sync/sync_service.dart';

class MockIntegrationApiClient extends ApiClient {
  MockIntegrationApiClient()
    : super(tokenStorage: TokenStorage(), baseUrl: 'http://localhost');

  final List<Map<String, dynamic>> uploadedEvents = [];
  final List<Map<String, dynamic>> incomingServerEvents = [];
  int currentServerSequence = 100;

  @override
  Future<Map<String, dynamic>> appendSyncEvent({
    required String clientUuid,
    required String entityType,
    required String entityId,
    required String eventType,
    required Map<String, dynamic> payload,
  }) async {
    currentServerSequence++;
    final event = {
      'sequence': currentServerSequence,
      'clientUuid': clientUuid,
      'entityType': entityType,
      'entityId': entityId,
      'eventType': eventType,
      'payload': payload,
      'timestamp': DateTime.now().toUtc().toIso8601String(),
    };
    uploadedEvents.add(event);
    return {'sequence': currentServerSequence, 'status': 'INGESTED'};
  }

  @override
  Future<Map<String, dynamic>> getSyncEvents({
    int since = 0,
    int limit = 50,
  }) async {
    final pending = incomingServerEvents
        .where((e) => (e['sequence'] as int) > since)
        .take(limit)
        .toList();

    final maxSeq = pending.isEmpty
        ? since
        : pending
              .map((e) => e['sequence'] as int)
              .reduce((a, b) => a > b ? a : b);

    return {
      'events': pending,
      'hasMore': false,
      'latestSequence': currentServerSequence > maxSeq
          ? currentServerSequence
          : maxSeq,
    };
  }

  @override
  Future<Map<String, dynamic>> getSnapshot() async {
    return {
      'latestSequence': currentServerSequence,
      'classes': [
        {'id': 'class-1', 'name': 'Grade 10A'},
      ],
      'notices': [
        {'id': 'notice-1', 'title': 'Term Starts', 'content': 'Welcome back!'},
      ],
    };
  }

  @override
  Future<Map<String, dynamic>> getDisasterPack() async {
    return {
      'isActive': false,
      'emergencyContacts': [
        {'id': 'contact-1', 'name': 'Police Station', 'phone': '119'},
      ],
      'shelters': [],
    };
  }

  @override
  Future<List<dynamic>> getEmergencyContacts() async => [];

  @override
  Future<List<dynamic>> getShelters() async => [];
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  group('Mobile Offline Sync Integration Tests (ADR-002)', () {
    late LocalDatabase localDb;
    late MockIntegrationApiClient apiClient;
    late SyncService syncService;

    setUp(() async {
      localDb = LocalDatabase.instance;
      await localDb.clearAll();

      apiClient = MockIntegrationApiClient();
      syncService = SyncService(apiClient: apiClient, localDb: localDb);
    });

    tearDown(() async {
      await localDb.clearAll();
    });

    test('Full End-to-End Bidirectional Sync Loop', () async {
      // 1. Queue offline mutations: Attendance, Homework Submission, and Chat Message
      await localDb.recordAttendance(
        id: '11111111-1111-1111-1111-111111111111',
        studentId: '22222222-2222-2222-2222-222222222222',
        classId: '33333333-3333-3333-3333-333333333333',
        date: '2026-10-20',
        status: 'PRESENT',
        markedAt: '2026-10-20T08:00:00Z',
      );

      await localDb.recordHomeworkSubmission(
        homeworkId: '44444444-4444-4444-4444-444444444444',
        studentId: '22222222-2222-2222-2222-222222222222',
        content: 'Solved all calculus problems.',
        attachments: [],
      );

      await localDb.queueSyncEvent(
        clientUuid: '55555555-5555-5555-5555-555555555555',
        entityType: 'chat_message',
        entityId: '66666666-6666-6666-6666-666666666666',
        eventType: 'CREATED',
        payload: {
          'id': 'msg-1',
          'conversation_id': 'conv-1',
          'content': 'Good morning class!',
        },
      );

      // Verify 3 outbox events are initially PENDING
      final pendingCount = await localDb.getPendingOutboxCount();
      expect(pendingCount, 3);

      // 2. Prepare inbound server events to be received during sync
      apiClient.incomingServerEvents.add({
        'sequence': 105,
        'entity_type': 'attendance',
        'entity_id': 'server-att-2',
        'event_type': 'CREATED',
        'payload': {
          'id': 'server-att-2',
          'student_id': 'student-uuid-2',
          'class_id': 'class-uuid-1',
          'date': '2026-10-20',
          'status': 'LATE',
          'marked_at': '2026-10-20T08:15:00Z',
        },
      });

      apiClient.incomingServerEvents.add({
        'sequence': 106,
        'entity_type': 'notice',
        'entity_id': 'notice-server-1',
        'event_type': 'CREATED',
        'payload': {
          'id': 'notice-server-1',
          'title': 'Sports Meet Notice',
          'content': 'Annual inter-house athletics meet postponed to Friday.',
        },
      });

      // 3. Trigger full synchronization cycle
      final syncResult = await syncService.syncAll();
      expect(syncResult.success, isTrue);
      expect(syncResult.pushedCount, 3);
      expect(syncResult.pulledCount, greaterThanOrEqualTo(2));

      // 4. Verify outbox events are drained (all marked SYNCED, pending = 0)
      final remainingPending = await localDb.getPendingOutboxCount();
      expect(remainingPending, 0);

      // Verify that ApiClient received the 3 uploaded mutations
      expect(apiClient.uploadedEvents.length, 3);
      final entityTypes = apiClient.uploadedEvents
          .map((e) => e['entityType'])
          .toList();
      expect(
        entityTypes,
        containsAll(['attendance', 'homework_submission', 'chat_message']),
      );

      // 5. Verify that inbound server events were applied to local database
      final localAttendance = await localDb.getAttendanceRecords();
      final hasServerRecord = localAttendance.any(
        (r) => r['id'] == 'server-att-2',
      );
      expect(hasServerRecord, isTrue);

      // 6. Verify monotonic sequence tracking
      final lastSeq = await localDb.getLastSequence();
      expect(lastSeq, greaterThanOrEqualTo(106));
    });

    test('Idempotent Deduplication of Repeated Sync Ingestion', () async {
      await localDb.recordAttendance(
        id: '77777777-7777-7777-7777-777777777777',
        studentId: '88888888-8888-8888-8888-888888888888',
        classId: '99999999-9999-9999-9999-999999999999',
        date: '2026-10-20',
        status: 'PRESENT',
        markedAt: '2026-10-20T08:00:00Z',
      );

      final res1 = await syncService.syncAll();
      expect(res1.pushedCount, 1);
      final firstUploadCount = apiClient.uploadedEvents.length;
      expect(firstUploadCount, 1);

      // Re-running sync should not upload anything new
      final res2 = await syncService.syncAll();
      expect(res2.pushedCount, 0);
      expect(apiClient.uploadedEvents.length, firstUploadCount);
    });
  });
}
