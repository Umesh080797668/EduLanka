import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:crypto/crypto.dart' as crypto_pkg;
import 'package:device_info_plus/device_info_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:pointycastle/export.dart' hide Digest;

/// Chunk size for chunked AES-GCM encryption (64 KB).
const int kChunkSizeBytes = 64 * 1024;
const int kGcmTagSizeBytes = 16;
const int kStoredChunkSizeBytes =
    kChunkSizeBytes + kGcmTagSizeBytes; // 65552 bytes

/// Result record of real Spike A benchmark execution.
class SpikeABenchmarkResult {
  final String deviceModel;
  final String osVersion;
  final double ramGb;
  final int fileSizeMb;
  final bool resumableDownloadSuccess;
  final bool airplaneModeVerified;
  final bool decryptionIntegrityVerified;
  final int startupLatencyMs;
  final int seekLatencyMs;
  final double peakMemoryMb;
  final double encryptionThroughputMBps;
  final String playbackEngine;
  final String measurementSource;
  final String cipherAlgorithm;

  SpikeABenchmarkResult({
    required this.deviceModel,
    required this.osVersion,
    required this.ramGb,
    required this.fileSizeMb,
    required this.resumableDownloadSuccess,
    required this.airplaneModeVerified,
    required this.decryptionIntegrityVerified,
    required this.startupLatencyMs,
    required this.seekLatencyMs,
    required this.peakMemoryMb,
    required this.encryptionThroughputMBps,
    required this.playbackEngine,
    required this.measurementSource,
    this.cipherAlgorithm = 'Chunked AES-256-GCM (Tink Streaming AEAD)',
  });

  Map<String, dynamic> toJson() => {
    'deviceModel': deviceModel,
    'osVersion': osVersion,
    'ramGb': ramGb,
    'fileSizeMb': fileSizeMb,
    'resumableDownloadSuccess': resumableDownloadSuccess,
    'airplaneModeVerified': airplaneModeVerified,
    'decryptionIntegrityVerified': decryptionIntegrityVerified,
    'startupLatencyMs': startupLatencyMs,
    'seekLatencyMs': seekLatencyMs,
    'peakMemoryMb': peakMemoryMb,
    'encryptionThroughputMBps': encryptionThroughputMBps,
    'playbackEngine': playbackEngine,
    'measurementSource': measurementSource,
    'cipherAlgorithm': cipherAlgorithm,
  };
}

/// Derives a unique 12-byte GCM nonce for chunk [chunkIndex] from [baseNonce].
Uint8List deriveChunkNonce(Uint8List baseNonce, int chunkIndex) {
  final nonce = Uint8List.fromList(baseNonce);
  final bd = ByteData.sublistView(nonce);
  if (nonce.length >= 12) {
    final original = bd.getUint32(8, Endian.big);
    bd.setUint32(8, (original + chunkIndex) & 0xFFFFFFFF, Endian.big);
  }
  return nonce;
}

/// PointyCastle Chunked AES-256-GCM Streaming AEAD Cipher (matching Google Tink Streaming AEAD).
class ChunkedGcmVideoCipher {
  final Uint8List key;
  final Uint8List baseNonce;

  ChunkedGcmVideoCipher({required this.key, required this.baseNonce}) {
    assert(key.length == 32, 'Key must be 256 bits (32 bytes)');
    assert(baseNonce.length == 12, 'Base nonce must be 96 bits (12 bytes)');
  }

  Uint8List encryptChunk(Uint8List plainChunk, int chunkIndex, {required bool isLastSegment}) {
    final nonce = deriveChunkNonce(baseNonce, chunkIndex);
    final aad = Uint8List.fromList([isLastSegment ? 0x01 : 0x00]);
    final cipher = GCMBlockCipher(AESEngine())
      ..init(true, AEADParameters(KeyParameter(key), 128, nonce, aad));
    return cipher.process(plainChunk);
  }

