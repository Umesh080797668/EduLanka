import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../auth/token_storage.dart';
import '../config/app_config.dart';

/// Realtime chat service implementing Socket.IO v4 over WebSocket for NestJS ChatGateway
/// Supports automatic reconnection with exponential backoff, room resumption, and error frame handling
class WebSocketService {
  final TokenStorage tokenStorage;
  final String defaultWsUrl;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();

  bool _isConnected = false;
  bool _isManuallyDisconnected = false;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  static const int _initialBackoffMs = 1000;
  static const int _maxBackoffMs = 30000;

  final Set<String> _joinedConversations = {};
  String? _lastWsUrl;

  bool get isConnected => _isConnected;
  Stream<Map<String, dynamic>> get messages => _messageController.stream;

  WebSocketService({required this.tokenStorage, required this.defaultWsUrl});

  Future<void> connect({String? wsUrl}) async {
    _isManuallyDisconnected = false;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;

    if (_isConnected) return;
    if (wsUrl != null) _lastWsUrl = wsUrl;

    final token = await tokenStorage.getAccessToken();
    if (token == null || token.isEmpty) return;

    final targetBase = (_lastWsUrl ?? defaultWsUrl)
        .replaceAll('http://', 'ws://')
        .replaceAll('https://', 'wss://');
    
    // Connect using Socket.IO v4 transport
    final uri = Uri.parse('$targetBase/socket.io/?EIO=4&transport=websocket');

    try {
      _channel = WebSocketChannel.connect(uri);

      _subscription = _channel?.stream.listen(
        (data) {
          _handleIncoming(data.toString(), token);
        },
        onError: (err) {
          debugPrint('WebSocket chat error: $err');
          _isConnected = false;
          _scheduleReconnect();
        },
        onDone: () {
          debugPrint('WebSocket chat connection closed');
          _isConnected = false;
          _scheduleReconnect();
        },
      );
    } catch (e) {
      debugPrint('WebSocket connection exception: $e');
      _isConnected = false;
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    if (_isManuallyDisconnected) return;
    _reconnectTimer?.cancel();

    final backoffMs = min(
      _initialBackoffMs * pow(2, _reconnectAttempts).toInt(),
      _maxBackoffMs,
    );
    _reconnectAttempts++;

    debugPrint('Scheduling WebSocket reconnect in ${backoffMs}ms (attempt $_reconnectAttempts)...');
    _reconnectTimer = Timer(Duration(milliseconds: backoffMs), () {
      if (!_isManuallyDisconnected && !_isConnected) {
        connect(wsUrl: _lastWsUrl);
      }
    });
  }

  void _handleIncoming(String data, String token) {
    // 1. Engine.IO Ping/Pong
    if (data == '2') {
      _channel?.sink.add('3'); // Pong
      return;
    }

    // 2. Engine.IO Handshake response (packet type 0) -> send Socket.IO CONNECT packet with auth token
    if (data.startsWith('0')) {
      _channel?.sink.add('40{"token":"$token"}');
      return;
    }

    // 3. Socket.IO CONNECT acknowledgment (packet type 40)
    if (data.startsWith('40')) {
      _isConnected = true;
      _reconnectAttempts = 0;
      debugPrint('Connected to Socket.IO ChatGateway successfully');

      // Room Resumption: Rejoin all previously active conversations
      for (final convId in _joinedConversations) {
        _sendSocketIoEvent('join_conversation', {'conversationId': convId});
      }
      return;
    }

    // 4. Socket.IO DISCONNECT frame (packet type 41)
    if (data.startsWith('41')) {
      debugPrint('Received Socket.IO DISCONNECT frame (41)');
      _isConnected = false;
      _scheduleReconnect();
      return;
    }

    // 5. Socket.IO CONNECT_ERROR frame (packet type 44 e.g. 44{"message":"Unauthorized"})
    if (data.startsWith('44')) {
      final errorPayload = data.length > 2 ? data.substring(2) : '';
      debugPrint('Received Socket.IO CONNECT_ERROR frame (44): $errorPayload');
      _isConnected = false;
      _messageController.add({
        'event': 'connect_error',
        'data': {'error': errorPayload},
      });
      _scheduleReconnect();
      return;
    }

    // 6. Socket.IO Event messages (packet type 42 e.g. 42["new_message", {...}])
    if (data.startsWith('42')) {
      try {
        final payloadStr = data.substring(2);
        final decoded = jsonDecode(payloadStr);
        if (decoded is List && decoded.isNotEmpty) {
          final event = decoded[0]?.toString() ?? '';
          final body = decoded.length > 1 && decoded[1] is Map
              ? Map<String, dynamic>.from(decoded[1] as Map)
              : <String, dynamic>{};

          _messageController.add({'event': event, 'data': body});
        }
      } catch (err) {
        debugPrint('Failed to parse Socket.IO event frame: $err');
      }
    }
  }

  /// Joins a specific conversation room on the ChatGateway and tracks it for reconnection resumption
  void joinConversation(String conversationId) {
    _joinedConversations.add(conversationId);
    if (_isConnected) {
      _sendSocketIoEvent('join_conversation', {'conversationId': conversationId});
    }
  }

  /// Leaves a specific conversation room
  void leaveConversation(String conversationId) {
    _joinedConversations.remove(conversationId);
    if (_isConnected) {
      _sendSocketIoEvent('leave_conversation', {'conversationId': conversationId});
    }
  }

  /// Sends a chat message over the real-time gateway
  void sendMessage(String conversationId, String content) {
    _sendSocketIoEvent('send_message', {
      'conversationId': conversationId,
      'content': content,
    });
  }

  void _sendSocketIoEvent(String event, Map<String, dynamic> data) {
    if (_channel != null && _isConnected) {
      final packet = '42${jsonEncode([event, data])}';
      _channel?.sink.add(packet);
    }
  }

  void disconnect() {
    _isManuallyDisconnected = true;
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _subscription?.cancel();
    _subscription = null;
    _channel?.sink.close();
    _channel = null;
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
