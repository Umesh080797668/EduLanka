import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pointycastle/export.dart';

void main() {
  test('PointyCastle AES-GCM chunk encryption and verification', () {
    final key = Uint8List(32); // 256-bit key
    final nonce = Uint8List(12); // 96-bit nonce
    final plainText = Uint8List.fromList([1, 2, 3, 4, 5, 6, 7, 8]);

    final enc = GCMBlockCipher(AESEngine());
    enc.init(true, AEADParameters(KeyParameter(key), 128, nonce, Uint8List(0)));
    final cipherText = enc.process(plainText);

    expect(cipherText.length, equals(plainText.length + 16)); // data + 16-byte tag

    final dec = GCMBlockCipher(AESEngine());
    dec.init(false, AEADParameters(KeyParameter(key), 128, nonce, Uint8List(0)));
    final decrypted = dec.process(cipherText);

    expect(decrypted, equals(plainText));
  });
}