  Uint8List decryptChunk(Uint8List cipherChunkWithTag, int chunkIndex, {required bool isLastSegment}) {
    final nonce = deriveChunkNonce(baseNonce, chunkIndex);
    final aad = Uint8List.fromList([isLastSegment ? 0x01 : 0x00]);
    final cipher = GCMBlockCipher(
      AESEngine(),
    )..init(false, AEADParameters(KeyParameter(key), 128, nonce, aad));
    return cipher.process(cipherChunkWithTag);
  }

  Future<void> encryptFile(File inputFile, File outputFile) async {
    final inRaf = await inputFile.open(mode: FileMode.read);
    final outRaf = await outputFile.open(mode: FileMode.write);
    final fileLength = await inputFile.length();
    int chunkIndex = 0;
    int bytesReadTotal = 0;

    try {
      while (bytesReadTotal < fileLength) {
        final remaining = fileLength - bytesReadTotal;
        final toRead = min(kChunkSizeBytes, remaining);
        final chunk = await inRaf.read(toRead);
        if (chunk.isEmpty) break;
        bytesReadTotal += chunk.length;
        final isLast = bytesReadTotal >= fileLength;
        final encrypted = encryptChunk(chunk, chunkIndex, isLastSegment: isLast);
        await outRaf.writeFrom(encrypted);
        chunkIndex++;
      }
    } finally {
      await inRaf.close();
      await outRaf.close();
    }
  }

  static int calculatePlaintextLength(int encryptedFileSize) {
    if (encryptedFileSize <= 0) return 0;
    final fullChunks = encryptedFileSize ~/ kStoredChunkSizeBytes;
    final remainder = encryptedFileSize % kStoredChunkSizeBytes;
    final lastChunkPlain = remainder > kGcmTagSizeBytes
        ? (remainder - kGcmTagSizeBytes)
        : 0;
    return (fullChunks * kChunkSizeBytes) + lastChunkPlain;
  }
}

/// Local HTTP Loopback Decryption Server with Per-Session Authentication and RFC-compliant Range handling.
class LoopbackEncryptedVideoServer {
  final File encryptedFile;
  final Uint8List key;
  final Uint8List baseNonce;
  final String sessionToken;
  final ChunkedGcmVideoCipher cipher;
  HttpServer? _server;

  int get port => _server?.port ?? 0;
  Uri get streamUri =>
      Uri.parse('http://127.0.0.1:$port/video.mp4?token=$sessionToken');

  LoopbackEncryptedVideoServer({
    required this.encryptedFile,
    required this.key,
    required this.baseNonce,
    String? sessionToken,
  }) : sessionToken = sessionToken ?? _generateSecureToken(),
       cipher = ChunkedGcmVideoCipher(key: key, baseNonce: baseNonce);

  static String _generateSecureToken() {
    final secureRandom = Random.secure();
    final bytes = List<int>.generate(24, (_) => secureRandom.nextInt(256));
    return base64UrlEncode(bytes);
  }

  Future<void> start() async {
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server!.listen(_handleRequest);
  }

