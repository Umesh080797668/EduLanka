import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:edulanka_mobile/core/database/encryption_key_storage.dart';
import 'package:edulanka_mobile/core/download/download_manager.dart';
import 'package:edulanka_mobile/features/tutorial/tutorial_engine.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 3 Mobile Infrastructure Tests', () {
    test('DownloadTask tracks progress calculation and completion correctly', () {
      final task = DownloadTask(
        id: 'task-1',
        title: 'Science Lesson 1',
        remoteUrl: 'https://cdn.edulanka.lk/video.mp4',
        localPath: '/storage/video.enc.mp4',
        receivedBytes: 5000,
        totalBytes: 10000,
        status: DownloadStatus.downloading,
      );

      expect(task.progress, 0.5);
      expect(task.isCompleted, false);

      final completedTask = DownloadTask(
        id: 'task-1',
        title: 'Science Lesson 1',
        remoteUrl: 'https://cdn.edulanka.lk/video.mp4',
        localPath: '/storage/video.enc.mp4',
        receivedBytes: 10000,
        totalBytes: 10000,
        status: DownloadStatus.completed,
      );
      expect(completedTask.progress, 1.0);
      expect(completedTask.isCompleted, true);
    });

    test('DownloadTask maps to and from SQLite database representation', () {
      final task = DownloadTask(
        id: 'task-uuid-1',
        assetId: 'asset-42',
        title: 'Grade 10 Mathematics',
        remoteUrl: 'https://cdn.edulanka.lk/lessons/m1.mp4',
        localPath: '/data/user/0/com.edulanka/app_flutter/downloads/task-uuid-1.enc.mp4',
        totalBytes: 1048576,
        receivedBytes: 524288,
        status: DownloadStatus.paused,
        retentionDays: 14,
        downloadedAt: 1700000000000,
        expiresAt: 1701209600000,
        encryptionKey: '0123456789abcdef0123456789abcdef',
      );

      final dbMap = task.toDbMap();
      expect(dbMap['id'], 'task-uuid-1');
      expect(dbMap['asset_id'], 'asset-42');
      expect(dbMap['status'], 'PAUSED');
      expect(dbMap['downloaded_bytes'], 524288);
      expect(dbMap['encryption_key'], '0123456789abcdef0123456789abcdef');

      final reconstructed = DownloadTask.fromDbMap(dbMap);
      expect(reconstructed.id, task.id);
      expect(reconstructed.assetId, task.assetId);
      expect(reconstructed.status, DownloadStatus.paused);
      expect(reconstructed.receivedBytes, 524288);
      expect(reconstructed.totalBytes, 1048576);
      expect(reconstructed.encryptionKey, task.encryptionKey);
    });

    test('EncryptionKeyStorage generates 256-bit AES key (ADR-005)', () async {
      await EncryptionKeyStorage.clearKey();
      final key = await EncryptionKeyStorage.getOrCreateKey();
      expect(key.isNotEmpty, true);

      final decodedBytes = base64Url.decode(base64Url.normalize(key));
      expect(decodedBytes.length, 32); // 32 bytes = 256 bits

      // Subsequent call returns cached key
      final key2 = await EncryptionKeyStorage.getOrCreateKey();
      expect(key2, key);

      // Explicit configuredKey overrides when cleared
      await EncryptionKeyStorage.clearKey();
      final configuredKey = await EncryptionKeyStorage.getOrCreateKey(
        configuredKey: 'custom-config-encryption-key-256bit',
      );
      expect(configuredKey, 'custom-config-encryption-key-256bit');
    });

    test(
      'TutorialEngine loads and records tour completion in SharedPreferences',
      () async {
        SharedPreferences.setMockInitialValues({});

        expect(await TutorialEngine.hasSeenTour('onboarding_tour'), false);
        await TutorialEngine.markTourSeen('onboarding_tour');
        expect(await TutorialEngine.hasSeenTour('onboarding_tour'), true);
      },
    );
  });
}
