import 'dart:io';
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

  static AppDriftDatabase createEncrypted() {
    return AppDriftDatabase(
      LazyDatabase(() async {
        final key = await EncryptionKeyStorage.getOrCreateKey();
        final dbFolder = await getApplicationDocumentsDirectory();
        final file = File(p.join(dbFolder.path, 'edulanka_encrypted.db'));

        return NativeDatabase(
          file,
          setup: (rawDb) {
            rawDb.execute("PRAGMA key = '$key';");
            rawDb.execute('PRAGMA cipher_memory_security = ON;');
          },
        );
      }),
    );
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