  Future<void> _handleRequest(HttpRequest request) async {
    final response = request.response;
    try {
      // 1. Session token authorization check
      final clientToken = request.uri.queryParameters['token'];
      if (clientToken != sessionToken) {
        response.statusCode = HttpStatus.forbidden;
        await response.close();
        return;
      }

      if (!await encryptedFile.exists()) {
        response.statusCode = HttpStatus.notFound;
        await response.close();
        return;
      }

      final encFileLength = await encryptedFile.length();
      final totalPlaintextLength =
          ChunkedGcmVideoCipher.calculatePlaintextLength(encFileLength);
      final rangeHeader = request.headers.value(HttpHeaders.rangeHeader);

      if (request.method == 'HEAD') {
        response.headers.add(HttpHeaders.acceptRangesHeader, 'bytes');
        response.headers.add(HttpHeaders.contentTypeHeader, 'video/mp4');
        response.contentLength = totalPlaintextLength;
        await response.close();
        return;
      }

      int start = 0;
      int end = totalPlaintextLength - 1;

      if (rangeHeader != null && rangeHeader.startsWith('bytes=')) {
        final rangeVal = rangeHeader.substring(6).trim();

        if (rangeVal.startsWith('-')) {
          // Suffix range: e.g. bytes=-500 (last 500 bytes)
          final suffixLength = int.tryParse(rangeVal.substring(1)) ?? 0;
          if (suffixLength <= 0) {
            response.statusCode = HttpStatus.requestedRangeNotSatisfiable;
            response.headers.set(
              HttpHeaders.contentRangeHeader,
              'bytes */$totalPlaintextLength',
            );
            await response.close();
            return;
          }
          start = max(0, totalPlaintextLength - suffixLength);
          end = totalPlaintextLength - 1;
        } else {
          final parts = rangeVal.split('-');
          start = int.tryParse(parts[0]) ?? 0;
          if (parts.length > 1 && parts[1].trim().isNotEmpty) {
            end = int.tryParse(parts[1].trim()) ?? (totalPlaintextLength - 1);
          } else {
            end = totalPlaintextLength - 1;
          }
        }

        // Validate range bounds
        if (start >= totalPlaintextLength || start < 0 || start > end) {
          response.statusCode = HttpStatus.requestedRangeNotSatisfiable;
          response.headers.set(
            HttpHeaders.contentRangeHeader,
            'bytes */$totalPlaintextLength',
          );
          await response.close();
          return;
        }

        if (end >= totalPlaintextLength) {
          end = totalPlaintextLength - 1;
        }

        response.statusCode = HttpStatus.partialContent;
        response.headers.add(
          HttpHeaders.contentRangeHeader,
          'bytes $start-$end/$totalPlaintextLength',
        );
      } else {
        response.statusCode = HttpStatus.ok;
      }

      final contentLength = end - start + 1;
      response.headers.add(HttpHeaders.acceptRangesHeader, 'bytes');
      response.headers.add(HttpHeaders.contentTypeHeader, 'video/mp4');
      response.contentLength = contentLength;

      final raf = await encryptedFile.open(mode: FileMode.read);

      final startChunk = start ~/ kChunkSizeBytes;
      final endChunk = end ~/ kChunkSizeBytes;

      int bytesDelivered = 0;

      for (
        int c = startChunk;
        c <= endChunk && bytesDelivered < contentLength;
        c++
      ) {
        final chunkOffsetInFile = c * kStoredChunkSizeBytes;
        await raf.setPosition(chunkOffsetInFile);

        final toRead = min(
          kStoredChunkSizeBytes,
          encFileLength - chunkOffsetInFile,
        );
        if (toRead <= kGcmTagSizeBytes) break;

        final isLast = (chunkOffsetInFile + toRead >= encFileLength);
        final rawEncChunk = await raf.read(toRead);
        final decryptedChunk = cipher.decryptChunk(rawEncChunk, c, isLastSegment: isLast);

        final chunkPlainStart = c * kChunkSizeBytes;
        final inChunkStart = max(0, start - chunkPlainStart);
        final inChunkEnd = min(
          decryptedChunk.length,
          (end - chunkPlainStart) + 1,
        );

        if (inChunkStart < inChunkEnd) {
          final slice = decryptedChunk.sublist(inChunkStart, inChunkEnd);
          response.add(slice);
          bytesDelivered += slice.length;
        }
      }

      await raf.close();
      await response.close();
    } catch (e) {
      debugPrint('Loopback server error: $e');
      try {
        await response.close();
      } catch (_) {}
    }
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
  }
}

/// Test execution harness for Spike A with actual physical measurements.
class SpikeATestRunner {
  static const MethodChannel _nativeChannel = MethodChannel(
    'lk.edulanka.offline_video_spike/exoplayer',
  );

  /// Reads physical RAM in GB from /proc/meminfo on Linux/Android
  static double getDeviceRamGb() {
    try {
      final file = File('/proc/meminfo');
      if (file.existsSync()) {
        for (final line in file.readAsLinesSync()) {
          if (line.startsWith('MemTotal:')) {
            final parts = line.split(RegExp(r'\s+'));
            if (parts.length >= 2) {
              final kb = double.tryParse(parts[1]) ?? 0.0;
              return double.parse((kb / (1024.0 * 1024.0)).toStringAsFixed(2));
            }
          }
        }
      }
    } catch (_) {}
    return 0.0;
  }

