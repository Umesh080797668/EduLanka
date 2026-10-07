import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:offline_video_spike/spike_a_chunked_video.dart';

void main() {
  test('Spike A: Encrypted loopback server range parsing, token security, and decryption verification', () async {
    final tempDir = Directory.systemTemp.createTempSync('spike_a_test');
    final sampleFile = File('/home/imantha/Desktop/EduLanka/spikes/offline_video_spike/assets/sample.mp4');

    expect(sampleFile.existsSync(), isTrue, reason: 'Sample MP4 asset must exist');
    expect(sampleFile.lengthSync(), greaterThan(0));

    final result = await SpikeATestRunner.runBenchmark(
      testDir: tempDir.path,
      sampleMp4Path: sampleFile.path,
    );

    expect(result.decryptionIntegrityVerified, isTrue);
    expect(result.ramGb, greaterThan(0.0));
    expect(result.peakMemoryMb, greaterThan(0.0));
    expect(result.encryptionThroughputMBps, greaterThan(0.0));

    // Test loopback server token authorization and range edge cases directly
    final testRaw = File('${tempDir.path}/raw.bin')..writeAsBytesSync([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    final encFile = File('${tempDir.path}/enc.bin');
    final cipher = AesCtrChunkCipher(
      key: Uint8List.fromList(List.generate(32, (i) => i)),
      baseIv: Uint8List.fromList(List.generate(16, (i) => i)),
    );
    encFile.writeAsBytesSync(cipher.encryptBytes(testRaw.readAsBytesSync()));

    final server = LoopbackEncryptedVideoServer(
      encryptedFile: encFile,
      key: Uint8List.fromList(List.generate(32, (i) => i)),
      baseIv: Uint8List.fromList(List.generate(16, (i) => i)),
      sessionToken: 'valid-test-token',
    );
    await server.start();

    final client = HttpClient();

    // 1. Unauthorized request without token
    final unauthReq = await client.getUrl(Uri.parse('http://127.0.0.1:${server.port}/video.mp4'));
    final unauthRes = await unauthReq.close();
    expect(unauthRes.statusCode, HttpStatus.forbidden);

    // 2. Suffix range request (bytes=-3 => last 3 bytes: 80, 90, 100)
    final suffixReq = await client.getUrl(Uri.parse('http://127.0.0.1:${server.port}/video.mp4?token=valid-test-token'));
    suffixReq.headers.add(HttpHeaders.rangeHeader, 'bytes=-3');
    final suffixRes = await suffixReq.close();
    expect(suffixRes.statusCode, HttpStatus.partialContent);
    final suffixBytes = await suffixRes.fold<List<int>>([], (p, e) => p..addAll(e));
    expect(suffixBytes, equals([80, 90, 100]));

    // 3. Out-of-bounds range request (start >= length => HTTP 416)
    final oobReq = await client.getUrl(Uri.parse('http://127.0.0.1:${server.port}/video.mp4?token=valid-test-token'));
    oobReq.headers.add(HttpHeaders.rangeHeader, 'bytes=50-60');
    final oobRes = await oobReq.close();
    expect(oobRes.statusCode, HttpStatus.requestedRangeNotSatisfiable);

    client.close();
    await server.stop();
    tempDir.deleteSync(recursive: true);
  });
}
