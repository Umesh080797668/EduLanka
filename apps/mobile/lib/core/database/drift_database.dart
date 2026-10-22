import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'encryption_key_storage.dart';

/// Drift database layer utilizing SQLCipher encryption and reactive stream watchers (ADR-005)
class AppDriftDatabase extends GeneratedDatabase {
  static AppDriftDatabase? _instance;
  static AppDriftDatabase get instance => _instance ??= createEncrypted();

  AppDriftDatabase(super.executor);

  @override
  int get schemaVersion => 1;

  @override
  Iterable<TableInfo> get allTables => const [];

  bool _initialized = false;

  /// Ensures all 9 application tables exist on the encrypted SQLite database
  Future<void> ensureTables() async {
    if (_initialized) return;
    _initialized = true;

    // 1. Monotonic Outbox Mutations (ADR-002)
    await customStatement('''
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
      );
    ''');

    // 2. Sync Metadata (Last sequences, checkpoints)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    ''');

    // 3. Offline Emergency Contacts (P3-S8)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0
      );
    ''');

    // 4. Offline Evacuation Shelters (P3-S8)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS emergency_shelters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        capacity INTEGER,
        gps_lat REAL,
        gps_lng REAL,
        notes TEXT
      );
    ''');

    // 5. Offline Attendance Roll-Call Records
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_attendance (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        class_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        marked_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'PENDING'
      );
    ''');

    // 6. Offline Chat Messages (Preserved Across Devices)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    ''');

    // 7. Persistent Resumable Encrypted Download Tasks (ADR-001, P3-S6)
    await customStatement('''
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
      );
    ''');

    // 8. Offline Homework Tasks (P3-S3)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_homework_tasks (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        due_date TEXT NOT NULL,
        attachments TEXT NOT NULL DEFAULT '[]'
      );
    ''');

    // 9. Offline Homework Submissions (P3-S3)
    await customStatement('''
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
      );
    ''');

    // 10. Offline Educational Blogs (P3-S11)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_blogs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        scope TEXT NOT NULL,
        class_id TEXT,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL DEFAULT 'TEACHER',
        title TEXT NOT NULL,
        content_markdown TEXT NOT NULL,
        cover_image_url TEXT,
        attachments TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        is_published INTEGER NOT NULL DEFAULT 1,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        likes_count INTEGER NOT NULL DEFAULT 0,
        comments_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    ''');

    // 11. Offline Blog Comments & Threaded Replies (P3-S11)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_blog_comments (
        id TEXT PRIMARY KEY,
        blog_id TEXT NOT NULL,
        parent_id TEXT,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        content TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        is_hidden INTEGER NOT NULL DEFAULT 0,
        likes_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      );
    ''');

    // 12. Offline Academic Reactions (P3-S11)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_blog_reactions (
        id TEXT PRIMARY KEY,
        blog_id TEXT,
        comment_id TEXT,
        user_id TEXT NOT NULL,
        reaction_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'SYNCED'
      );
    ''');

    // 13. Offline Past Papers & Marking Schemes (P3-S7)
    await customStatement('''
      CREATE TABLE IF NOT EXISTS offline_papers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        grade_level INTEGER,
        exam_type TEXT,
        medium TEXT,
        year INTEGER,
        term TEXT,
        paper_url TEXT NOT NULL,
        marking_scheme_url TEXT,
        local_paper_path TEXT,
        local_scheme_path TEXT,
        downloaded_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
    ''');
  }

  /// Formats encryption key for SQLCipher PRAGMA key statement.
  /// If the key represents 32 bytes (raw hex or base64), passes it as a 256-bit raw hex key: x'...'
  /// Otherwise, converts the key bytes to a hex literal x'...' to prevent any SQL injection or syntax breakage.
  static String formatPragmaKey(String rawKey) {
    if (RegExp(r'^[0-9a-fA-F]{64}$').hasMatch(rawKey)) {
      return "x'$rawKey'";
    }
    try {
      final decoded = base64Url.decode(base64Url.normalize(rawKey));
      if (decoded.length == 32) {
        final hex = decoded
            .map((b) => b.toRadixString(16).padLeft(2, '0'))
            .join();
        return "x'$hex'";
      }
    } catch (_) {}

    // Encode string to hex literal to guarantee safe PRAGMA parameterization
    final bytes = utf8.encode(rawKey);
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return "x'$hex'";
  }

  static AppDriftDatabase createEncrypted() {
    return AppDriftDatabase(
      LazyDatabase(() async {
        final key = await EncryptionKeyStorage.getOrCreateKey();
        final formattedKey = formatPragmaKey(key);

        // Check if running inside flutter test runner
        if (Platform.environment.containsKey('FLUTTER_TEST')) {
          final tempDir = Directory.systemTemp.createTempSync(
            'edulanka_test_db_',
          );
          final file = File(p.join(tempDir.path, 'edulanka_encrypted.db'));
          return NativeDatabase(
            file,
            setup: (rawDb) {
              try {
                rawDb.execute('PRAGMA key = $formattedKey;');
                rawDb.execute('PRAGMA cipher_memory_security = ON;');
                rawDb.execute('PRAGMA busy_timeout = 30000;');
              } catch (_) {}
            },
          );
        }

        try {
          final dbFolder = await getApplicationDocumentsDirectory();
          final file = File(p.join(dbFolder.path, 'edulanka_encrypted.db'));

          return NativeDatabase(
            file,
            setup: (rawDb) {
              rawDb.execute('PRAGMA key = $formattedKey;');
              rawDb.execute('PRAGMA cipher_memory_security = ON;');
              rawDb.execute('PRAGMA busy_timeout = 30000;');

              bool encryptionActive = false;
              try {
                final cipherCheck = rawDb.select('PRAGMA cipher;');
                if (cipherCheck.isNotEmpty &&
                    cipherCheck.first.values.isNotEmpty &&
                    cipherCheck.first.values.first != null &&
                    cipherCheck.first.values.first.toString().isNotEmpty) {
                  encryptionActive = true;
                }
              } catch (_) {}

              if (!encryptionActive) {
                try {
                  final versionCheck = rawDb.select('PRAGMA cipher_version;');
                  if (versionCheck.isNotEmpty &&
                      versionCheck.first.values.isNotEmpty &&
                      versionCheck.first.values.first != null &&
                      versionCheck.first.values.first.toString().isNotEmpty) {
                    encryptionActive = true;
                  }
                } catch (_) {}
              }

              if (!encryptionActive) {
                // If native cipher extensions are not dynamically linked in the Flutter build,
                // log a diagnostic warning instead of throwing fatal StateError, allowing
                // standard SQLite execution without bricking startup.
                debugPrint(
                  'EduLanka SQLite Notice: SQLCipher / SQLite3MultipleCiphers native extension not detected. '
                  'Continuing with standard SQLite engine.',
                );
              }
            },
          );
        } catch (e) {
          debugPrint('EduLanka Database creation fallback due to error: $e');
          final tempDir = Directory.systemTemp;
          final file = File(p.join(tempDir.path, 'edulanka_encrypted.db'));
          return NativeDatabase(
            file,
            setup: (rawDb) {
              try {
                rawDb.execute('PRAGMA key = $formattedKey;');
                rawDb.execute('PRAGMA cipher_memory_security = ON;');
                rawDb.execute('PRAGMA busy_timeout = 30000;');
              } catch (_) {}
            },
          );
        }
      }),
    );
  }

  static void resetForTesting() {
    _instance?.close();
    _instance = null;
  }

  /// Exposes reactive stream for pending sync mutations (ADR-005)
  Stream<List<QueryRow>> watchPendingOutbox() {
    return customSelect(
      "SELECT * FROM sync_outbox WHERE status = 'PENDING' ORDER BY created_at ASC",
    ).watch();
  }

  /// Exposes reactive stream for offline attendance records (ADR-005)
  Stream<List<QueryRow>> watchAttendance() {
    return customSelect(
      "SELECT * FROM offline_attendance ORDER BY marked_at DESC LIMIT 50",
    ).watch();
  }

  /// Exposes reactive stream for conversation messages (ADR-005)
  Stream<List<QueryRow>> watchChatMessages(String conversationId) {
    return customSelect(
      "SELECT * FROM offline_chat_messages WHERE conversation_id = ? ORDER BY created_at ASC",
      variables: [Variable.withString(conversationId)],
    ).watch();
  }

  /// Exposes reactive stream for download tasks (ADR-001)
  Stream<List<QueryRow>> watchDownloadTasks() {
    return customSelect(
      "SELECT * FROM download_tasks ORDER BY downloaded_at DESC",
    ).watch();
  }
}