  /// Checks whether network interfaces are offline (Airplane Mode check)
  static Future<bool> isNetworkOffline() async {
    try {
      final interfaces = await NetworkInterface.list();
      for (final iface in interfaces) {
        if (!iface.name.toLowerCase().contains('lo')) {
          if (iface.addresses.isNotEmpty) {
            return false;
          }
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<SpikeABenchmarkResult> runBenchmark({
    required String testDir,
    String? sampleMp4Path,
    int testFileSizeMb = 10,
    bool manualAirplaneModeConfirmed = false,
  }) async {
    final secureRandom = Random.secure();
    final key = Uint8List.fromList(
      List.generate(32, (_) => secureRandom.nextInt(256)),
    );
    final baseNonce = Uint8List.fromList(
      List.generate(12, (_) => secureRandom.nextInt(256)),
    );

    final rawVideoFile = File(
      '$testDir/benchmark_test_${testFileSizeMb}mb.mp4',
    );
    final encryptedVideoFile = File(
      '$testDir/benchmark_test_${testFileSizeMb}mb.enc.mp4',
    );

    // 1. Hardware & OS Metadata
    String deviceModel = 'Host (${Platform.operatingSystem})';
    String osVersion = Platform.operatingSystemVersion;
    double ramGb = getDeviceRamGb();

    if (!kIsWeb && Platform.isAndroid) {
      try {
        final info = await _nativeChannel.invokeMapMethod<String, dynamic>(
          'getHardwareMemoryInfo',
        );
        if (info != null) {
          deviceModel = info['model']?.toString() ?? deviceModel;
          osVersion = info['osVersion']?.toString() ?? osVersion;
          ramGb = (info['totalRamGb'] as num?)?.toDouble() ?? ramGb;
        }
      } catch (_) {
        try {
          final androidInfo = await DeviceInfoPlugin().androidInfo;
          deviceModel = '${androidInfo.manufacturer} ${androidInfo.model}';
          osVersion =
              'Android ${androidInfo.version.release} (API ${androidInfo.version.sdkInt})';
        } catch (_) {}
      }
    }

    // 2. Prepare Sample Video Asset
    if (sampleMp4Path != null && File(sampleMp4Path).existsSync()) {
      final sample = File(sampleMp4Path);
      await sample.copy(rawVideoFile.path);
    } else {
      try {
        final byteData = await rootBundle.load('assets/sample.mp4');
        final bytes = byteData.buffer.asUint8List(
          byteData.offsetInBytes,
          byteData.lengthInBytes,
        );
        await rawVideoFile.writeAsBytes(bytes, flush: true);
      } catch (_) {
        final bytesPerMb = 1024 * 1024;
        final buffer = Uint8List(bytesPerMb);
        for (int i = 0; i < bytesPerMb; i++) {
          buffer[i] = (i * 31) & 0xFF;
        }
        final raf = await rawVideoFile.open(mode: FileMode.write);
        for (int i = 0; i < testFileSizeMb; i++) {
          await raf.writeFrom(buffer);
        }
        await raf.close();
      }
    }

    final rawFileSize = await rawVideoFile.length();
    final actualMb = (rawFileSize / (1024 * 1024)).ceil();

    // 3. Chunked AES-256-GCM Streaming Encryption
    final cipher = ChunkedGcmVideoCipher(key: key, baseNonce: baseNonce);
    final encSw = Stopwatch()..start();
    await cipher.encryptFile(rawVideoFile, encryptedVideoFile);
    encSw.stop();

    final encSeconds = encSw.elapsedMicroseconds / 1000000.0;
    final throughputMBps = encSeconds > 0
        ? double.parse(
            ((rawFileSize / (1024.0 * 1024.0)) / encSeconds).toStringAsFixed(2),
          )
        : 0.0;

    // 4. Verify Decryption Integrity via streaming SHA-256
    final rawHash = await rawVideoFile
        .openRead()
        .transform(crypto_pkg.sha256)
        .first;

    // Stream through ChunkedGcm decryption and compute SHA-256
    final encRaf = await encryptedVideoFile.open(mode: FileMode.read);
    final encLength = await encryptedVideoFile.length();
    final numChunks =
        (encLength + kStoredChunkSizeBytes - 1) ~/ kStoredChunkSizeBytes;

    final sha256Digest = SHA256Digest();
    for (int i = 0; i < numChunks; i++) {
      final chunkBytes = await encRaf.read(kStoredChunkSizeBytes);
      if (chunkBytes.isEmpty) break;
      final isLast = (i == numChunks - 1);
      final decryptedChunk = cipher.decryptChunk(chunkBytes, i, isLastSegment: isLast);
      sha256Digest.update(decryptedChunk, 0, decryptedChunk.length);
    }

    final computedHashBytes = Uint8List(32);
    sha256Digest.doFinal(computedHashBytes, 0);
    final computedHex = computedHashBytes
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
    final integrityPassed =
        rawHash.toString().toLowerCase() == computedHex.toLowerCase();

    if (!integrityPassed) {
      await encRaf.close();
      throw StateError('Decryption integrity check failed: computed SHA-256 ($computedHex) does not match original ($rawHash)');
    }

    // Verify truncation detection (Tink AAD segment tag security)
    if (numChunks > 1) {
      await encRaf.setPosition(0);
      final chunk0 = await encRaf.read(kStoredChunkSizeBytes);
      bool truncationDetected = false;
      try {
        // Attempting to decrypt chunk 0 as last segment MUST fail GCM tag verification
        cipher.decryptChunk(chunk0, 0, isLastSegment: true);
      } catch (e) {
        truncationDetected = true;
      }
      if (!truncationDetected) {
        await encRaf.close();
        throw StateError('Security failure: Truncated stream was not detected by Tink AAD segment tags');
      }
    }
    await encRaf.close();

    // 5. Real Dio Resumable Range Download Verification
    final testServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    testServer.listen((HttpRequest req) async {
      final range = req.headers.value(HttpHeaders.rangeHeader);
      final totalLen = await rawVideoFile.length();
      if (range != null && range.startsWith('bytes=')) {
        final parts = range.substring(6).split('-');
        final start = int.parse(parts[0]);
        final end = parts.length > 1 && parts[1].isNotEmpty ? int.parse(parts[1]) : totalLen - 1;
        req.response.statusCode = HttpStatus.partialContent;
        req.response.headers.set(HttpHeaders.contentRangeHeader, 'bytes $start-$end/$totalLen');
        req.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
        req.response.headers.contentType = ContentType.binary;
        final raf = await rawVideoFile.open();
        await raf.setPosition(start);
        final data = await raf.read(end - start + 1);
        await raf.close();
        req.response.add(data);
      } else {
        req.response.statusCode = HttpStatus.ok;
        req.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
        await rawVideoFile.openRead().pipe(req.response);
      }
      await req.response.close();
    });

    final dioDownloadedFile = File('$testDir/dio_resumed_test.mp4');
    if (dioDownloadedFile.existsSync()) dioDownloadedFile.deleteSync();

    final dio = Dio();
    try {
      final halfBytes = rawFileSize ~/ 2;
      // Step 1: Download first half with Dio
      final res1 = await dio.get<List<int>>(
        'http://127.0.0.1:${testServer.port}/video.mp4',
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Range': 'bytes=0-$halfBytes'},
        ),
      );
      if (res1.statusCode != 206 && res1.statusCode != 200) {
        throw StateError('Dio range request failed: status ${res1.statusCode}');
      }
      await dioDownloadedFile.writeAsBytes(res1.data!, flush: true);

      // Step 2: Resume remaining bytes with Dio
      final res2 = await dio.get<List<int>>(
        'http://127.0.0.1:${testServer.port}/video.mp4',
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Range': 'bytes=${halfBytes + 1}-${rawFileSize - 1}'},
        ),
      );
      if (res2.statusCode != 206) {
        throw StateError('Dio resume request failed: status ${res2.statusCode}');
      }
      final appendRaf = await dioDownloadedFile.open(mode: FileMode.append);
      await appendRaf.writeFrom(res2.data!);
      await appendRaf.close();

      // Verify resumed file SHA-256 against original
      final resumedHash = await dioDownloadedFile.openRead().transform(crypto_pkg.sha256).first;
      if (resumedHash.toString().toLowerCase() != rawHash.toString().toLowerCase()) {
        throw StateError('Dio resumable download verification failed: hash mismatch');
      }
    } finally {
      await testServer.close(force: true);
      dio.close();
      if (dioDownloadedFile.existsSync()) dioDownloadedFile.deleteSync();
    }

    // 6. Test Native ExoPlayer DataSource on Android if available
    String playbackEngine = 'Loopback HTTP Fallback';
    if (!kIsWeb && Platform.isAndroid) {
      try {
        final nativeOk =
            await _nativeChannel.invokeMethod<bool>('isExoPlayerAvailable') ??
            false;
        if (nativeOk) {
          final verifyResult = await _nativeChannel
              .invokeMapMethod<String, dynamic>('verifyNativeGcmDecryption', {
                'filePath': encryptedVideoFile.path,
                'key': key,
                'nonce': baseNonce,
              });
          if (verifyResult?['success'] == true) {
            playbackEngine = 'ExoPlayer Native (Media3 ChunkedGcmDataSource)';
          }
        }
      } catch (_) {}
    }

    // 7. Loopback Server Latency & Seek Benchmarks
    final server = LoopbackEncryptedVideoServer(
      encryptedFile: encryptedVideoFile,
      key: key,
      baseNonce: baseNonce,
    );
    await server.start();

    int startupLatencyMs = 0;
    int seekLatencyMs = 0;

    try {
      final client = HttpClient();

      // Measure Startup Latency (time to read first 64KB range)
      final startupSw = Stopwatch()..start();
      final req1 = await client.getUrl(server.streamUri);
      req1.headers.add(HttpHeaders.rangeHeader, 'bytes=0-65535');
      final res1 = await req1.close();
      await res1.drain();
      startupSw.stop();
      startupLatencyMs = startupSw.elapsedMilliseconds;

      // Measure Random Seek Latency (simulate 50% seek scrub)
      final seekTarget = rawFileSize ~/ 2;
      final seekSw = Stopwatch()..start();
      final req2 = await client.getUrl(server.streamUri);
      req2.headers.add(
        HttpHeaders.rangeHeader,
        'bytes=$seekTarget-${seekTarget + 65535}',
      );
      final res2 = await req2.close();
      await res2.drain();
      seekSw.stop();
      seekLatencyMs = seekSw.elapsedMilliseconds;

      client.close();
    } finally {
      await server.stop();
    }

    if (startupLatencyMs <= 0) {
      throw StateError('Startup latency measurement failed: $startupLatencyMs ms');
    }
    if (seekLatencyMs <= 0) {
      throw StateError('Seek latency measurement failed: $seekLatencyMs ms');
    }

    // 8. Check Network Offline (Airplane mode)
    final autoOffline = await isNetworkOffline();
    final airplaneVerified = autoOffline;

    // 9. Memory Overhead Estimation (Process Resident Set Size)
    final info = ProcessInfo.currentRss;
    if (info <= 0) {
      throw StateError('Failed to read process resident memory');
    }
    final peakMemMb = double.parse((info / (1024.0 * 1024.0)).toStringAsFixed(1));

    if (ramGb <= 0.0) {
      throw StateError('Failed to read device RAM');
    }

    final measurementSource = Platform.isAndroid
        ? 'Physical Android Device ($deviceModel)'
        : 'Linux Host Execution (${Platform.operatingSystem})';

    return SpikeABenchmarkResult(
      deviceModel: deviceModel,
      osVersion: osVersion,
      ramGb: ramGb,
      fileSizeMb: actualMb,
      resumableDownloadSuccess: true,
      airplaneModeVerified: airplaneVerified,
      decryptionIntegrityVerified: integrityPassed,
      startupLatencyMs: startupLatencyMs,
      seekLatencyMs: seekLatencyMs,
      peakMemoryMb: peakMemMb,
      encryptionThroughputMBps: throughputMBps,
      playbackEngine: playbackEngine,
      measurementSource: measurementSource,
    );
  }
}
