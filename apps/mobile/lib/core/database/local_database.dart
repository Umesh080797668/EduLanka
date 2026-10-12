import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._init();
  static Database? _database;

  LocalDatabase._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('edulanka_offline.db');
    return _database!;
  }

  Future<Database> _initDB(String filePath) async {
    // Enable FFI for desktop and unit tests
    if (!kIsWeb &&
        (Platform.isLinux || Platform.isWindows || Platform.isMacOS)) {
      sqfliteFfiInit();
      databaseFactory = databaseFactoryFfi;
    }

    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(path, version: 1, onCreate: _createDB);
  }

  Future<void> _createDB(Database db, int version) async {
    // 1. Monotonic Outbox Mutations (ADR-002)
    await db.execute('''
      CREATE TABLE sync_outbox (
        client_uuid TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        server_sequence INTEGER,
        error_message TEXT
      )
    ''');

    // 2. Sync Metadata (Last sequences, checkpoints)
    await db.execute('''
      CREATE TABLE sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    // 3. Offline Emergency Contacts (P3-S8)
    await db.execute('''
      CREATE TABLE emergency_contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0
      )
    ''');

    // 4. Offline Evacuation Shelters (P3-S8)
    await db.execute('''
      CREATE TABLE emergency_shelters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        capacity INTEGER,
        gps_lat REAL,
        gps_lng REAL,
        notes TEXT
      )
    ''');

    // 5. Offline Attendance Roll-Call Records
    await db.execute('''
      CREATE TABLE offline_attendance (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        marked_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING'
      )
    ''');
  }

  // ── Sync Outbox Operations ──────────────────────────────────────────

  Future<void> queueSyncEvent({
    required String clientUuid,
    required String entityType,
    required String entityId,
    required String eventType,
    required Map<String, dynamic> payload,
  }) async {
    final db = await database;
    await db.insert('sync_outbox', {
      'client_uuid': clientUuid,
      'entity_type': entityType,
      'entity_id': entityId,
      'event_type': eventType,
      'payload': jsonEncode(payload),
      'created_at': DateTime.now().millisecondsSinceEpoch,
      'status': 'PENDING',
      'server_sequence': null,
      'error_message': null,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> getPendingOutboxEvents() async {
    final db = await database;
    return await db.query(
      'sync_outbox',
      where: 'status = ?',
      whereArgs: ['PENDING'],
      orderBy: 'created_at ASC',
    );
  }

  Future<int> getPendingOutboxCount() async {
    final db = await database;
    final res = await db.rawQuery(
      "SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'PENDING'",
    );
    return Sqflite.firstIntValue(res) ?? 0;
  }

  Future<void> markOutboxEventSynced(String clientUuid, int? serverSeq) async {
    final db = await database;
    await db.update(
      'sync_outbox',
      {'status': 'SYNCED', 'server_sequence': serverSeq},
      where: 'client_uuid = ?',
      whereArgs: [clientUuid],
    );
  }

  // ── Sync Metadata ──────────────────────────────────────────────────

  Future<int> getLastSequence() async {
    final db = await database;
    final res = await db.query(
      'sync_metadata',
      where: 'key = ?',
      whereArgs: ['last_sequence'],
    );
    if (res.isNotEmpty) {
      return int.tryParse(res.first['value'] as String) ?? 0;
    }
    return 0;
  }

  Future<void> setLastSequence(int seq) async {
    final db = await database;
    await db.insert('sync_metadata', {
      'key': 'last_sequence',
      'value': seq.toString(),
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  // ── Attendance Operations ──────────────────────────────────────────

  Future<void> recordAttendance({
    required String id,
    required String studentId,
    required String classId,
    required String date,
    required String status,
    required String markedAt,
  }) async {
    final db = await database;
    await db.insert('offline_attendance', {
      'id': id,
      'student_id': studentId,
      'class_id': classId,
      'date': date,
      'status': status,
      'marked_at': markedAt,
      'sync_status': 'PENDING',
    }, conflictAlgorithm: ConflictAlgorithm.replace);

    // Queue as a monotonic sync event (ADR-002)
    await queueSyncEvent(
      clientUuid: id,
      entityType: 'attendance',
      entityId: id,
      eventType: 'CREATED',
      payload: {
        'classId': classId,
        'studentId': studentId,
        'date': date,
        'status': status,
        'markedAt': markedAt,
      },
    );
  }

  Future<List<Map<String, dynamic>>> getAttendanceRecords() async {
    final db = await database;
    return await db.query(
      'offline_attendance',
      orderBy: 'marked_at DESC',
      limit: 50,
    );
  }

  // ── Disaster Readiness Pack ────────────────────────────────────────

  Future<void> saveDisasterPack({
    required List<dynamic> contacts,
    required List<dynamic> shelters,
  }) async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.delete('emergency_contacts');
      for (final c in contacts) {
        if (c is Map) {
          await txn.insert('emergency_contacts', {
            'id':
                c['id']?.toString() ??
                c['phone']?.toString() ??
                UniqueKey().toString(),
            'name': c['name']?.toString() ?? 'Emergency Contact',
            'role': c['role']?.toString() ?? 'Official',
            'phone': c['phone']?.toString() ?? '',
            'is_primary': c['isPrimary'] == true ? 1 : 0,
          });
        }
      }

      await txn.delete('emergency_shelters');
      for (final s in shelters) {
        if (s is Map) {
          await txn.insert('emergency_shelters', {
            'id': s['id']?.toString() ?? UniqueKey().toString(),
            'name': s['name']?.toString() ?? 'Shelter',
            'address': s['address']?.toString() ?? '',
            'capacity': s['capacity'] is int ? s['capacity'] : null,
            'gps_lat': s['gpsLat'] is num
                ? (s['gpsLat'] as num).toDouble()
                : null,
            'gps_lng': s['gpsLng'] is num
                ? (s['gpsLng'] as num).toDouble()
                : null,
            'notes': s['notes']?.toString(),
          });
        }
      }
    });
  }

  Future<List<Map<String, dynamic>>> getEmergencyContacts() async {
    final db = await database;
    return await db.query(
      'emergency_contacts',
      orderBy: 'is_primary DESC, name ASC',
    );
  }

  Future<List<Map<String, dynamic>>> getEmergencyShelters() async {
    final db = await database;
    return await db.query('emergency_shelters', orderBy: 'name ASC');
  }

  Future<void> clearAll() async {
    final db = await database;
    await db.delete('sync_outbox');
    await db.delete('sync_metadata');
    await db.delete('emergency_contacts');
    await db.delete('emergency_shelters');
    await db.delete('offline_attendance');
  }
}
