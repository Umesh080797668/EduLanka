import 'package:flutter_test/flutter_test.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:edulanka_mobile/core/database/local_database.dart';

void main() {
  setUpAll(() {
    sqfliteFfiInit();
    databaseFactory = databaseFactoryFfi;
  });

  tearDown(() async {
    await LocalDatabase.instance.clearAll();
  });

  group('LocalDatabase Offline & Sync Protocol', () {
    test('queues and retrieves offline outbox events', () async {
      final db = LocalDatabase.instance;
      expect(await db.getPendingOutboxCount(), 0);

      await db.queueSyncEvent(
        clientUuid: 'test-uuid-1',
        entityType: 'attendance',
        entityId: 'att-1',
        eventType: 'CREATED',
        payload: {'classId': 'c1', 'studentId': 's1', 'status': 'PRESENT'},
      );

      expect(await db.getPendingOutboxCount(), 1);

      final pending = await db.getPendingOutboxEvents();
      expect(pending.length, 1);
      expect(pending.first['client_uuid'], 'test-uuid-1');
      expect(pending.first['status'], 'PENDING');

      // Mark synced
      await db.markOutboxEventSynced('test-uuid-1', 42);
      expect(await db.getPendingOutboxCount(), 0);
    });

    test('records attendance and automatically queues outbox mutation', () async {
      final db = LocalDatabase.instance;

      await db.recordAttendance(
        id: 'att-rec-1',
        studentId: 'std-1001',
        classId: 'class-10a',
        date: '2026-10-12',
        status: 'PRESENT',
        markedAt: DateTime.now().toUtc().toIso8601String(),
      );

      final records = await db.getAttendanceRecords();
      expect(records.length, 1);
      expect(records.first['student_id'], 'std-1001');
      expect(records.first['status'], 'PRESENT');

      // Confirm outbox queued
      expect(await db.getPendingOutboxCount(), 1);
    });

    test('caches and retrieves emergency disaster pack', () async {
      final db = LocalDatabase.instance;

      await db.saveDisasterPack(
        contacts: [
          {'id': 'c1', 'name': 'DMC Sri Lanka', 'role': 'National Emergency', 'phone': '117', 'isPrimary': true},
          {'id': 'c2', 'name': 'Police Hotline', 'role': 'Security', 'phone': '119'},
        ],
        shelters: [
          {'id': 's1', 'name': 'Ananda College Main Hall', 'address': 'Maradana, Colombo 10', 'capacity': 500},
        ],
      );

      final contacts = await db.getEmergencyContacts();
      expect(contacts.length, 2);
      expect(contacts.first['name'], 'DMC Sri Lanka');
      expect(contacts.first['is_primary'], 1);

      final shelters = await db.getEmergencyShelters();
      expect(shelters.length, 1);
      expect(shelters.first['name'], 'Ananda College Main Hall');
    });

    test('manages monotonic sync sequences', () async {
      final db = LocalDatabase.instance;
      expect(await db.getLastSequence(), 0);

      await db.setLastSequence(105);
      expect(await db.getLastSequence(), 105);
    });

    test('exposes active Drift SQLCipher layer with reactive stream updates (ADR-005)', () async {
      final db = LocalDatabase.instance;
      
      final initial = await db.getPendingOutboxEvents();
      expect(initial.isEmpty, true);

      await db.queueSyncEvent(
        clientUuid: 'stream-test-uuid',
        entityType: 'attendance',
        entityId: 'att-99',
        eventType: 'CREATED',
        payload: {'status': 'PRESENT'},
      );

      final updated = await db.driftDb.watchPendingOutbox().first;
      expect(updated.length, 1);
      expect(updated.first.read<String>('client_uuid'), 'stream-test-uuid');
    });
  });
}
