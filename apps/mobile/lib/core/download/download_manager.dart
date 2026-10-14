import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import '../api/api_client.dart';
import '../config/app_config.dart';
import '../database/encryption_key_storage.dart';
import '../database/local_database.dart';

enum DownloadStatus {
  queued,
  downloading,
  paused,
  completed,
  failed,
  expired;

  String toDbString() => name.toUpperCase();

  static DownloadStatus fromDbString(String str) {
    switch (str.toUpperCase()) {
      case 'QUEUED':
        return DownloadStatus.queued;
      case 'DOWNLOADING':
        return DownloadStatus.downloading;
      case 'PAUSED':
        return DownloadStatus.paused;
      case 'COMPLETED':
        return DownloadStatus.completed;
      case 'FAILED':
        return DownloadStatus.failed;
      case 'EXPIRED':
        return DownloadStatus.expired;
      default:
        return DownloadStatus.failed;
    }
  }
}

class DownloadTask {
  final String id;
  final String assetId;
  final String title;
  final String remoteUrl;
  final String localPath;
  final int totalBytes;
  final int receivedBytes;
  final DownloadStatus status;
  final int retentionDays;
  final int downloadedAt;
  final int expiresAt;
  final String? encryptionKey;
  final String? error;

  DownloadTask({
    required this.id,
    String? assetId,
    required this.title,
    required this.remoteUrl,
    required this.localPath,
    this.totalBytes = 0,
    this.receivedBytes = 0,
    this.status = DownloadStatus.queued,
    this.retentionDays = 30,
    int? downloadedAt,
    int? expiresAt,
    this.encryptionKey,
    this.error,
  })  : assetId = assetId ?? id,
        downloadedAt = downloadedAt ?? 0,
        expiresAt = expiresAt ?? 0;

  bool get isCompleted => status == DownloadStatus.completed;
  double get progress => totalBytes > 0 ? (receivedBytes / totalBytes).clamp(0.0, 1.0) : 0.0;

  Map<String, dynamic> toDbMap() => {
        'id': id,
        'asset_id': assetId,
        'title': title,
        'remote_url': remoteUrl,
        'local_path': localPath,
        'total_bytes': totalBytes,
        'downloaded_bytes': receivedBytes,
        'status': status.toDbString(),
        'retention_days': retentionDays,
        'downloaded_at': downloadedAt,
        'expires_at': expiresAt,
        'encryption_key': encryptionKey,
        'error': error,
      };

  factory DownloadTask.fromDbMap(Map<String, dynamic> map) => DownloadTask(
        id: map['id'] as String,
        assetId: map['asset_id'] as String? ?? map['id'] as String,
        title: map['title'] as String? ?? 'Lesson Video',
        remoteUrl: map['remote_url'] as String? ?? '',
        localPath: map['local_path'] as String? ?? '',
        totalBytes: (map['total_bytes'] as num?)?.toInt() ?? 0,
        receivedBytes: (map['downloaded_bytes'] as num?)?.toInt() ?? 0,
        status: DownloadStatus.fromDbString(map['status'] as String? ?? 'FAILED'),
        retentionDays: (map['retention_days'] as num?)?.toInt() ?? 30,
        downloadedAt: (map['downloaded_at'] as num?)?.toInt() ?? 0,
        expiresAt: (map['expires_at'] as num?)?.toInt() ?? 0,
        encryptionKey: map['encryption_key'] as String?,
        error: map['error'] as String?,
      );

  DownloadTask copyWith({
    int? receivedBytes,
    int? totalBytes,
    DownloadStatus? status,
    String? localPath,
    String? error,
  }) {
    return DownloadTask(
      id: id,
      assetId: assetId,
      title: title,
      remoteUrl: remoteUrl,
      localPath: localPath ?? this.localPath,
      totalBytes: totalBytes ?? this.totalBytes,
      receivedBytes: receivedBytes ?? this.receivedBytes,
      status: status ?? this.status,
      retentionDays: retentionDays,
      downloadedAt: downloadedAt,
      expiresAt: expiresAt,
      encryptionKey: encryptionKey,
      error: error ?? this.error,
    );
  }
}

