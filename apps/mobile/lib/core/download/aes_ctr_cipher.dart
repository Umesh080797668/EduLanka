import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:crypto/crypto.dart' as crypto;
import 'package:encrypt/encrypt.dart' as enc;
import 'package:pointycastle/api.dart';
import 'package:pointycastle/block/aes.dart';

/// AES-256-CTR streaming cipher with arbitrary byte-offset seeking support (P3-S6, ADR-001)
class AesCtrCipher {
  final AESEngine _engine;
  final BigInt _ivInt;

  AesCtrCipher(Uint8List keyBytes, Uint8List ivBytes)
    : _engine = AESEngine()..init(true, KeyParameter(keyBytes)),
      _ivInt = _bytesToBigInt(ivBytes);

  static BigInt _bytesToBigInt(Uint8List bytes) {
    BigInt result = BigInt.zero;
    for (int i = 0; i < bytes.length; i++) {
      result = (result << 8) | BigInt.from(bytes[i]);
    }
    return result;
  }

  static Uint8List _bigIntToBytes(BigInt number) {
    final result = Uint8List(16);
    var temp = number;
    for (int i = 15; i >= 0; i--) {
      result[i] = (temp & BigInt.from(0xff)).toInt();
      temp = temp >> 8;
    }
    return result;
  }

  /// Processes bytes at a specific stream byte offset for CTR keystream alignment
  Uint8List processBytes(Uint8List input, int streamOffset) {
    final output = Uint8List(input.length);
    int currentOffset = streamOffset;
    final keystreamBlock = Uint8List(16);

    int i = 0;
    while (i < input.length) {
      final blockIndex = BigInt.from(currentOffset ~/ 16);
      final counterInt = _ivInt + blockIndex;
      final counterBytes = _bigIntToBytes(counterInt);

      _engine.processBlock(counterBytes, 0, keystreamBlock, 0);

      while (i < input.length) {
        final bytePos = currentOffset % 16;
        output[i] = input[i] ^ keystreamBlock[bytePos];
        i++;
        currentOffset++;
        if (currentOffset % 16 == 0) break;
      }
    }
    return output;
  }

  /// Computes a SHA-256 integrity hash over bytes to detect tampering or corruption
  static String computeSha256(Uint8List bytes) {
    return crypto.sha256.convert(bytes).toString();
  }

  /// Validates ciphertext or asset bytes against expected SHA-256 digest
  static bool verifyIntegrity(Uint8List bytes, String expectedSha256) {
    final actual = computeSha256(bytes);
    return actual.toLowerCase() == expectedSha256.trim().toLowerCase();
  }
}

/// Key Encapsulation Mechanism (KEK / DEK architecture)
/// Wraps per-file 256-bit DEK and 128-bit IV using the hardware-backed Master Key.
class KeyEncapsulation {
  /// Encrypts DEK (32 bytes) + IV (16 bytes) with Master Key using AES-CBC
  static String wrapDek({
    required Uint8List dekBytes,
    required Uint8List ivBytes,
    required String masterKeyBase64,
  }) {
    final masterBytes = _normalizeMasterKey(masterKeyBase64);
    final key = enc.Key(masterBytes);
    final kekIv = enc.IV.fromSecureRandom(16);
    final encrypter = enc.Encrypter(enc.AES(key, mode: enc.AESMode.cbc));

    // Combine payload: [32-byte DEK] + [16-byte IV] = 48 bytes
    final payload = Uint8List(48)
      ..setRange(0, 32, dekBytes)
      ..setRange(32, 48, ivBytes);

    final encrypted = encrypter.encryptBytes(payload, iv: kekIv);

    // Stored token: [16-byte KEK IV] + [encrypted ciphertext]
    final result = Uint8List(kekIv.bytes.length + encrypted.bytes.length)
      ..setRange(0, kekIv.bytes.length, kekIv.bytes)
      ..setRange(
        kekIv.bytes.length,
        kekIv.bytes.length + encrypted.bytes.length,
        encrypted.bytes,
      );

    return base64UrlEncode(result);
  }

  /// Decrypts wrapped token to restore the per-file DEK and IV
  static ({Uint8List dek, Uint8List iv}) unwrapDek({
    required String wrappedDekBase64,
    required String masterKeyBase64,
  }) {
    final combined = base64Url.decode(base64Url.normalize(wrappedDekBase64));
    final masterBytes = _normalizeMasterKey(masterKeyBase64);
    final key = enc.Key(masterBytes);

    if (combined.length < 32) {
      // Legacy fallback for raw base64 DEKs without IV
      final rawBytes = combined;
      final dek = Uint8List(32);
      for (int i = 0; i < 32 && i < rawBytes.length; i++) {
        dek[i] = rawBytes[i];
      }
      final iv = Uint8List(16);
      return (dek: dek, iv: iv);
    }

    final kekIvBytes = combined.sublist(0, 16);
    final cipherBytes = combined.sublist(16);

    final encrypter = enc.Encrypter(enc.AES(key, mode: enc.AESMode.cbc));
    final decrypted = encrypter.decryptBytes(
      enc.Encrypted(cipherBytes),
      iv: enc.IV(kekIvBytes),
    );

    final dek = Uint8List.fromList(decrypted.sublist(0, 32));
    final iv = Uint8List.fromList(decrypted.sublist(32, 48));

    return (dek: dek, iv: iv);
  }

  static Uint8List _normalizeMasterKey(String masterKey) {
    try {
      final decoded = base64Url.decode(base64Url.normalize(masterKey));
      if (decoded.length >= 32) {
        return Uint8List.fromList(decoded.sublist(0, 32));
      }
      final padded = Uint8List(32);
      padded.setRange(0, decoded.length, decoded);
      return padded;
    } catch (_) {
      final utf8Bytes = utf8.encode(masterKey);
      final padded = Uint8List(32);
      for (int i = 0; i < 32 && i < utf8Bytes.length; i++) {
        padded[i] = utf8Bytes[i];
      }
      return padded;
    }
  }

  /// Generates a fresh cryptographically secure random 256-bit DEK and 128-bit IV
  static ({Uint8List dek, Uint8List iv}) generateFreshKeys() {
    final random = Random.secure();
    final dek = Uint8List.fromList(
      List<int>.generate(32, (_) => random.nextInt(256)),
    );
    final iv = Uint8List.fromList(
      List<int>.generate(16, (_) => random.nextInt(256)),
    );
    return (dek: dek, iv: iv);
  }
}
