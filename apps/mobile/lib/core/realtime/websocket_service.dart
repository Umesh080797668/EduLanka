import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../auth/token_storage.dart';
import '../config/app_config.dart';

class WebSocketService {
  final TokenStorage tokenStorage;
  final String defaultWsUrl;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();

  bool _isConnected = false;
  bool get isConnected => _isConnected;
  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  WebSocketService({
    required this.tokenStorage,
    required this.defaultWsUrl,
  });

  Future<void> connect({String? wsUrl}) async {
    if (_isConnected) return;

    final token = await tokenStorage.getAccessToken();
    final tenantId = await tokenStorage.getTenantId();

    final targetUrl = wsUrl ?? defaultWsUrl;
    final uri = Uri.parse('$targetUrl?token=$token&tenantId=$tenantId');

    try {
      _channel = WebSocketChannel.connect(uri);
      _isConnected = true;

      _subscription = _channel?.stream.listen(
        (data) {
          try {
            final decoded = jsonDecode(data.toString()) as Map<String, dynamic>;
            _messageController.add(decoded);
          } catch (_) {}
        },
        onError: (_) {
          _isConnected = false;
        },
        onDone: () {
          _isConnected = false;
        },
      );
    } catch (_) {
      _isConnected = false;
    }
  }

  void sendMessage(String event, Map<String, dynamic> data) {
    if (_isConnected && _channel != null) {
      final payload = jsonEncode({'event': event, 'data': data});
      _channel?.sink.add(payload);
    }
  }

  void disconnect() {
    _subscription?.cancel();
    _channel?.sink.close();
    _isConnected = false;
  }

  void dispose() {
    disconnect();
    _messageController.close();
  }
}

final webSocketServiceProvider = Provider<WebSocketService>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);
  final config = ref.watch(appConfigProvider);
  final service = WebSocketService(
    tokenStorage: tokenStorage,
    defaultWsUrl: config.wsBaseUrl,
  );
  ref.onDispose(() => service.dispose());
  return service;
});
