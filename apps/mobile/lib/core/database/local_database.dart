import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:uuid/uuid.dart';
import 'encryption_key_storage.dart';
import 'drift_database.dart';

class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._init();
  static Database? _database;

  LocalDatabase._init();

  AppDriftDatabase get driftDb => AppDriftDatabase.instance;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('edulanka_encrypted.db');
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

    return await openDatabase(
      path,
      version: 1,
      onConfigure: (db) async {
        await db.execute('PRAGMA busy_timeout = 30000;');
        try {
          final key = await EncryptionKeyStorage.getOrCreateKey();
          await db.execute("PRAGMA key = '$key';");
          await db.execute('PRAGMA cipher_memory_security = ON;');
        } catch (_) {
          // Fallback in headless mock test environment
        }
      },
      onCreate: (db, version) async {
        await db.execute('PRAGMA journal_mode = WAL;');
        await _ensureTables(db);
      },
    );
  }

  Future<void> _ensureTables(Database db) async {
    // 1. Monotonic Outbox Mutations (ADR-002)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS sync_outbox (
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
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    ''');

    // 3. Offline Emergency Contacts (P3-S8)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0
      )
    ''');

    // 4. Offline Evacuation Shelters (P3-S8)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS emergency_shelters (
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
      CREATE TABLE IF NOT EXISTS offline_attendance (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        marked_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING'
      )
    ''');

    // 6. Offline Chat Messages (Preserved Across Devices)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS offline_chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    ''');

    // 7. Persistent Resumable Encrypted Download Tasks (ADR-001, P3-S6)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS download_tasks (
        id TEXT PRIMARY KEY,
        asset_id TEXT NOT NULL,
        title TEXT NOT NULL,
        remote_url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        total_bytes INTEGER NOT NULL DEFAULT 0,
        downloaded_bytes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'QUEUED',
        retention_days INTEGER NOT NULL DEFAULT 30,
        downloaded_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        encryption_key TEXT,
        error TEXT
      )
    ''');

    // 8. Offline Homework Tasks (P3-S3)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS offline_homework_tasks (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        due_date TEXT NOT NULL,
        attachments TEXT NOT NULL DEFAULT '[]'
      )
    ''');

    // 9. Offline Homework Submissions (P3-S3)
    await db.execute('''
      CREATE TABLE IF NOT EXISTS offline_homework_submissions (
        id TEXT PRIMARY KEY,
        homework_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        content TEXT,
        attachments TEXT NOT NULL DEFAULT '[]',
        submitted_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING_SYNC',
        grade TEXT,
        feedback TEXT
      )
    ''');
  }

  // ── UUID Helpers ────────────────────────────────────────────────────

  static final _uuidRegex = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
  );

  static bool isUuid(String str) => _uuidRegex.hasMatch(str.trim());

  static String toValidUuid(String val, String namespacePrefix) {
    if (isUuid(val)) return val;
    return const Uuid().v5(
      Namespace.url.value,
      'edulanka:$namespacePrefix:$val',
    );
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

  Future<void> markOutboxEventFailed(
    String clientUuid,
    String errorMessage,
  ) async {
    final db = await database;
    await db.update(
      'sync_outbox',
      {'status': 'FAILED', 'error_message': errorMessage},
      where: 'client_uuid = ?',
      whereArgs: [clientUuid],
    );
  }

  Future<int> getFailedOutboxCount() async {
    final db = await database;
    final res = await db.rawQuery(
      "SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'FAILED'",
    );
    return Sqflite.firstIntValue(res) ?? 0;
  }

  Future<void> retryFailedOutboxEvents() async {
    final db = await database;
    await db.update(
      'sync_outbox',
      {'status': 'PENDING', 'error_message': null},
      where: 'status = ?',
      whereArgs: ['FAILED'],
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
    final clientUuid = isUuid(id) ? id : toValidUuid(id, 'att');
    final resolvedStudentId = isUuid(studentId) ? studentId : toValidUuid(studentId, 'student');
    final resolvedClassId = isUuid(classId) ? classId : toValidUuid(classId, 'class');
    final attendanceEntityId = const Uuid().v4();

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

    // Queue as a monotonic sync event (ADR-002) with guaranteed UUIDs
    await queueSyncEvent(
      clientUuid: clientUuid,
      entityType: 'attendance',
      entityId: attendanceEntityId,
      eventType: 'CREATED',
      payload: {
        'classId': resolvedClassId,
        'class_id': resolvedClassId,
        'studentId': resolvedStudentId,
        'student_id': resolvedStudentId,
        'date': date,
        'status': status,
        'markedAt': markedAt,
        'marked_at': markedAt,
      },
    );
  }

  Future<void> saveSyncedAttendance(
    Map<String, dynamic> payload, {
    String? entityId,
  }) async {
    final db = await database;
    final classId =
        (payload['class_id'] ?? payload['classId'])?.toString() ?? '';
    final studentId =
        (payload['student_id'] ?? payload['studentId'])?.toString() ??
        entityId ??
        '';
    final date = payload['date']?.toString() ?? '';
    final status = payload['status']?.toString() ?? 'PRESENT';
    final markedAt =
        (payload['marked_at'] ?? payload['markedAt'])?.toString() ??
        DateTime.now().toUtc().toIso8601String();
    final id =
        payload['id']?.toString() ?? entityId ?? '${studentId}_${classId}_$date';

    await db.insert('offline_attendance', {
      'id': id,
      'student_id': studentId,
      'class_id': classId,
      'date': date,
      'status': status,
      'marked_at': markedAt,
      'sync_status': 'SYNCED',
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> getAttendanceRecords() async {
    final db = await database;
    return await db.query(
      'offline_attendance',
      orderBy: 'marked_at DESC',
      limit: 50,
    );
  }

  // ── Chat Operations ────────────────────────────────────────────────

  Future<void> saveSyncedChatMessage(
    Map<String, dynamic> payload, {
    String? entityId,
  }) async {
    final db = await database;
    final id = payload['id']?.toString() ?? entityId ?? const Uuid().v4();
    final conversationId =
        (payload['conversation_id'] ??
                payload['conversationId'] ??
                payload['class_id'] ??
                payload['classId'])
            ?.toString() ??
        'default';
    final senderId =
        (payload['sender_id'] ?? payload['senderId'])?.toString() ?? '';
    final content =
        (payload['content'] ?? payload['text'] ?? payload['message'])
            ?.toString() ??
        '';
    final createdAt =
        (payload['created_at'] ?? payload['createdAt'])?.toString() ??
        DateTime.now().toUtc().toIso8601String();

    await db.insert('offline_chat_messages', {
      'id': id,
      'conversation_id': conversationId,
      'sender_id': senderId,
      'content': content,
      'created_at': createdAt,
    }, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<List<Map<String, dynamic>>> getChatMessages(
    String conversationId,
  ) async {
    final db = await database;
    return await db.query(
      'offline_chat_messages',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      orderBy: 'created_at ASC',
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

  // ── Snapshot Application ────────────────────────────────────────────

  Future<void> applySnapshot(Map<String, dynamic> snapshot) async {
    final db = await database;
    if (snapshot['classes'] is List) {
      await db.insert('sync_metadata', {
        'key': 'cached_classes',
        'value': jsonEncode(snapshot['classes']),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    if (snapshot['notices'] is List) {
      await db.insert('sync_metadata', {
        'key': 'cached_notices',
        'value': jsonEncode(snapshot['notices']),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
    if (snapshot['tenant'] is Map) {
      await db.insert('sync_metadata', {
        'key': 'cached_tenant',
        'value': jsonEncode(snapshot['tenant']),
      }, conflictAlgorithm: ConflictAlgorithm.replace);
    }
  }

  // ── Download Tasks Operations (ADR-001, P3-S6) ─────────────────────

  Future<void> saveDownloadTask(Map<String, dynamic> task) async {
    final db = await database;
    await db.insert('download_tasks', task,
        conflictAlgorithm: ConflictAlgorithm.replace);
  }

  Future<void> updateDownloadProgress({
    required String id,
    required int downloadedBytes,
    required int totalBytes,
  }) async {
    final db = await database;
    await db.update(
      'download_tasks',
      {
        'downloaded_bytes': downloadedBytes,
        'total_bytes': totalBytes,
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<void> updateDownloadStatus({
    required String id,
    required String status,
    String? error,
    String? localPath,
  }) async {
    final db = await database;
    final Map<String, dynamic> data = {'status': status};
    if (error != null) data['error'] = error;
    if (localPath != null) data['local_path'] = localPath;
    await db.update(
      'download_tasks',
      data,
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<List<Map<String, dynamic>>> getDownloadTasks() async {
    final db = await database;
    return await db.query('download_tasks', orderBy: 'downloaded_at DESC');
  }

  Future<Map<String, dynamic>?> getDownloadTask(String id) async {
    final db = await database;
    final res = await db.query(
      'download_tasks',
      where: 'id = ?',
      whereArgs: [id],
      limit: 1,
    );
    return res.isNotEmpty ? res.first : null;
  }

  Future<void> deleteDownloadTask(String id) async {
    final db = await database;
    await db.delete(
      'download_tasks',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  Future<List<String>> purgeExpiredDownloads() async {
    final db = await database;
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final expired = await db.query(
      'download_tasks',
      columns: ['id', 'local_path'],
      where: 'expires_at < ? AND status = ?',
      whereArgs: [nowMs, 'COMPLETED'],
    );

    final pathsToDelete = <String>[];
    for (final row in expired) {
      final p = row['local_path']?.toString();
      if (p != null && p.isNotEmpty) pathsToDelete.add(p);
    }

    if (expired.isNotEmpty) {
      await db.update(
        'download_tasks',
        {'status': 'EXPIRED'},
        where: 'expires_at < ? AND status = ?',
        whereArgs: [nowMs, 'COMPLETED'],
      );
    }
    return pathsToDelete;
  }

  // ── Homework Operations (P3-S3) ────────────────────────────────────

  Future<void> saveOfflineHomeworkTasks(List<dynamic> tasks) async {
    final db = await database;
    await db.transaction((txn) async {
      for (final t in tasks) {
        if (t is Map) {
          await txn.insert('offline_homework_tasks', {
            'id': t['id']?.toString() ?? const Uuid().v4(),
            'class_id': (t['class_id'] ?? t['classId'])?.toString() ?? '',
            'title': t['title']?.toString() ?? 'Homework',
            'description': t['description']?.toString() ?? '',
            'due_date': (t['due_date'] ?? t['dueDate'])?.toString() ?? '',
            'attachments': jsonEncode(t['attachments'] ?? []),
          }, conflictAlgorithm: ConflictAlgorithm.replace);
        }
      }
    });
  }

  Future<List<Map<String, dynamic>>> getOfflineHomeworkTasks({String? classId}) async {
    final db = await database;
    if (classId != null && classId.isNotEmpty) {
      return await db.query(
        'offline_homework_tasks',
        where: 'class_id = ?',
        whereArgs: [classId],
        orderBy: 'due_date ASC',
      );
    }
    return await db.query('offline_homework_tasks', orderBy: 'due_date ASC');
  }

  Future<void> recordHomeworkSubmission({
    required String homeworkId,
    required String studentId,
    String? content,
    List<dynamic>? attachments,
    String? clientUuid,
  }) async {
    final subId = clientUuid ?? const Uuid().v4();
    final now = DateTime.now().toUtc().toIso8601String();
    final db = await database;

    await db.insert('offline_homework_submissions', {
      'id': subId,
      'homework_id': homeworkId,
      'student_id': studentId,
      'content': content,
      'attachments': jsonEncode(attachments ?? []),
      'submitted_at': now,
      'status': 'PENDING_SYNC',
    }, conflictAlgorithm: ConflictAlgorithm.replace);

    // Queue in sync outbox (ADR-002)
    await queueSyncEvent(
      clientUuid: subId,
      entityType: 'homework_submission',
      entityId: subId,
      eventType: 'CREATED',
      payload: {
        'homework_id': homeworkId,
        'homeworkId': homeworkId,
        'student_id': studentId,
        'studentId': studentId,
        'content': content,
        'attachments': attachments ?? [],
      },
    );
  }

  Future<List<Map<String, dynamic>>> getOfflineHomeworkSubmissions({String? homeworkId}) async {
    final db = await database;
    if (homeworkId != null) {
      return await db.query(
        'offline_homework_submissions',
        where: 'homework_id = ?',
        whereArgs: [homeworkId],
      );
    }
    return await db.query('offline_homework_submissions');
  }

  // ── Database Wipe (Logout & User/Tenant Switch) ──────────────────────

  Future<void> clearAll() async {
    final db = await database;
    await db.delete('sync_outbox');
    await db.delete('sync_metadata');
    await db.delete('emergency_contacts');
    await db.delete('emergency_shelters');
    await db.delete('offline_attendance');
    await db.delete('offline_chat_messages');
    await db.delete('download_tasks');
    await db.delete('offline_homework_tasks');
    await db.delete('offline_homework_submissions');
  }
}
