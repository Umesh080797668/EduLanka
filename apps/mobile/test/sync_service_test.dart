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

    test(
      'queues and replays offline blog comment, threaded reply, and reaction mutations end-to-end',
      () async {
        final db = LocalDatabase.instance;
        final fakeApi = FakeApiClient();
        final syncService = SyncService(apiClient: fakeApi, localDb: db);

        // Prepopulate a blog
        await db.saveSyncedBlogPost({
          'id': 'b100',
          'title': 'Mechanics & Newton Laws',
          'content_markdown': 'Full lecture notes on mechanics...',
          'scope': 'SCHOOL',
          'author_name': 'Dr. Silva',
          'created_at': DateTime.now().toIso8601String(),
        });

        // 1. Save offline comment
        await db.saveOfflineComment(
          blogId: 'b100',
          authorId: 'u-std-1',
          authorName: 'Nimal',
          authorRole: 'STUDENT',
          content: 'Is momentum conserved in inelastic collisions?',
        );

        final offlineComments = await db.getOfflineCommentsForBlog('b100');
        expect(offlineComments.length, 1);
        final parentCommentId = offlineComments.first['id'] as String;
        expect(offlineComments.first['content'], 'Is momentum conserved in inelastic collisions?');
        expect(offlineComments.first['sync_status'], 'PENDING');

        // 2. Save offline threaded reply
        await db.saveOfflineComment(
          blogId: 'b100',
          parentId: parentCommentId,
          authorId: 'u-tch-1',
          authorName: 'Dr. Silva',
          authorRole: 'TEACHER',
          content: 'Yes, total momentum is always conserved regardless of kinetic energy loss.',
        );

        final allComments = await db.getOfflineCommentsForBlog('b100');
        expect(allComments.length, 2);

        // 3. Save offline reactions
        await db.saveOfflineReaction(
          blogId: 'b100',
          commentId: null,
          userId: 'u-std-1',
          reactionType: 'HELPFUL',
        );

        await db.saveOfflineReaction(
          blogId: null,
          commentId: parentCommentId,
          userId: 'u-tch-1',
          reactionType: 'INSIGHTFUL',
        );

        final blogReactions = await db.getOfflineReactionsForBlog('b100');
        expect(blogReactions.length, 1);
        expect(blogReactions.first['reaction_type'], 'HELPFUL');

        // Verify outbox has 4 pending mutations
        expect(await db.getPendingOutboxCount(), 4);

        // 4. Replay outbox to server
        final pushedCount = await syncService.pushOutbox();
        expect(pushedCount, 4);
        expect(fakeApi.appendCalls.length, 4);

        final entityTypes = fakeApi.appendCalls.map((c) => c['entityType']).toList();
        expect(entityTypes, containsAll(['blog_comment', 'blog_reaction']));

        // Verify outbox is now empty (synced)
        expect(await db.getPendingOutboxCount(), 0);

        // 5. Test pulling down blog sync events from server
        fakeApi.onGetEvents = (since, limit) {
          return {
            'latestSequence': 120,
            'hasMore': false,
            'events': [
              {
                'sequence': 119,
                'entity_type': 'blog_comment',
                'event_type': 'CREATED',
                'payload': {
                  'id': 'c-server-1',
                  'blog_id': 'b100',
                  'author_id': 'u-server-1',
                  'author_name': 'Sunil',
                  'author_role': 'STUDENT',
                  'content': 'Thank you teacher!',
                  'created_at': DateTime.now().toIso8601String(),
                },
              },
              {
                'sequence': 120,
                'entity_type': 'blog_reaction',
                'event_type': 'CREATED',
                'payload': {
                  'id': 'r-server-1',
                  'blog_id': 'b100',
                  'user_id': 'u-server-1',
                  'reaction_type': 'LIKE',
                  'created_at': DateTime.now().toIso8601String(),
                },
              },
            ],
          };
        };

        final pullCount = await syncService.pullSyncEvents();
        expect(pullCount, 2);
        expect(await db.getLastSequence(), 120);

        final updatedComments = await db.getOfflineCommentsForBlog('b100');
        expect(updatedComments.length, 3);
        expect(updatedComments.any((c) => c['id'] == 'c-server-1'), isTrue);

        final updatedReactions = await db.getOfflineReactionsForBlog('b100');
        expect(updatedReactions.length, 2);
        expect(updatedReactions.any((r) => r['id'] == 'r-server-1'), isTrue);
      },
    );
  });
}
