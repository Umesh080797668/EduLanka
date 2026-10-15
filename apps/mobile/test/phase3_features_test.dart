import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:edulanka_mobile/core/database/encryption_key_storage.dart';
import 'package:edulanka_mobile/core/download/aes_ctr_cipher.dart';
import 'package:edulanka_mobile/core/download/decrypted_video_server.dart';
import 'package:edulanka_mobile/core/download/download_manager.dart';
import 'package:edulanka_mobile/features/tutorial/tutorial_engine.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 3 Mobile Infrastructure Tests', () {
    test(
      'DownloadTask tracks progress calculation and completion correctly',
      () {
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
      },
    );

    test('DownloadTask maps to and from SQLite database representation', () {
      final task = DownloadTask(
        id: 'task-uuid-1',
        assetId: 'asset-42',
        title: 'Grade 10 Mathematics',
        remoteUrl: 'https://cdn.edulanka.lk/lessons/m1.mp4',
        localPath:
            '/data/user/0/com.edulanka/app_flutter/downloads/task-uuid-1.enc.mp4',
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
      'AesCtrCipher performs streaming encryption and offset seeking without key leakage',
      () {
        final key = Uint8List.fromList(List.generate(32, (i) => i * 3 + 1));
        final iv = Uint8List.fromList(List.generate(16, (i) => i * 7 + 2));

        final cipher = AesCtrCipher(key, iv);

        // Simulated MP4 header bytes (ftyp box)
        final original = Uint8List.fromList([
          0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, // ftyp
          0x6d, 0x70, 0x34, 0x32, 0x00, 0x00, 0x00, 0x00,
          ...List.generate(100, (i) => (i * 11) % 256),
        ]);

        // Encrypt
        final encrypted = cipher.processBytes(original, 0);
        expect(encrypted, isNot(equals(original)));

        // Decrypt full
        final decrypted = cipher.processBytes(encrypted, 0);
        expect(decrypted, equals(original));

        // Decrypt byte slice with offset seeking (e.g. Range: bytes=32-64)
        final sliceEncrypted = encrypted.sublist(32, 65);
        final sliceDecrypted = cipher.processBytes(sliceEncrypted, 32);
        expect(sliceDecrypted, equals(original.sublist(32, 65)));
      },
    );

    test(
      'KeyEncapsulation wraps and unwraps per-file DEKs using Master KEK',
      () async {
        final masterKey = await EncryptionKeyStorage.getOrCreateKey();
        final freshKeys = KeyEncapsulation.generateFreshKeys();

        final wrappedKey = KeyEncapsulation.wrapDek(
          dekBytes: freshKeys.dek,
          ivBytes: freshKeys.iv,
          masterKeyBase64: masterKey,
        );

        expect(wrappedKey, isNot(equals(base64UrlEncode(freshKeys.dek))));

        final restored = KeyEncapsulation.unwrapDek(
          wrappedDekBase64: wrappedKey,
          masterKeyBase64: masterKey,
        );

        expect(restored.dek, equals(freshKeys.dek));
        expect(restored.iv, equals(freshKeys.iv));
      },
    );

    test(
      'LocalDecryptedVideoServer streams decrypted video with HTTP Range support (P3-S6)',
      () async {
        final prevOverrides = HttpOverrides.current;
        HttpOverrides.global = null;

        final key = Uint8List.fromList(List.generate(32, (i) => i + 10));
        final iv = Uint8List.fromList(List.generate(16, (i) => i + 20));

        final tempDir = Directory.systemTemp.createTempSync(
          'edulanka_test_video_',
        );
        final tempFile = File('${tempDir.path}/test.enc.mp4');

        final plaintext = Uint8List.fromList(
          List.generate(1024, (i) => i % 256),
        );
        final cipher = AesCtrCipher(key, iv);
        final ciphertext = cipher.processBytes(plaintext, 0);
        await tempFile.writeAsBytes(ciphertext);

        final server = await LocalDecryptedVideoServer.start(
          file: tempFile,
          dek: key,
          iv: iv,
        );

        final client = HttpClient();

        // Test 1: Full content request
        final req1 = await client.getUrl(Uri.parse(server.url));
        final res1 = await req1.close();
        expect(res1.statusCode, HttpStatus.ok);
        final bytes1 = await res1.fold<List<int>>([], (p, e) => p..addAll(e));
        expect(bytes1, equals(plaintext));

        // Test 2: HTTP Range partial content request (bytes 100-199)
        final req2 = await client.getUrl(Uri.parse(server.url));
        req2.headers.set(HttpHeaders.rangeHeader, 'bytes=100-199');
        final res2 = await req2.close();
        expect(res2.statusCode, HttpStatus.partialContent);
        expect(
          res2.headers.value(HttpHeaders.contentRangeHeader),
          'bytes 100-199/1024',
        );
        final bytes2 = await res2.fold<List<int>>([], (p, e) => p..addAll(e));
        expect(bytes2, equals(plaintext.sublist(100, 200)));

        // Test 3: Unauthorized request without session token is strictly rejected (HTTP 403 Forbidden)
        final unauthReq = await client.getUrl(
          Uri.parse('http://127.0.0.1:${server.port}/video.mp4'),
        );
        final unauthRes = await unauthReq.close();
        expect(unauthRes.statusCode, HttpStatus.forbidden);

        client.close();
        await server.stop();
        await tempFile.delete();
        await tempDir.delete();
        HttpOverrides.global = prevOverrides;
      },
    );

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
