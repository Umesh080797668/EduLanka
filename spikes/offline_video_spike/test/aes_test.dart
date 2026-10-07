import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pointycastle/export.dart';

Uint8List incrementIv(Uint8List baseIv, int counterOffset) {
  final copy = Uint8List.fromList(baseIv);
  int carry = counterOffset;
  for (int i = 15; i >= 0 && carry > 0; i--) {
    final sum = copy[i] + (carry & 0xFF);
    copy[i] = sum & 0xFF;
    carry = (sum >> 8) + (carry >> 8);
  }
  return copy;
}

CTRStreamCipher createAesCtrCipherAtOffset(Uint8List key, Uint8List baseIv, int byteOffset) {
  final blockIndex = byteOffset ~/ 16;
  final inBlockOffset = byteOffset % 16;

  final offsetIv = incrementIv(baseIv, blockIndex);
  final cipher = CTRStreamCipher(AESEngine())
    ..init(false, ParametersWithIV(KeyParameter(key), offsetIv));

  if (inBlockOffset > 0) {
    // Discard inBlockOffset keystream bytes
    cipher.process(Uint8List(inBlockOffset));
  }
  return cipher;
}

void main() {
  test('PointyCastle AES-CTR random-access seek test', () {
    final key = Uint8List.fromList(List.generate(32, (i) => i + 1));
    final iv = Uint8List.fromList(List.generate(16, (i) => (i * 7) & 0xFF));

    // Plain text of 1024 bytes
    final plainText = Uint8List.fromList(List.generate(1024, (i) => (i * 13) % 256));

    // Encrypt the entire stream
    final encCipher = CTRStreamCipher(AESEngine())
      ..init(true, ParametersWithIV(KeyParameter(key), iv));
    final cipherText = encCipher.process(plainText);

    // Seek test 1: Aligned seek at byte 64
    final seekPos1 = 64;
    final decCipher1 = createAesCtrCipherAtOffset(key, iv, seekPos1);
    final decrypted1 = decCipher1.process(cipherText.sublist(seekPos1, seekPos1 + 50));
    expect(decrypted1, equals(plainText.sublist(seekPos1, seekPos1 + 50)));

    // Seek test 2: Unaligned seek at byte 123 (123 = 7*16 + 11)
    final seekPos2 = 123;
    final decCipher2 = createAesCtrCipherAtOffset(key, iv, seekPos2);
    final decrypted2 = decCipher2.process(cipherText.sublist(seekPos2, seekPos2 + 87));
    expect(decrypted2, equals(plainText.sublist(seekPos2, seekPos2 + 87)));

    // Seek test 3: Seek near end of stream at byte 999
    final seekPos3 = 999;
    final decCipher3 = createAesCtrCipherAtOffset(key, iv, seekPos3);
    final decrypted3 = decCipher3.process(cipherText.sublist(seekPos3, 1024));
    expect(decrypted3, equals(plainText.sublist(seekPos3, 1024)));
  });
}
