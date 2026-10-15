import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:uuid/uuid.dart';
import 'package:edulanka_mobile/core/database/local_database.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  setUp(() async {
    await LocalDatabase.instance.clearAll();
  });

  group('Disaster Pack Offline Storage Tests', () {
    test('Stores and retrieves prioritized emergency contacts and shelters', () async {
      final mockContacts = [
        {
          'id': 'contact-secondary',
          'name': 'Assistant Principal',
          'role': 'Vice Principal',
          'phone': '+94711111111',
          'isPrimary': false,
        },
        {
          'id': 'contact-primary',
          'name': 'Disaster Response Coordinator',
          'role': 'Head Coordinator',
          'phone': '+94777777777',
          'isPrimary': true,
        },
      ];

      final mockShelters = [
        {
          'id': 'shelter-1',
          'name': 'Community Hall A',
          'address': '123 Main Road, Kandy',
          'capacity': 250,
          'gpsLat': 7.2906,
          'gpsLng': 80.6337,
          'notes': 'Equipped with potable water and first aid kits',
        },
        {
          'id': 'shelter-2',
          'name': 'Temple Dharmashalawa',
          'address': 'Temple Junction, Peradeniya',
          'capacity': 100,
          'gpsLat': 7.2599,
          'gpsLng': 80.5976,
        },
      ];

      await LocalDatabase.instance.saveDisasterPack(
        contacts: mockContacts,
        shelters: mockShelters,
      );

      final storedContacts = await LocalDatabase.instance.getEmergencyContacts();
      expect(storedContacts.length, 2);
      // Verify primary contact sorted first
      expect(storedContacts.first['id'], 'contact-primary');
      expect(storedContacts.first['is_primary'], 1);
      expect(storedContacts.first['phone'], '+94777777777');

      final storedShelters = await LocalDatabase.instance.getEmergencyShelters();
      expect(storedShelters.length, 2);
      expect(storedShelters.first['capacity'], 250);
      expect(storedShelters.first['gps_lat'], closeTo(7.29, 0.01));
    });
  });

  group('Homework & Offline Submission Tests', () {
    test('Caches homework tasks and filters by classId', () async {
      final classA = const Uuid().v4();
      final classB = const Uuid().v4();

      final tasks = [
        {
          'id': 'hw-1',
          'classId': classA,
          'title': 'Mathematics Quadratic Equations',
          'description': 'Solve exercises 4.1 to 4.3',
          'dueDate': '2026-10-25T14:00:00Z',
          'attachments': ['https://cdn.edulanka.lk/hw1.pdf'],
        },
        {
          'id': 'hw-2',
          'classId': classB,
          'title': 'English Essay: My Country',
          'description': 'Write a 250 word essay',
          'dueDate': '2026-10-28T14:00:00Z',
          'attachments': [],
        },
      ];

      await LocalDatabase.instance.saveOfflineHomeworkTasks(tasks);

      final classATasks = await LocalDatabase.instance.getOfflineHomeworkTasks(classId: classA);
      expect(classATasks.length, 1);
      expect(classATasks.first['title'], 'Mathematics Quadratic Equations');

      final allTasks = await LocalDatabase.instance.getOfflineHomeworkTasks();
      expect(allTasks.length, 2);
    });

    test('Records homework submission with client UUID and queues outbox mutation', () async {
      final homeworkId = const Uuid().v4();
      final studentId = const Uuid().v4();
      final clientUuid = const Uuid().v4();

      await LocalDatabase.instance.recordHomeworkSubmission(
        homeworkId: homeworkId,
        studentId: studentId,
        content: 'Completed math problems attached',
        attachments: ['https://storage.edulanka.lk/uploads/sub1.pdf'],
        clientUuid: clientUuid,
      );

      final subs = await LocalDatabase.instance.getOfflineHomeworkSubmissions();
      expect(subs.length, 1);
      expect(subs.first['id'], clientUuid);
      expect(subs.first['homework_id'], homeworkId);
      expect(subs.first['student_id'], studentId);

      // Verify outbox mutation was queued with exact client UUID
      final pendingOutbox = await LocalDatabase.instance.getPendingOutboxEvents();
      expect(pendingOutbox.length, 1);
      expect(pendingOutbox.first['client_uuid'], clientUuid);
      expect(pendingOutbox.first['entity_type'], 'homework_submission');
      expect(pendingOutbox.first['status'], 'PENDING');

      final payload = jsonDecode(pendingOutbox.first['payload'] as String);
      expect(payload['homework_id'], homeworkId);
      expect(payload['student_id'], studentId);

      // Mark applied / synced
      await LocalDatabase.instance.markOutboxEventSynced(clientUuid, 1);
      final remainingPending = await LocalDatabase.instance.getPendingOutboxEvents();
      expect(remainingPending.isEmpty, true);
    });
  });

  group('Download Task Lifecycle & Expiration Tests', () {
    test('Purges expired completed downloads and updates status to EXPIRED', () async {
      final now = DateTime.now().millisecondsSinceEpoch;
      final pastExpiration = now - 10000;
      final futureExpiration = now + 100000;

      await LocalDatabase.instance.saveDownloadTask({
        'id': 'task-expired',
        'asset_id': 'asset-1',
        'title': 'Expired Lesson Video',
        'remote_url': 'https://cdn.edulanka.lk/old.mp4',
        'local_path': '/storage/lessons/old.enc.mp4',
        'total_bytes': 1000,
        'downloaded_bytes': 1000,
        'status': 'COMPLETED',
        'retention_days': 7,
        'downloaded_at': now - 20000,
        'expires_at': pastExpiration,
      });

      await LocalDatabase.instance.saveDownloadTask({
        'id': 'task-active',
        'asset_id': 'asset-2',
        'title': 'Active Lesson Video',
        'remote_url': 'https://cdn.edulanka.lk/new.mp4',
        'local_path': '/storage/lessons/new.enc.mp4',
        'total_bytes': 2000,
        'downloaded_bytes': 2000,
        'status': 'COMPLETED',
        'retention_days': 14,
        'downloaded_at': now,
        'expires_at': futureExpiration,
      });

      final purgedPaths = await LocalDatabase.instance.purgeExpiredDownloads();
      expect(purgedPaths.length, 1);
      expect(purgedPaths.first, '/storage/lessons/old.enc.mp4');

      final expiredTask = await LocalDatabase.instance.getDownloadTask('task-expired');
      expect(expiredTask?['status'], 'EXPIRED');

      final activeTask = await LocalDatabase.instance.getDownloadTask('task-active');
      expect(activeTask?['status'], 'COMPLETED');
    });
  });
}