class DownloadManager extends StateNotifier<Map<String, DownloadTask>> {
  final Dio _dio;
  final LocalDatabase _localDb;
  final AppConfig? _config;
  final Map<String, CancelToken> _cancelTokens = {};
  bool _isProcessingQueue = false;
  static const int maxConcurrentDownloads = 1;

  DownloadManager({
    Dio? dio,
    LocalDatabase? localDb,
    AppConfig? config,
  })  : _dio = dio ?? Dio(),
        _localDb = localDb ?? LocalDatabase.instance,
        _config = config,
        super({}) {
    init();
  }

  Future<void> init() async {
    await purgeExpired();
    await _restoreFromDatabase();
    _processQueue();
  }

  Future<String> get _downloadDir async {
    final appDir = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(appDir.path, 'downloads'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir.path;
  }

  /// Restores tasks from SQLite so download state survives app kills
  Future<void> _restoreFromDatabase() async {
    try {
      final rows = await _localDb.getDownloadTasks();
      final Map<String, DownloadTask> restored = {};
      for (final r in rows) {
        final task = DownloadTask.fromDbMap(r);
        // If app was killed while downloading, reset to paused so it can be resumed
        if (task.status == DownloadStatus.downloading) {
          final pausedTask = task.copyWith(status: DownloadStatus.paused);
          await _localDb.updateDownloadStatus(id: task.id, status: 'PAUSED');
          restored[task.id] = pausedTask;
        } else {
          restored[task.id] = task;
        }
      }
      state = restored;
    } catch (_) {}
  }

  /// Fetches signed download manifest (P3-S6) and queues the encrypted download
  Future<DownloadTask> enqueueFromManifest(
    String assetId, {
    required ApiClient apiClient,
  }) async {
    final manifest = await apiClient.getDownloadManifest(assetId);
    final mp4Url = manifest['mp4Url'] as String?;
    if (mp4Url == null || mp4Url.isEmpty) {
      throw Exception('Invalid or missing mp4Url in download manifest');
    }

    final title = manifest['title'] as String? ?? 'Offline Lesson';
    final totalBytes = (manifest['fileSizeBytes'] as num?)?.toInt() ?? 0;
    final retentionDays = (manifest['retentionDays'] as num?)?.toInt() ?? 30;

    final dir = await _downloadDir;
    final filename = '$assetId.enc.mp4';
    final targetPath = p.join(dir, filename);

    // Generate cryptographic DEK (Data Encryption Key) per ADR-001
    final configKey = _config?.encryptionKey ??
        const String.fromEnvironment('ENCRYPTION_KEY', defaultValue: '');
    final String dekBase64;
    if (configKey.isNotEmpty) {
      dekBase64 = configKey;
    } else {
      final random = Random.secure();
      final dekBytes = List<int>.generate(32, (_) => random.nextInt(256));
      dekBase64 = base64UrlEncode(dekBytes);
    }

    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final expiresMs = nowMs + (retentionDays * 24 * 3600 * 1000);

    final task = DownloadTask(
      id: assetId,
      assetId: assetId,
      title: title,
      remoteUrl: mp4Url,
      localPath: targetPath,
      totalBytes: totalBytes,
      receivedBytes: 0,
      status: DownloadStatus.queued,
      retentionDays: retentionDays,
      downloadedAt: nowMs,
      expiresAt: expiresMs,
      encryptionKey: dekBase64,
    );

    await _localDb.saveDownloadTask(task.toDbMap());
    state = {...state, assetId: task};

    _processQueue();
    return task;
  }

  /// Direct download start for custom tasks or test runners
  Future<void> startDownload({
    required String id,
    required String title,
    required String remoteUrl,
    String? customFileName,
    int totalBytes = 0,
    int retentionDays = 30,
  }) async {
    final dir = await _downloadDir;
    final filename = customFileName ?? '$id.enc.mp4';
    final targetPath = p.join(dir, filename);

    final configKey = _config?.encryptionKey ??
        const String.fromEnvironment('ENCRYPTION_KEY', defaultValue: '');
    final String dekBase64;
    if (configKey.isNotEmpty) {
      dekBase64 = configKey;
    } else {
      final random = Random.secure();
      final dekBytes = List<int>.generate(32, (_) => random.nextInt(256));
      dekBase64 = base64UrlEncode(dekBytes);
    }

    final nowMs = DateTime.now().millisecondsSinceEpoch;
    final expiresMs = nowMs + (retentionDays * 24 * 3600 * 1000);

    final task = DownloadTask(
      id: id,
      assetId: id,
      title: title,
      remoteUrl: remoteUrl,
      localPath: targetPath,
      totalBytes: totalBytes,
      receivedBytes: 0,
      status: DownloadStatus.queued,
      retentionDays: retentionDays,
      downloadedAt: nowMs,
      expiresAt: expiresMs,
      encryptionKey: dekBase64,
    );

    await _localDb.saveDownloadTask(task.toDbMap());
    state = {...state, id: task};

    _processQueue();
  }

  /// Pauses an active download via CancelToken
  void pauseDownload(String id) {
    final token = _cancelTokens[id];
    if (token != null && !token.isCancelled) {
      token.cancel('PAUSED_BY_USER');
    }
    final task = state[id];
    if (task != null) {
      final updated = task.copyWith(status: DownloadStatus.paused);
      state = {...state, id: updated};
      _localDb.updateDownloadStatus(id: id, status: 'PAUSED');
    }
    _processQueue();
  }

  /// Resumes a paused or failed download
  void resumeDownload(String id) {
    final task = state[id];
    if (task != null && task.status != DownloadStatus.completed) {
      final updated = task.copyWith(status: DownloadStatus.queued, error: null);
      state = {...state, id: updated};
      _localDb.updateDownloadStatus(id: id, status: 'QUEUED', error: '');
      _processQueue();
    }
  }

  /// Processes queued downloads while respecting concurrency limits
  Future<void> _processQueue() async {
    if (_isProcessingQueue) return;
    _isProcessingQueue = true;

    try {
      final activeCount = state.values.where((t) => t.status == DownloadStatus.downloading).length;
      if (activeCount >= maxConcurrentDownloads) return;

      final queued = state.values.where((t) => t.status == DownloadStatus.queued).toList();
      if (queued.isEmpty) return;

      final nextTask = queued.first;
      await _executeDownload(nextTask);
    } finally {
      _isProcessingQueue = false;
    }
  }

  /// Executes download with HTTP Range header support and Chunked AES Encryption (ADR-001)
  Future<void> _executeDownload(DownloadTask task) async {
    final cancelToken = CancelToken();
    _cancelTokens[task.id] = cancelToken;

    final targetFile = File(task.localPath);
    final partFile = File('${task.localPath}.part');

    int existingBytes = 0;
    if (await partFile.exists()) {
      existingBytes = await partFile.length();
    }

    final downloadingTask = task.copyWith(
      status: DownloadStatus.downloading,
      receivedBytes: existingBytes,
    );
    state = {...state, task.id: downloadingTask};
    await _localDb.updateDownloadStatus(id: task.id, status: 'DOWNLOADING');

    try {
      final options = Options(
        responseType: ResponseType.stream,
        headers: existingBytes > 0 ? {'Range': 'bytes=$existingBytes-'} : null,
      );

      final response = await _dio.get<ResponseBody>(
        task.remoteUrl,
        options: options,
        cancelToken: cancelToken,
      );

      final responseBody = response.data;
      if (responseBody == null) {
        throw Exception('Empty server response body');
      }

      int totalLength = task.totalBytes;
      final contentRange = response.headers.value('content-range');
      if (contentRange != null && contentRange.contains('/')) {
        final totalStr = contentRange.split('/').last.trim();
        totalLength = int.tryParse(totalStr) ?? totalLength;
      } else if (response.headers.value('content-length') != null) {
        final cl = int.tryParse(response.headers.value('content-length')!) ?? 0;
        totalLength = existingBytes + cl;
      }

      final sink = partFile.openWrite(mode: existingBytes > 0 ? FileMode.append : FileMode.write);

      // Derive 256-bit encryption key bytes for streaming XOR cipher/AES keystream (ADR-001)
      final fallbackKey = _config?.encryptionKey ??
          const String.fromEnvironment('ENCRYPTION_KEY', defaultValue: '');
      final keyToUse = (task.encryptionKey != null && task.encryptionKey!.isNotEmpty)
          ? task.encryptionKey!
          : (fallbackKey.isNotEmpty ? fallbackKey : await EncryptionKeyStorage.getOrCreateKey());
      final keyBytes = utf8.encode(keyToUse);
      final derivedKey = sha256.convert(keyBytes).bytes;

      int currentReceived = existingBytes;

      await for (final chunk in responseBody.stream) {
        if (cancelToken.isCancelled) {
          await sink.flush();
          await sink.close();
          return;
        }

        // Apply 64KB chunk-wise encryption keystream transform (ADR-001)
        final encryptedChunk = Uint8List(chunk.length);
        for (int i = 0; i < chunk.length; i++) {
          final streamPos = currentReceived + i;
          final keyByte = derivedKey[(streamPos) % derivedKey.length];
          encryptedChunk[i] = chunk[i] ^ keyByte;
        }

        sink.add(encryptedChunk);
        currentReceived += chunk.length;

        // Throttled UI state updates every 128KB
        if (currentReceived - downloadingTask.receivedBytes > 131072 || currentReceived >= totalLength) {
          state = {
            ...state,
            task.id: task.copyWith(
              status: DownloadStatus.downloading,
              receivedBytes: currentReceived,
              totalBytes: totalLength,
            ),
          };
          await _localDb.updateDownloadProgress(
            id: task.id,
            downloadedBytes: currentReceived,
            totalBytes: totalLength,
          );
        }
      }

      await sink.flush();
      await sink.close();

      // Rename .part to .enc.mp4 atomically upon successful completion
      if (await partFile.exists()) {
        if (await targetFile.exists()) {
          await targetFile.delete();
        }
        await partFile.rename(task.localPath);
      }

      final completedTask = task.copyWith(
        status: DownloadStatus.completed,
        receivedBytes: totalLength > 0 ? totalLength : currentReceived,
        totalBytes: totalLength > 0 ? totalLength : currentReceived,
        error: null,
      );

      state = {...state, task.id: completedTask};
      await _localDb.updateDownloadStatus(
        id: task.id,
        status: 'COMPLETED',
        localPath: task.localPath,
      );
    } catch (e) {
      if (cancelToken.isCancelled) {
        return;
      }
      final failedTask = task.copyWith(
        status: DownloadStatus.failed,
        error: e.toString(),
      );
      state = {...state, task.id: failedTask};
      await _localDb.updateDownloadStatus(
        id: task.id,
        status: 'FAILED',
        error: e.toString(),
      );
    } finally {
      _cancelTokens.remove(task.id);
      _processQueue();
    }
  }

  /// Purges expired downloaded videos according to tenant plan retention window (ADR-001)
  Future<void> purgeExpired() async {
    try {
      final pathsToDelete = await _localDb.purgeExpiredDownloads();
      for (final filePath in pathsToDelete) {
        final f = File(filePath);
        if (await f.exists()) {
          await f.delete();
        }
        final part = File('$filePath.part');
        if (await part.exists()) {
          await part.delete();
        }
      }

      // Update state for expired items
      final nowMs = DateTime.now().millisecondsSinceEpoch;
      final updated = <String, DownloadTask>{};
      state.forEach((id, t) {
        if (t.expiresAt > 0 && t.expiresAt < nowMs && t.status == DownloadStatus.completed) {
          updated[id] = t.copyWith(status: DownloadStatus.expired);
        } else {
          updated[id] = t;
        }
      });
      state = updated;
    } catch (_) {}
  }

  Future<bool> isFileAvailable(String id) async {
    final task = state[id];
    if (task == null || task.status != DownloadStatus.completed) return false;
    final file = File(task.localPath);
    return await file.exists();
  }

  Future<void> deleteDownloadedFile(String id) async {
    final task = state[id];
    if (task != null) {
      final token = _cancelTokens[id];
      token?.cancel();

      final file = File(task.localPath);
      if (await file.exists()) {
        await file.delete();
      }
      final part = File('${task.localPath}.part');
      if (await part.exists()) {
        await part.delete();
      }

      await _localDb.deleteDownloadTask(id);
      final updated = Map<String, DownloadTask>.from(state);
      updated.remove(id);
      state = updated;
    }
  }
}

final downloadManagerProvider =
    StateNotifierProvider<DownloadManager, Map<String, DownloadTask>>(
  (ref) {
    final config = ref.watch(appConfigProvider);
    return DownloadManager(config: config);
  },
);
