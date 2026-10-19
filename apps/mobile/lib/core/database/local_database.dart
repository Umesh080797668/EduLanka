import 'dart:convert';
import 'dart:io';
import 'package:drift/drift.dart';
import 'package:flutter/foundation.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';
import '../download/download_manager.dart';
import 'drift_database.dart';

/// Offline-first database service for EduLanka mobile, backed by SQLCipher-encrypted Drift (ADR-005)
class LocalDatabase {
  static final LocalDatabase instance = LocalDatabase._init();

  LocalDatabase._init();

  AppDriftDatabase get driftDb => AppDriftDatabase.instance;

  Future<void> _initDb() async {
    await driftDb.ensureTables();
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
    await _initDb();
    await driftDb.customInsert(
      'INSERT OR REPLACE INTO sync_outbox (client_uuid, entity_type, entity_id, event_type, payload, created_at, status, server_sequence, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      variables: [
        Variable.withString(clientUuid),
        Variable.withString(entityType),
        Variable.withString(entityId),
        Variable.withString(eventType),
        Variable.withString(jsonEncode(payload)),
        Variable.withInt(DateTime.now().millisecondsSinceEpoch),
        Variable.withString('PENDING'),
        const Variable<int>(null),
        const Variable<String>(null),
      ],
    );
  }

  Future<List<Map<String, dynamic>>> getPendingOutboxEvents() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          "SELECT * FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC",
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  Future<int> getPendingOutboxCount() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          "SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'PENDING'",
        )
        .get();
    if (rows.isEmpty) return 0;
    return (rows.first.data['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> markOutboxEventSynced(String clientUuid, int? serverSeq) async {
    await _initDb();
    await driftDb.customUpdate(
      'UPDATE sync_outbox SET status = ?, server_sequence = ? WHERE client_uuid = ?',
      variables: [
        Variable.withString('SYNCED'),
        Variable<int>(serverSeq),
        Variable.withString(clientUuid),
      ],
    );
  }

  Future<void> markOutboxEventFailed(
    String clientUuid,
    String errorMessage,
  ) async {
    await _initDb();
    await driftDb.customUpdate(
      'UPDATE sync_outbox SET status = ?, error_message = ? WHERE client_uuid = ?',
      variables: [
        Variable.withString('FAILED'),
        Variable.withString(errorMessage),
        Variable.withString(clientUuid),
      ],
    );
  }

  Future<int> getFailedOutboxCount() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          "SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'FAILED'",
        )
        .get();
    if (rows.isEmpty) return 0;
    return (rows.first.data['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> retryFailedOutboxEvents() async {
    await _initDb();
    await driftDb.customUpdate(
      "UPDATE sync_outbox SET status = 'PENDING', error_message = NULL WHERE status = 'FAILED'",
    );
  }

  // ── Sync Metadata ──────────────────────────────────────────────────

  Future<int> getLastSequence() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          "SELECT value FROM sync_metadata WHERE key = 'last_sequence'",
        )
        .get();
    if (rows.isNotEmpty) {
      return int.tryParse(rows.first.data['value']?.toString() ?? '0') ?? 0;
    }
    return 0;
  }

  Future<void> setLastSequence(int seq) async {
    await _initDb();
    await driftDb.customInsert(
      "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_sequence', ?)",
      variables: [Variable.withString(seq.toString())],
    );
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
    final resolvedStudentId = isUuid(studentId)
        ? studentId
        : toValidUuid(studentId, 'student');
    final resolvedClassId = isUuid(classId)
        ? classId
        : toValidUuid(classId, 'class');
    final attendanceEntityId = const Uuid().v4();

    await _initDb();
    await driftDb.customInsert(
      'INSERT OR REPLACE INTO offline_attendance (id, student_id, class_id, date, status, marked_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      variables: [
        Variable.withString(id),
        Variable.withString(studentId),
        Variable.withString(classId),
        Variable.withString(date),
        Variable.withString(status),
        Variable.withString(markedAt),
        Variable.withString('PENDING'),
      ],
    );

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
    await _initDb();
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
        payload['id']?.toString() ??
        entityId ??
        '${studentId}_${classId}_$date';

    await driftDb.customInsert(
      'INSERT OR REPLACE INTO offline_attendance (id, student_id, class_id, date, status, marked_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      variables: [
        Variable.withString(id),
        Variable.withString(studentId),
        Variable.withString(classId),
        Variable.withString(date),
        Variable.withString(status),
        Variable.withString(markedAt),
        Variable.withString('SYNCED'),
      ],
    );
  }

  Future<List<Map<String, dynamic>>> getAttendanceRecords() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_attendance ORDER BY marked_at DESC LIMIT 50',
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  // ── Chat Operations ────────────────────────────────────────────────

  Future<void> saveSyncedChatMessage(
    Map<String, dynamic> payload, {
    String? entityId,
  }) async {
    await _initDb();
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

    await driftDb.customInsert(
      'INSERT OR REPLACE INTO offline_chat_messages (id, conversation_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
      variables: [
        Variable.withString(id),
        Variable.withString(conversationId),
        Variable.withString(senderId),
        Variable.withString(content),
        Variable.withString(createdAt),
      ],
    );
  }

  Future<List<Map<String, dynamic>>> getChatMessages(
    String conversationId,
  ) async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_chat_messages WHERE conversation_id = ? ORDER BY created_at ASC',
          variables: [Variable.withString(conversationId)],
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  // ── Disaster Readiness Pack ────────────────────────────────────────

  Future<void> saveDisasterPack({
    required List<dynamic> contacts,
    required List<dynamic> shelters,
  }) async {
    await _initDb();
    await driftDb.transaction(() async {
      await driftDb.customStatement('DELETE FROM emergency_contacts;');
      for (final c in contacts) {
        if (c is Map) {
          final id =
              c['id']?.toString() ??
              c['phone']?.toString() ??
              UniqueKey().toString();
          final name = c['name']?.toString() ?? 'Emergency Contact';
          final role = c['role']?.toString() ?? 'Official';
          final phone = c['phone']?.toString() ?? '';
          final isPrimary = c['isPrimary'] == true ? 1 : 0;

          await driftDb.customInsert(
            'INSERT INTO emergency_contacts (id, name, role, phone, is_primary) VALUES (?, ?, ?, ?, ?)',
            variables: [
              Variable.withString(id),
              Variable.withString(name),
              Variable.withString(role),
              Variable.withString(phone),
              Variable.withInt(isPrimary),
            ],
          );
        }
      }

      await driftDb.customStatement('DELETE FROM emergency_shelters;');
      for (final s in shelters) {
        if (s is Map) {
          final id = s['id']?.toString() ?? UniqueKey().toString();
          final name = s['name']?.toString() ?? 'Shelter';
          final address = s['address']?.toString() ?? '';
          final capacity = s['capacity'] is int ? s['capacity'] as int : null;
          final gpsLat = s['gpsLat'] is num
              ? (s['gpsLat'] as num).toDouble()
              : null;
          final gpsLng = s['gpsLng'] is num
              ? (s['gpsLng'] as num).toDouble()
              : null;
          final notes = s['notes']?.toString();

          await driftDb.customInsert(
            'INSERT INTO emergency_shelters (id, name, address, capacity, gps_lat, gps_lng, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            variables: [
              Variable.withString(id),
              Variable.withString(name),
              Variable.withString(address),
              Variable<int>(capacity),
              Variable<double>(gpsLat),
              Variable<double>(gpsLng),
              Variable<String>(notes),
            ],
          );
        }
      }
    });
  }

  Future<List<Map<String, dynamic>>> getEmergencyContacts() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM emergency_contacts ORDER BY is_primary DESC, name ASC',
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  Future<List<Map<String, dynamic>>> getEmergencyShelters() async {
    await _initDb();
    final rows = await driftDb
        .customSelect('SELECT * FROM emergency_shelters ORDER BY name ASC')
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  // ── Snapshot Application ────────────────────────────────────

  Future<void> applySnapshot(Map<String, dynamic> snapshot) async {
    await _initDb();
    if (snapshot['classes'] is List) {
      await driftDb.customInsert(
        "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('cached_classes', ?)",
        variables: [Variable.withString(jsonEncode(snapshot['classes']))],
      );
    }
    if (snapshot['notices'] is List) {
      await driftDb.customInsert(
        "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('cached_notices', ?)",
        variables: [Variable.withString(jsonEncode(snapshot['notices']))],
      );
    }
    if (snapshot['tenant'] is Map) {
      await driftDb.customInsert(
        "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('cached_tenant', ?)",
        variables: [Variable.withString(jsonEncode(snapshot['tenant']))],
      );
    }
  }

  // ── Download Tasks Operations (ADR-001, P3-S6) ─────────────────────

  Future<void> saveDownloadTask(Map<String, dynamic> task) async {
    await _initDb();
    await driftDb.customInsert(
      'INSERT OR REPLACE INTO download_tasks (id, asset_id, title, remote_url, local_path, total_bytes, downloaded_bytes, status, retention_days, downloaded_at, expires_at, encryption_key, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      variables: [
        Variable.withString(task['id'] as String),
        Variable.withString((task['asset_id'] ?? task['id']) as String),
        Variable.withString(task['title'] as String? ?? 'Lesson Video'),
        Variable.withString(task['remote_url'] as String? ?? ''),
        Variable.withString(task['local_path'] as String? ?? ''),
        Variable.withInt((task['total_bytes'] as num?)?.toInt() ?? 0),
        Variable.withInt((task['downloaded_bytes'] as num?)?.toInt() ?? 0),
        Variable.withString(task['status'] as String? ?? 'QUEUED'),
        Variable.withInt((task['retention_days'] as num?)?.toInt() ?? 30),
        Variable.withInt((task['downloaded_at'] as num?)?.toInt() ?? 0),
        Variable.withInt((task['expires_at'] as num?)?.toInt() ?? 0),
        Variable<String>(task['encryption_key'] as String?),
        Variable<String>(task['error'] as String?),
      ],
    );
  }

  Future<void> updateDownloadProgress({
    required String id,
    required int downloadedBytes,
    required int totalBytes,
  }) async {
    await _initDb();
    await driftDb.customUpdate(
      'UPDATE download_tasks SET downloaded_bytes = ?, total_bytes = ? WHERE id = ?',
      variables: [
        Variable.withInt(downloadedBytes),
        Variable.withInt(totalBytes),
        Variable.withString(id),
      ],
    );
  }

  Future<void> updateDownloadStatus({
    required String id,
    required String status,
    String? error,
    String? localPath,
  }) async {
    await _initDb();
    if (error != null && localPath != null) {
      await driftDb.customUpdate(
        'UPDATE download_tasks SET status = ?, error = ?, local_path = ? WHERE id = ?',
        variables: [
          Variable.withString(status),
          Variable.withString(error),
          Variable.withString(localPath),
          Variable.withString(id),
        ],
      );
    } else if (error != null) {
      await driftDb.customUpdate(
        'UPDATE download_tasks SET status = ?, error = ? WHERE id = ?',
        variables: [
          Variable.withString(status),
          Variable.withString(error),
          Variable.withString(id),
        ],
      );
    } else if (localPath != null) {
      await driftDb.customUpdate(
        'UPDATE download_tasks SET status = ?, local_path = ? WHERE id = ?',
        variables: [
          Variable.withString(status),
          Variable.withString(localPath),
          Variable.withString(id),
        ],
      );
    } else {
      await driftDb.customUpdate(
        'UPDATE download_tasks SET status = ? WHERE id = ?',
        variables: [Variable.withString(status), Variable.withString(id)],
      );
    }
  }

  Future<List<Map<String, dynamic>>> getDownloadTasks() async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM download_tasks ORDER BY downloaded_at DESC',
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  Future<Map<String, dynamic>?> getDownloadTask(String id) async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM download_tasks WHERE id = ? LIMIT 1',
          variables: [Variable.withString(id)],
        )
        .get();
    return rows.isNotEmpty ? Map<String, dynamic>.from(rows.first.data) : null;
  }

  Future<void> deleteDownloadTask(String id) async {
    await _initDb();
    await driftDb.customStatement('DELETE FROM download_tasks WHERE id = ?;', [
      id,
    ]);
  }

  Future<List<String>> purgeExpiredDownloads() async {
    await _initDb();
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final expiredRows = await driftDb
        .customSelect(
          'SELECT id, local_path FROM download_tasks WHERE expires_at < ? AND status = ?',
          variables: [
            Variable.withInt(nowMs),
            Variable.withString('COMPLETED'),
          ],
        )
        .get();

    final pathsToDelete = <String>[];
    for (final row in expiredRows) {
      final p = row.data['local_path']?.toString();
      if (p != null && p.isNotEmpty) pathsToDelete.add(p);
    }

    if (expiredRows.isNotEmpty) {
      await driftDb.customUpdate(
        'UPDATE download_tasks SET status = ? WHERE expires_at < ? AND status = ?',
        variables: [
          Variable.withString('EXPIRED'),
          Variable.withInt(nowMs),
          Variable.withString('COMPLETED'),
        ],
      );
    }
    return pathsToDelete;
  }

  /// Prunes offline SQLite cache records older than the plan's retention period (P3-S3).
  /// Pending unsynced mutations are strictly protected from deletion.
  Future<int> pruneExpiredCache(int retentionDays) async {
    if (retentionDays <= 0) return 0;
    await _initDb();

    final cutoff = DateTime.now().subtract(Duration(days: retentionDays));
    final cutoffIso = cutoff.toIso8601String();
    final cutoffMs = cutoff.millisecondsSinceEpoch;

    int totalPruned = 0;

    // 1. Synced outbox mutations older than retention
    final prunedOutbox = await driftDb.customUpdate(
      "DELETE FROM sync_outbox WHERE status = 'SYNCED' AND created_at < ?",
      variables: [Variable.withInt(cutoffMs)],
    );
    totalPruned += prunedOutbox;

    // 2. Synced offline attendance records older than retention
    final prunedAtt = await driftDb.customUpdate(
      "DELETE FROM offline_attendance WHERE sync_status = 'SYNCED' AND marked_at < ?",
      variables: [Variable.withString(cutoffIso)],
    );
    totalPruned += prunedAtt;

    // 3. Offline chat messages older than retention (strictly preserve unsent messages)
    final prunedChat = await driftDb.customUpdate(
      "DELETE FROM offline_chat_messages WHERE created_at < ? AND id NOT IN (SELECT client_uuid FROM sync_outbox WHERE status = 'PENDING') AND id NOT IN (SELECT entity_id FROM sync_outbox WHERE status = 'PENDING')",
      variables: [Variable.withString(cutoffIso)],
    );
    totalPruned += prunedChat;

    // 4. Synced homework submissions older than retention
    final prunedSub = await driftDb.customUpdate(
      "DELETE FROM offline_homework_submissions WHERE status != 'PENDING_SYNC' AND submitted_at < ? AND id NOT IN (SELECT client_uuid FROM sync_outbox WHERE status = 'PENDING') AND id NOT IN (SELECT entity_id FROM sync_outbox WHERE status = 'PENDING')",
      variables: [Variable.withString(cutoffIso)],
    );
    totalPruned += prunedSub;

    // 5. Offline blog comments older than retention (strictly preserve pending comments)
    final prunedComments = await driftDb.customUpdate(
      "DELETE FROM offline_blog_comments WHERE created_at < ? AND sync_status = 'SYNCED' AND id NOT IN (SELECT client_uuid FROM sync_outbox WHERE status = 'PENDING') AND id NOT IN (SELECT entity_id FROM sync_outbox WHERE status = 'PENDING')",
      variables: [Variable.withString(cutoffIso)],
    );
    totalPruned += prunedComments;

    // 6. Non-pinned offline blogs older than retention
    final prunedBlogs = await driftDb.customUpdate(
      "DELETE FROM offline_blogs WHERE is_pinned = 0 AND updated_at < ?",
      variables: [Variable.withString(cutoffIso)],
    );
    totalPruned += prunedBlogs;

    // 7. Expired saved papers and underlying downloaded files
    try {
      final expiredPapers = await driftDb
          .customSelect(
            'SELECT id, local_paper_path, local_scheme_path FROM offline_papers WHERE expires_at < ?',
            variables: [
              Variable.withInt(DateTime.now().millisecondsSinceEpoch),
            ],
          )
          .get();
      for (final row in expiredPapers) {
        final pPath = row.read<String?>('local_paper_path');
        final sPath = row.read<String?>('local_scheme_path');
        if (pPath != null) {
          final f = File(pPath);
          if (await f.exists()) await f.delete();
        }
        if (sPath != null) {
          final f = File(sPath);
          if (await f.exists()) await f.delete();
        }
      }
      final prunedPapers = await driftDb.customUpdate(
        'DELETE FROM offline_papers WHERE expires_at < ?',
        variables: [Variable.withInt(DateTime.now().millisecondsSinceEpoch)],
      );
      totalPruned += prunedPapers;
    } catch (_) {}

    // 8. Clean up orphaned or expired offline homework attachments
    // strictly protect attachments referenced by pending submissions in sync_outbox or offline_homework_submissions
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final offHwDir = Directory(
        p.join(appDir.path, 'offline_homework_attachments'),
      );
      if (await offHwDir.exists()) {
        final pendingOutbox = await driftDb
            .customSelect(
              "SELECT payload FROM sync_outbox WHERE status = 'PENDING'",
            )
            .get();
        final pendingSubmissions = await driftDb
            .customSelect(
              "SELECT attachments FROM offline_homework_submissions WHERE status = 'PENDING_SYNC'",
            )
            .get();

        final activeReferences = <String>{};
        for (final r in pendingOutbox) {
          final payloadStr = r.data['payload']?.toString() ?? '';
          activeReferences.add(payloadStr);
        }
        for (final r in pendingSubmissions) {
          final attStr = r.data['attachments']?.toString() ?? '';
          activeReferences.add(attStr);
        }

        final files = offHwDir.listSync();
        for (final entity in files) {
          if (entity is File) {
            final fileName = p.basename(entity.path);
            final isReferenced = activeReferences.any(
              (ref) => ref.contains(fileName) || ref.contains(entity.path),
            );
            if (!isReferenced) {
              final stat = entity.statSync();
              if (stat.modified.isBefore(cutoff)) {
                await entity.delete();
              }
            }
          }
        }
      }
    } catch (_) {}

    if (kDebugMode && totalPruned > 0) {
      debugPrint(
        '[LocalDatabase] Pruned $totalPruned expired cached records (retention: $retentionDays days).',
      );
    }

    return totalPruned;
  }

  // ── Homework Operations (P3-S3) ────────────────────────────────────

  Future<void> saveOfflineHomeworkTasks(List<dynamic> tasks) async {
    await _initDb();
    await driftDb.transaction(() async {
      for (final t in tasks) {
        if (t is Map) {
          final id = t['id']?.toString() ?? const Uuid().v4();
          final classId = (t['class_id'] ?? t['classId'])?.toString() ?? '';
          final title = t['title']?.toString() ?? 'Homework';
          final description = t['description']?.toString() ?? '';
          final dueDate = (t['due_date'] ?? t['dueDate'])?.toString() ?? '';
          final attachments = jsonEncode(t['attachments'] ?? []);

          await driftDb.customInsert(
            'INSERT OR REPLACE INTO offline_homework_tasks (id, class_id, title, description, due_date, attachments) VALUES (?, ?, ?, ?, ?, ?)',
            variables: [
              Variable.withString(id),
              Variable.withString(classId),
              Variable.withString(title),
              Variable.withString(description),
              Variable.withString(dueDate),
              Variable.withString(attachments),
            ],
          );
        }
      }
    });
  }

  Future<List<Map<String, dynamic>>> getOfflineHomeworkTasks({
    String? classId,
  }) async {
    await _initDb();
    if (classId != null && classId.isNotEmpty) {
      final rows = await driftDb
          .customSelect(
            'SELECT * FROM offline_homework_tasks WHERE class_id = ? ORDER BY due_date ASC',
            variables: [Variable.withString(classId)],
          )
          .get();
      return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
    }
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_homework_tasks ORDER BY due_date ASC',
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
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
    await _initDb();

    await driftDb.customInsert(
      'INSERT OR REPLACE INTO offline_homework_submissions (id, homework_id, student_id, content, attachments, submitted_at, status, grade, feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      variables: [
        Variable.withString(subId),
        Variable.withString(homeworkId),
        Variable.withString(studentId),
        Variable<String>(content),
        Variable.withString(jsonEncode(attachments ?? [])),
        Variable.withString(now),
        Variable.withString('PENDING_SYNC'),
        const Variable<String>(null),
        const Variable<String>(null),
      ],
    );

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

  Future<List<Map<String, dynamic>>> getOfflineHomeworkSubmissions({
    String? homeworkId,
  }) async {
    await _initDb();
    if (homeworkId != null) {
      final rows = await driftDb
          .customSelect(
            'SELECT * FROM offline_homework_submissions WHERE homework_id = ?',
            variables: [Variable.withString(homeworkId)],
          )
          .get();
      return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
    }
    final rows = await driftDb
        .customSelect('SELECT * FROM offline_homework_submissions')
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  // ── Educational Blogs & Discourse (P3-S11) ──────────────────────────

  Future<void> saveSyncedBlogPost(
    Map<String, dynamic> payload, {
    String? entityId,
    String? eventType,
  }) async {
    await _initDb();
    final id = entityId ?? payload['id']?.toString() ?? '';
    if (id.isEmpty) return;

    if (eventType == 'DELETED') {
      await driftDb.customUpdate(
        'DELETE FROM offline_blogs WHERE id = ?',
        variables: [Variable.withString(id)],
      );
      return;
    }

    final attachments = payload['attachments'] is List
        ? jsonEncode(payload['attachments'])
        : (payload['attachments']?.toString() ?? '[]');
    final tags = payload['tags'] is List
        ? jsonEncode(payload['tags'])
        : (payload['tags']?.toString() ?? '[]');

    await driftDb.customInsert(
      '''
      INSERT OR REPLACE INTO offline_blogs (
        id, tenant_id, scope, class_id, author_id, author_name, author_role,
        title, content_markdown, cover_image_url, attachments, tags,
        is_published, is_pinned, likes_count, comments_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ''',
      variables: [
        Variable.withString(id),
        Variable<String>(payload['tenant_id']?.toString()),
        Variable.withString(payload['scope']?.toString() ?? 'SCHOOL'),
        Variable<String>(payload['class_id']?.toString()),
        Variable.withString(payload['author_id']?.toString() ?? ''),
        Variable.withString(payload['author_name']?.toString() ?? 'Educator'),
        Variable.withString(payload['author_role']?.toString() ?? 'TEACHER'),
        Variable.withString(payload['title']?.toString() ?? ''),
        Variable.withString(payload['content_markdown']?.toString() ?? ''),
        Variable<String>(payload['cover_image_url']?.toString()),
        Variable.withString(attachments),
        Variable.withString(tags),
        Variable.withInt(payload['is_published'] == false ? 0 : 1),
        Variable.withInt(payload['is_pinned'] == true ? 1 : 0),
        Variable.withInt((payload['likes_count'] as num?)?.toInt() ?? 0),
        Variable.withInt((payload['comments_count'] as num?)?.toInt() ?? 0),
        Variable.withString(
          payload['created_at']?.toString() ?? DateTime.now().toIso8601String(),
        ),
        Variable.withString(
          payload['updated_at']?.toString() ?? DateTime.now().toIso8601String(),
        ),
      ],
    );
  }

  Future<void> saveSyncedBlogComment(
    Map<String, dynamic> payload, {
    String? entityId,
    String? eventType,
  }) async {
    await _initDb();
    final id = entityId ?? payload['id']?.toString() ?? '';
    if (id.isEmpty) return;

    if (eventType == 'DELETED') {
      await driftDb.customUpdate(
        'DELETE FROM offline_blog_comments WHERE id = ?',
        variables: [Variable.withString(id)],
      );
      return;
    }

    await driftDb.customInsert(
      '''
      INSERT OR REPLACE INTO offline_blog_comments (
        id, blog_id, parent_id, author_id, author_name, author_role,
        content, is_pinned, is_hidden, likes_count, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ''',
      variables: [
        Variable.withString(id),
        Variable.withString(
          payload['blog_id']?.toString() ?? payload['blogId']?.toString() ?? '',
        ),
        Variable<String>(
          payload['parent_id']?.toString() ?? payload['parentId']?.toString(),
        ),
        Variable.withString(
          payload['author_id']?.toString() ??
              payload['authorId']?.toString() ??
              '',
        ),
        Variable.withString(
          payload['author_name']?.toString() ??
              payload['authorName']?.toString() ??
              'Member',
        ),
        Variable.withString(
          payload['author_role']?.toString() ??
              payload['authorRole']?.toString() ??
              'STUDENT',
        ),
        Variable.withString(payload['content']?.toString() ?? ''),
        Variable.withInt(payload['is_pinned'] == true ? 1 : 0),
        Variable.withInt(payload['is_hidden'] == true ? 1 : 0),
        Variable.withInt((payload['likes_count'] as num?)?.toInt() ?? 0),
        Variable.withString(
          payload['created_at']?.toString() ?? DateTime.now().toIso8601String(),
        ),
        Variable.withString('SYNCED'),
      ],
    );
  }

  Future<void> saveSyncedBlogReaction(
    Map<String, dynamic> payload, {
    String? entityId,
    String? eventType,
  }) async {
    await _initDb();
    final id = entityId ?? payload['id']?.toString() ?? '';
    if (id.isEmpty) return;

    if (eventType == 'REMOVED' || eventType == 'DELETED') {
      await driftDb.customUpdate(
        'DELETE FROM offline_blog_reactions WHERE id = ?',
        variables: [Variable.withString(id)],
      );
      return;
    }

    await driftDb.customInsert(
      '''
      INSERT OR REPLACE INTO offline_blog_reactions (
        id, blog_id, comment_id, user_id, reaction_type, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ''',
      variables: [
        Variable.withString(id),
        Variable<String>(
          payload['blog_id']?.toString() ?? payload['blogId']?.toString(),
        ),
        Variable<String>(
          payload['comment_id']?.toString() ?? payload['commentId']?.toString(),
        ),
        Variable.withString(
          payload['user_id']?.toString() ?? payload['userId']?.toString() ?? '',
        ),
        Variable.withString(
          payload['reaction_type']?.toString() ??
              payload['reactionType']?.toString() ??
              'LIKE',
        ),
        Variable.withString(
          payload['created_at']?.toString() ?? DateTime.now().toIso8601String(),
        ),
        Variable.withString('SYNCED'),
      ],
    );
  }

  Future<List<Map<String, dynamic>>> getOfflineBlogs({
    String? scope,
    String? classId,
  }) async {
    await _initDb();
    String query = 'SELECT * FROM offline_blogs WHERE is_published = 1';
    final List<Variable> variables = [];

    if (scope != null) {
      query += ' AND scope = ?';
      variables.add(Variable.withString(scope));
    }
    if (classId != null) {
      query += ' AND class_id = ?';
      variables.add(Variable.withString(classId));
    }

    query += ' ORDER BY is_pinned DESC, created_at DESC';
    final rows = await driftDb.customSelect(query, variables: variables).get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  Future<Map<String, dynamic>?> getOfflineBlogById(String id) async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_blogs WHERE id = ?',
          variables: [Variable.withString(id)],
        )
        .get();
    if (rows.isEmpty) return null;
    return Map<String, dynamic>.from(rows.first.data);
  }

  Future<List<Map<String, dynamic>>> getOfflineCommentsForBlog(
    String blogId,
  ) async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_blog_comments WHERE blog_id = ? AND is_hidden = 0 ORDER BY is_pinned DESC, created_at ASC',
          variables: [Variable.withString(blogId)],
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  Future<List<Map<String, dynamic>>> getOfflineReactionsForBlog(
    String blogId,
  ) async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_blog_reactions WHERE blog_id = ?',
          variables: [Variable.withString(blogId)],
        )
        .get();
    return rows.map((r) => Map<String, dynamic>.from(r.data)).toList();
  }

  Future<void> saveOfflineComment({
    required String blogId,
    required String authorId,
    required String authorName,
    required String authorRole,
    required String content,
    String? parentId,
  }) async {
    await _initDb();
    final commentId = const Uuid().v4();
    final clientUuid = const Uuid().v4();
    final nowIso = DateTime.now().toIso8601String();

    await driftDb.customInsert(
      '''
      INSERT INTO offline_blog_comments (
        id, blog_id, parent_id, author_id, author_name, author_role,
        content, is_pinned, is_hidden, likes_count, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'PENDING')
      ''',
      variables: [
        Variable.withString(commentId),
        Variable.withString(blogId),
        Variable<String>(parentId),
        Variable.withString(authorId),
        Variable.withString(authorName),
        Variable.withString(authorRole),
        Variable.withString(content),
        Variable.withString(nowIso),
      ],
    );

    // Increment comments_count locally on the blog
    await driftDb.customUpdate(
      'UPDATE offline_blogs SET comments_count = comments_count + 1 WHERE id = ?',
      variables: [Variable.withString(blogId)],
    );

    // Queue in sync_outbox
    await queueSyncEvent(
      clientUuid: clientUuid,
      entityType: 'blog_comment',
      entityId: commentId,
      eventType: 'CREATED',
      payload: {
        'id': commentId,
        'blog_id': blogId,
        'blogId': blogId,
        'parent_id': parentId,
        'parentId': parentId,
        'author_id': authorId,
        'author_name': authorName,
        'author_role': authorRole,
        'content': content,
        'created_at': nowIso,
      },
    );
  }

  Future<void> saveOfflineReaction({
    required String? blogId,
    required String? commentId,
    required String userId,
    required String reactionType,
  }) async {
    await _initDb();
    final reactionId = const Uuid().v4();
    final clientUuid = const Uuid().v4();
    final nowIso = DateTime.now().toIso8601String();

    await driftDb.customInsert(
      '''
      INSERT INTO offline_blog_reactions (
        id, blog_id, comment_id, user_id, reaction_type, created_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
      ''',
      variables: [
        Variable.withString(reactionId),
        Variable<String>(blogId),
        Variable<String>(commentId),
        Variable.withString(userId),
        Variable.withString(reactionType),
        Variable.withString(nowIso),
      ],
    );

    // Queue in sync_outbox
    await queueSyncEvent(
      clientUuid: clientUuid,
      entityType: 'blog_reaction',
      entityId: reactionId,
      eventType: 'CREATED',
      payload: {
        'id': reactionId,
        'blog_id': blogId,
        'blogId': blogId,
        'comment_id': commentId,
        'commentId': commentId,
        'user_id': userId,
        'reaction_type': reactionType,
        'reactionType': reactionType,
        'created_at': nowIso,
      },
    );
  }

  // ── Database Wipe (Logout & User/Tenant Switch) ──────────────────────

  Future<void> clearAll() async {
    await _initDb();
    await driftDb.transaction(() async {
      await driftDb.customStatement('DELETE FROM sync_outbox;');
      await driftDb.customStatement('DELETE FROM sync_metadata;');
      await driftDb.customStatement('DELETE FROM emergency_contacts;');
      await driftDb.customStatement('DELETE FROM emergency_shelters;');
      await driftDb.customStatement('DELETE FROM offline_attendance;');
      await driftDb.customStatement('DELETE FROM offline_chat_messages;');
      await driftDb.customStatement('DELETE FROM download_tasks;');
      await driftDb.customStatement('DELETE FROM offline_homework_tasks;');
      await driftDb.customStatement(
        'DELETE FROM offline_homework_submissions;',
      );
      await driftDb.customStatement('DELETE FROM offline_blogs;');
      await driftDb.customStatement('DELETE FROM offline_blog_comments;');
      await driftDb.customStatement('DELETE FROM offline_blog_reactions;');
      await driftDb.customStatement('DELETE FROM offline_papers;');
    });

    // Wipe physical downloaded / cached files on logout or tenant switch
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final papersDir = Directory(p.join(appDir.path, 'offline_papers'));
      if (await papersDir.exists()) {
        await papersDir.delete(recursive: true);
      }
      final hwDir = Directory(
        p.join(appDir.path, 'offline_homework_attachments'),
      );
      if (await hwDir.exists()) {
        await hwDir.delete(recursive: true);
      }
    } catch (_) {}

    try {
      await DownloadManager.instance.purgeAllDownloads();
    } catch (_) {}
  }

  // ── Offline Papers (P3-S7) ──────────────────────────────────────────

  Future<void> saveOfflinePaper({
    required String id,
    required Map<String, dynamic> paper,
    String? localPaperPath,
    String? localSchemePath,
    int retentionDays = 30,
  }) async {
    await _initDb();
    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final expiresMs =
        nowMs + (retentionDays > 0 ? retentionDays : 365) * 24 * 3600 * 1000;

    await driftDb.customStatement(
      '''
      INSERT OR REPLACE INTO offline_papers (
        id, tenant_id, title, subject, grade_level, exam_type, medium, year, term,
        paper_url, marking_scheme_url, local_paper_path, local_scheme_path,
        downloaded_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      ''',
      [
        id,
        paper['tenant_id']?.toString() ?? '',
        paper['title']?.toString() ?? 'Examination Past Paper',
        paper['subject']?.toString() ?? '',
        paper['grade_level'] is int
            ? paper['grade_level']
            : int.tryParse(paper['grade_level']?.toString() ?? ''),
        paper['exam_type']?.toString(),
        paper['medium']?.toString(),
        paper['year'] is int
            ? paper['year']
            : int.tryParse(paper['year']?.toString() ?? ''),
        paper['term']?.toString(),
        paper['paper_url']?.toString() ?? '',
        paper['marking_scheme_url']?.toString(),
        localPaperPath,
        localSchemePath,
        nowMs,
        expiresMs,
      ],
    );
  }

  /// Rebuilds missing offline_papers rows from completed paper_* download tasks (P3-S7)
  Future<void> rebuildMissingOfflinePapers() async {
    await _initDb();
    try {
      final tasks = await driftDb
          .customSelect(
            "SELECT * FROM download_tasks WHERE id LIKE 'paper_%' AND status = 'COMPLETED'",
          )
          .get();

      for (final row in tasks) {
        final taskId = row.data['id']?.toString() ?? '';
        final paperId = taskId.replaceFirst('paper_', '');
        if (paperId.isEmpty) continue;

        final localPath = row.data['local_path']?.toString();
        if (localPath == null || !File(localPath).existsSync()) continue;

        final existing = await getOfflinePaper(paperId);
        if (existing == null) {
          // Check if scheme task also completed
          final schemeRows = await driftDb
              .customSelect(
                "SELECT local_path FROM download_tasks WHERE id = ? AND status = 'COMPLETED'",
                variables: [Variable.withString('scheme_$paperId')],
              )
              .get();
          final schemePath = schemeRows.isNotEmpty
              ? schemeRows.first.data['local_path']?.toString()
              : null;

          final rawTitle =
              row.data['title']?.toString() ?? 'Examination Past Paper';
          final cleanTitle = rawTitle.replaceAll(' (Paper)', '').trim();
          final remoteUrl = row.data['remote_url']?.toString() ?? '';
          final downloadedAt =
              (row.data['downloaded_at'] as num?)?.toInt() ??
              DateTime.now().millisecondsSinceEpoch;
          final expiresAt =
              (row.data['expires_at'] as num?)?.toInt() ??
              (downloadedAt + 30 * 24 * 3600 * 1000);

          await driftDb.customStatement(
            '''
            INSERT OR REPLACE INTO offline_papers (
              id, tenant_id, title, subject, grade_level, exam_type, medium, year, term,
              paper_url, marking_scheme_url, local_paper_path, local_scheme_path,
              downloaded_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            ''',
            [
              paperId,
              '',
              cleanTitle,
              '',
              null,
              null,
              null,
              null,
              null,
              remoteUrl,
              null,
              localPath,
              schemePath,
              downloadedAt,
              expiresAt,
            ],
          );
        } else if (existing['local_paper_path'] == null ||
            existing['local_paper_path'] != localPath) {
          await driftDb.customUpdate(
            'UPDATE offline_papers SET local_paper_path = ? WHERE id = ?',
            variables: [
              Variable.withString(localPath),
              Variable.withString(paperId),
            ],
          );
        }
      }
    } catch (_) {}
  }

  Future<List<Map<String, dynamic>>> getOfflinePapers({
    String? subject,
    int? gradeLevel,
    String? examType,
    String? medium,
  }) async {
    await _initDb();
    await rebuildMissingOfflinePapers();
    final conditions = <String>['1=1'];
    final variables = <Variable>[];

    if (subject != null && subject.isNotEmpty && subject != 'All') {
      conditions.add('subject = ?');
      variables.add(Variable.withString(subject));
    }
    if (gradeLevel != null) {
      conditions.add('grade_level = ?');
      variables.add(Variable.withInt(gradeLevel));
    }
    if (examType != null && examType.isNotEmpty && examType != 'All') {
      conditions.add('exam_type = ?');
      variables.add(Variable.withString(examType));
    }
    if (medium != null && medium.isNotEmpty && medium != 'All') {
      conditions.add('medium = ?');
      variables.add(Variable.withString(medium));
    }

    final query =
        'SELECT * FROM offline_papers WHERE ${conditions.join(' AND ')} ORDER BY downloaded_at DESC;';
    final rows = await driftDb.customSelect(query, variables: variables).get();
    return rows.map((r) => r.data).toList();
  }

  Future<Map<String, dynamic>?> getOfflinePaper(String id) async {
    await _initDb();
    final rows = await driftDb
        .customSelect(
          'SELECT * FROM offline_papers WHERE id = ? LIMIT 1',
          variables: [Variable.withString(id)],
        )
        .get();
    return rows.isEmpty ? null : rows.first.data;
  }

  Future<void> deleteOfflinePaper(String id) async {
    await _initDb();
    final row = await getOfflinePaper(id);
    if (row != null) {
      final pPath = row['local_paper_path']?.toString();
      final sPath = row['local_scheme_path']?.toString();
      if (pPath != null) {
        final f = File(pPath);
        if (await f.exists()) await f.delete();
      }
      if (sPath != null) {
        final f = File(sPath);
        if (await f.exists()) await f.delete();
      }
    }
    await driftDb.customUpdate(
      'DELETE FROM offline_papers WHERE id = ?',
      variables: [Variable.withString(id)],
    );
  }
}
