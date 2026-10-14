import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:dio/dio.dart';
import 'package:edulanka_mobile/core/auth/token_storage.dart';
import 'package:edulanka_mobile/core/api/api_client.dart';
import 'package:edulanka_mobile/core/database/local_database.dart';
import 'package:edulanka_mobile/core/sync/sync_service.dart';

// Mock ApiClient
class FakeApiClient extends ApiClient {
  FakeApiClient()
    : super(tokenStorage: TokenStorage(), baseUrl: 'http://localhost');

  List<Map<String, dynamic>> appendCalls = [];
  Map<String, dynamic>? Function(Map<String, dynamic>)? onAppend;
  Map<String, dynamic>? Function(int since, int limit)? onGetEvents;
  Map<String, dynamic>? Function()? onGetSnapshot;

  @override
  Future<Map<String, dynamic>> appendSyncEvent({
    required String clientUuid,
    required String entityType,
    required String entityId,
    required String eventType,
    required Map<String, dynamic> payload,
  }) async {
    final body = {
      'clientUuid': clientUuid,
      'entityType': entityType,
      'entityId': entityId,
      'eventType': eventType,
      'payload': payload,
    };
    appendCalls.add(body);
    if (onAppend != null) {
      final res = onAppend!(body);
      if (res != null) return res;
    }
    return {'sequence': 101, 'status': 'INGESTED'};
  }

  @override
  Future<Map<String, dynamic>> getSyncEvents({
    int since = 0,
    int limit = 50,
  }) async {
    if (onGetEvents != null) {
      final res = onGetEvents!(since, limit);
      if (res != null) return res;
    }
    return {'events': [], 'hasMore': false, 'latestSequence': since};
  }

  @override
  Future<Map<String, dynamic>> getSnapshot() async {
    if (onGetSnapshot != null) {
      final res = onGetSnapshot!();
      if (res != null) return res;
    }
    return {
      'latestSequence': 500,
      'classes': [
        {'id': 'c1', 'name': 'Grade 10'},
      ],
      'notices': [],
    };
  }

  @override
  Future<Map<String, dynamic>> getDisasterPack() async {
    return {'emergencyContacts': []};
  }

  @override
  Future<List<dynamic>> getEmergencyContacts() async {
    return [];
  }

  @override
  Future<List<dynamic>> getShelters() async {
    return [];
  }
}

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  tearDown(() async {
    await LocalDatabase.instance.clearAll();
  });

  group('SyncService & Outbox Resilience Tests', () {
    test(
      'pushOutbox records failed state on API 400 error instead of staying PENDING',
      () async {
        final db = LocalDatabase.instance;
        final fakeApi = FakeApiClient();
        final syncService = SyncService(apiClient: fakeApi, localDb: db);

        // Simulate API throwing a 400 Bad Request
        fakeApi.onAppend = (body) {
          throw DioException(
            requestOptions: RequestOptions(path: '/mobile/sync-events'),
            response: Response(
              requestOptions: RequestOptions(path: '/mobile/sync-events'),
              statusCode: 400,
              data: {'message': 'Invalid UUID for entityId'},
            ),
          );
        };

        await db.queueSyncEvent(
          clientUuid: '11111111-1111-1111-1111-111111111111',
          entityType: 'attendance',
          entityId: '22222222-2222-2222-2222-222222222222',
          eventType: 'CREATED',
          payload: {'status': 'PRESENT'},
        );

        expect(await db.getPendingOutboxCount(), 1);
        expect(await db.getFailedOutboxCount(), 0);

        final pushed = await syncService.pushOutbox();
        expect(pushed, 0);

        // Verify it is no longer PENDING and is now FAILED
        expect(await db.getPendingOutboxCount(), 0);
        expect(await db.getFailedOutboxCount(), 1);

        // Retry failed events resets it to PENDING
        await db.retryFailedOutboxEvents();
        expect(await db.getPendingOutboxCount(), 1);
        expect(await db.getFailedOutboxCount(), 0);
      },
    );

    test(
      'pullSyncEvents paginates multiple pages and applies attendance and chat locally',
      () async {
        final db = LocalDatabase.instance;
        final fakeApi = FakeApiClient();
        final syncService = SyncService(apiClient: fakeApi, localDb: db);

        int callCount = 0;
        fakeApi.onGetEvents = (since, limit) {
          callCount++;
          if (callCount == 1) {
            // Page 1: hasMore = true
            return {
              'hasMore': true,
              'events': [
                {
                  'sequence': 10,
                  'entity_type': 'attendance',
                  'entity_id': 'att-1',
                  'payload': {
                    'student_id': 'std-1',
                    'class_id': 'cls-1',
                    'date': '2026-10-14',
                    'status': 'PRESENT',
                  },
                },
              ],
            };
          } else {
            // Page 2: hasMore = false
            return {
              'hasMore': false,
              'events': [
                {
                  'sequence': 20,
                  'entity_type': 'chat_message',
                  'entity_id': 'msg-1',
                  'payload': {
                    'id': 'msg-1',
                    'conversation_id': 'conv-10',
                    'sender_id': 'teacher-1',
                    'content': 'Welcome to class!',
                  },
                },
              ],
            };
          }
        };

        final pulledCount = await syncService.pullSyncEvents();
        expect(pulledCount, 2);
        expect(callCount, 2);
        expect(await db.getLastSequence(), 20);

        // Verify attendance was applied locally
        final attRecords = await db.getAttendanceRecords();
        expect(attRecords.length, 1);
        expect(attRecords.first['student_id'], 'std-1');
        expect(attRecords.first['sync_status'], 'SYNCED');

        // Verify chat was applied locally
        final chatMessages = await db.getChatMessages('conv-10');
        expect(chatMessages.length, 1);
        expect(chatMessages.first['content'], 'Welcome to class!');
      },
    );

    test(
      'recovers from 410 using latestSequence instead of resetting cursor to 0',
      () async {
        final db = LocalDatabase.instance;
        final fakeApi = FakeApiClient();
        final syncService = SyncService(apiClient: fakeApi, localDb: db);

        await db.setLastSequence(5);

        // Simulate 410 Gone / resyncRequired
        fakeApi.onGetEvents = (since, limit) {
          return {'resyncRequired': true};
        };

        fakeApi.onGetSnapshot = () {
          return {
            'latestSequence': 850,
            'classes': [
              {'id': 'c10', 'name': 'Grade 10'},
            ],
            'notices': [],
          };
        };

        final res = await syncService.pullSyncEvents();
        expect(res, 1);

        // Verify last sequence is updated to 850, NOT reset to 0!
        expect(await db.getLastSequence(), 850);
      },
    );

    test(
      'clearAll wipes entire local database preventing state leak between users',
      () async {
        final db = LocalDatabase.instance;

        await db.queueSyncEvent(
          clientUuid: '33333333-3333-3333-3333-333333333333',
          entityType: 'attendance',
          entityId: '44444444-4444-4444-4444-444444444444',
          eventType: 'CREATED',
          payload: {},
        );
        await db.setLastSequence(100);
        await db.saveSyncedChatMessage({
          'id': 'm1',
          'conversation_id': 'c1',
          'content': 'Secret user message',
        });

        expect(await db.getPendingOutboxCount(), 1);
        expect(await db.getLastSequence(), 100);
        expect((await db.getChatMessages('c1')).length, 1);

        await db.clearAll();

        expect(await db.getPendingOutboxCount(), 0);
        expect(await db.getLastSequence(), 0);
        expect((await db.getChatMessages('c1')).length, 0);
      },
    );
  });
}
