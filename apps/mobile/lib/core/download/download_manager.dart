import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

class DownloadTask {
  final String id;
  final String title;
  final String remoteUrl;
  final String localPath;
  final int totalBytes;
  final int receivedBytes;
  final bool isCompleted;
  final String? error;

  DownloadTask({
    required this.id,
    required this.title,
    required this.remoteUrl,
    required this.localPath,
    this.totalBytes = 0,
    this.receivedBytes = 0,
    this.isCompleted = false,
    this.error,
  });

  double get progress => totalBytes > 0 ? (receivedBytes / totalBytes) : 0.0;
}

class DownloadManager extends StateNotifier<Map<String, DownloadTask>> {
  final Dio _dio = Dio();

  DownloadManager() : super({});

  Future<String> get _downloadDir async {
    final appDir = await getApplicationDocumentsDirectory();
    final dir = Directory(p.join(appDir.path, 'downloads'));
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir.path;
  }

  Future<void> startDownload({
    required String id,
    required String title,
    required String remoteUrl,
    String? customFileName,
  }) async {
    final dir = await _downloadDir;
    final filename = customFileName ?? '$id.bin';
    final targetPath = p.join(dir, filename);

    state = {
      ...state,
      id: DownloadTask(
        id: id,
        title: title,
        remoteUrl: remoteUrl,
        localPath: targetPath,
      ),
    };

    try {
      await _dio.download(
        remoteUrl,
        targetPath,
        onReceiveProgress: (received, total) {
          final current = state[id];
          if (current != null) {
            state = {
              ...state,
              id: DownloadTask(
                id: id,
                title: title,
                remoteUrl: remoteUrl,
                localPath: targetPath,
                receivedBytes: received,
                totalBytes: total,
              ),
            };
          }
        },
      );

      final current = state[id];
      if (current != null) {
        state = {
          ...state,
          id: DownloadTask(
            id: id,
            title: title,
            remoteUrl: remoteUrl,
            localPath: targetPath,
            receivedBytes: current.totalBytes,
            totalBytes: current.totalBytes,
            isCompleted: true,
          ),
        };
      }
    } catch (e) {
      final current = state[id];
      if (current != null) {
        state = {
          ...state,
          id: DownloadTask(
            id: id,
            title: title,
            remoteUrl: remoteUrl,
            localPath: targetPath,
            error: e.toString(),
          ),
        };
      }
    }
  }

  Future<bool> isFileAvailable(String id) async {
    final task = state[id];
    if (task == null) return false;
    final file = File(task.localPath);
    return await file.exists();
  }

  Future<void> deleteDownloadedFile(String id) async {
    final task = state[id];
    if (task != null) {
      final file = File(task.localPath);
      if (await file.exists()) {
        await file.delete();
      }
      final updated = Map<String, DownloadTask>.from(state);
      updated.remove(id);
      state = updated;
    }
  }
}

final downloadManagerProvider =
    StateNotifierProvider<DownloadManager, Map<String, DownloadTask>>(
  (ref) => DownloadManager(),
);
