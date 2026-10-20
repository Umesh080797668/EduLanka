import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:uuid/uuid.dart';
import 'aes_ctr_cipher.dart';

/// Lightweight localhost loopback streaming server that decrypts AES-256-CTR video chunks
/// on-the-fly with HTTP Range request support and ephemeral per-session token authorization,
/// avoiding unencrypted storage at rest and local port eavesdropping (P3-S6, ADR-001)
class LocalDecryptedVideoServer {
  final HttpServer _server;
  final File _file;
  final Uint8List _dek;
  final Uint8List _iv;
  final String sessionToken;

  LocalDecryptedVideoServer._({
    required HttpServer server,
    required File file,
    required Uint8List dek,
    required Uint8List iv,
    required this.sessionToken,
  }) : _server = server,
       _file = file,
       _dek = dek,
       _iv = iv {
    _listen();
  }

  int get port => _server.port;
  String get url => 'http://127.0.0.1:${_server.port}/$sessionToken/video.mp4';

  static Future<LocalDecryptedVideoServer> start({
    required File file,
    required Uint8List dek,
    required Uint8List iv,
    String? sessionToken,
    String? expectedSha256,
  }) async {
    // Validate SHA-256 integrity before starting playback (ADR-001)
    if (expectedSha256 != null && expectedSha256.isNotEmpty) {
      if (await file.exists()) {
        final bytes = await file.readAsBytes();
        if (!AesCtrCipher.verifyIntegrity(bytes, expectedSha256)) {
          throw Exception(
            'Tamper check failed: SHA-256 mismatch for ${file.path}',
          );
        }
      }
    }

    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final token = sessionToken ?? const Uuid().v4();
    return LocalDecryptedVideoServer._(
      server: server,
      file: file,
      dek: dek,
      iv: iv,
      sessionToken: token,
    );
  }

  void _listen() {
    _server.listen((HttpRequest request) async {
      try {
        // Enforce per-session token authentication to prevent localhost eavesdropping
        final expectedPath = '/$sessionToken/video.mp4';
        if (request.uri.path != expectedPath) {
          request.response.statusCode = HttpStatus.forbidden;
          request.response.headers.set(
            HttpHeaders.contentTypeHeader,
            'text/plain',
          );
          request.response.write('Forbidden: Invalid or missing session token');
          await request.response.close();
          return;
        }

        if (!await _file.exists()) {
          request.response.statusCode = HttpStatus.notFound;
          await request.response.close();
          return;
        }

        final fileLength = await _file.length();
        final rangeHeader = request.headers.value(HttpHeaders.rangeHeader);

        int start = 0;
        int end = fileLength - 1;

        if (rangeHeader != null && rangeHeader.startsWith('bytes=')) {
          final rangeSpec = rangeHeader.substring(6).trim();
          if (rangeSpec.startsWith('-')) {
            // Suffix byte range: bytes=-N
            final suffixLength = int.tryParse(rangeSpec.substring(1)) ?? 0;
            start = suffixLength > fileLength ? 0 : fileLength - suffixLength;
            end = fileLength - 1;
          } else {
            final parts = rangeSpec.split('-');
            start = int.tryParse(parts[0]) ?? 0;
            if (parts.length > 1 && parts[1].isNotEmpty) {
              final parsedEnd = int.tryParse(parts[1]);
              if (parsedEnd != null) {
                end = parsedEnd;
              }
            }
          }

          if (fileLength == 0 ||
              start < 0 ||
              start >= fileLength ||
              start > end) {
            request.response.statusCode =
                HttpStatus.requestedRangeNotSatisfiable;
            request.response.headers.set(
              HttpHeaders.contentRangeHeader,
              'bytes */$fileLength',
            );
            await request.response.close();
            return;
          }

          if (end >= fileLength) {
            end = fileLength - 1;
          }
        }

        final contentLength = end - start + 1;
        final cipher = AesCtrCipher(_dek, _iv);

        request.response.headers.set(
          HttpHeaders.contentTypeHeader,
          'video/mp4',
        );
        request.response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');

        if (rangeHeader != null) {
          request.response.statusCode = HttpStatus.partialContent;
          request.response.headers.set(
            HttpHeaders.contentRangeHeader,
            'bytes $start-$end/$fileLength',
          );
        } else {
          request.response.statusCode = HttpStatus.ok;
        }

        request.response.headers.set(
          HttpHeaders.contentLengthHeader,
          contentLength.toString(),
        );

        final raf = await _file.open(mode: FileMode.read);
        await raf.setPosition(start);

        int bytesRemaining = contentLength;
        int currentOffset = start;
        const chunkSize = 65536; // 64KB buffer

        while (bytesRemaining > 0) {
          final toRead = bytesRemaining > chunkSize
              ? chunkSize
              : bytesRemaining;
          final chunk = await raf.read(toRead);
          if (chunk.isEmpty) break;

          final decryptedChunk = cipher.processBytes(chunk, currentOffset);
          request.response.add(decryptedChunk);
          await request.response.flush();

          currentOffset += chunk.length;
          bytesRemaining -= chunk.length;
        }

        await raf.close();
        await request.response.close();
      } catch (e) {
        debugPrint('LocalDecryptedVideoServer stream exception: $e');
        try {
          request.response.statusCode = HttpStatus.internalServerError;
          await request.response.close();
        } catch (_) {}
      }
    });
  }

  Future<void> stop() async {
    await _server.close(force: true);
  }
}
