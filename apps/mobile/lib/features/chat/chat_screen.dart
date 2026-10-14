import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_state.dart';
import '../../core/database/local_database.dart';
import '../../core/realtime/websocket_service.dart';

class ChatScreen extends ConsumerStatefulWidget {
  final String conversationId;
  final String title;

  const ChatScreen({
    super.key,
    this.conversationId = 'general_class_room',
    this.title = 'Teacher & Parent Chat',
  });

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  StreamSubscription? _socketSubscription;

  @override
  void initState() {
    super.initState();
    _initChat();
  }

  Future<void> _initChat() async {
    // 1. Load locally cached offline messages
    final localMsgs = await LocalDatabase.instance.getChatMessages(
      widget.conversationId,
    );
    if (mounted) {
      setState(() {
        _messages = List.from(localMsgs);
      });
    }

    // 2. Fetch remote messages via HTTP REST API
    try {
      final apiClient = ref.read(apiClientProvider);
      final remoteMsgs = await apiClient.getConversationMessages(
        widget.conversationId,
      );
      for (final m in remoteMsgs) {
        if (m is Map) {
          await LocalDatabase.instance.saveSyncedChatMessage(
            Map<String, dynamic>.from(m),
          );
        }
      }
      final refreshed = await LocalDatabase.instance.getChatMessages(
        widget.conversationId,
      );
      if (mounted) {
        setState(() {
          _messages = List.from(refreshed);
        });
      }
    } catch (_) {
      // Offline fallback: keep local messages
    }

    // 3. Connect to real-time Socket.IO ChatGateway
    final wsService = ref.read(webSocketServiceProvider);
    await wsService.connect();
    wsService.joinConversation(widget.conversationId);

    _socketSubscription = wsService.messages.listen((eventData) {
      final event = eventData['event'];
      final data = eventData['data'];
      if (event == 'new_message' || event == 'chat_message') {
        if (data is Map) {
          final msgMap = Map<String, dynamic>.from(data);
          LocalDatabase.instance.saveSyncedChatMessage(msgMap);
          if (mounted) {
            setState(() {
              _messages.add(msgMap);
            });
            _scrollToBottom();
          }
        }
      }
    });

    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage() async {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    _textController.clear();

    final auth = ref.read(authProvider);
    final senderId = auth.userId ?? 'me';
    final now = DateTime.now().toUtc().toIso8601String();
    final messageId = const Uuid().v4();

    final messageMap = {
      'id': messageId,
      'conversation_id': widget.conversationId,
      'sender_id': senderId,
      'content': text,
      'created_at': now,
    };

    // Optimistic local persistence
    await LocalDatabase.instance.saveSyncedChatMessage(messageMap);
    setState(() {
      _messages.add(messageMap);
    });
    _scrollToBottom();

    // 1. Emit to Socket.IO real-time gateway
    ref.read(webSocketServiceProvider).sendMessage(widget.conversationId, text);

    // 2. Save via HTTP REST / sync fallback
    try {
      final apiClient = ref.read(apiClientProvider);
      await apiClient.sendChatMessage(widget.conversationId, text);
    } catch (_) {
      // Offline queue as chat_message sync event (ADR-002)
      await LocalDatabase.instance.queueSyncEvent(
        clientUuid: messageId,
        entityType: 'chat_message',
        entityId: messageId,
        eventType: 'CREATED',
        payload: {
          'id': messageId,
          'conversation_id': widget.conversationId,
          'sender_id': senderId,
          'content': text,
          'created_at': now,
        },
      );
    }
  }

  @override
  void dispose() {
    _socketSubscription?.cancel();
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final myUserId = auth.userId ?? '';

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: const Color(0xFF1E40AF),
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Expanded(
            child: _messages.isEmpty
                ? const Center(
                    child: Text(
                      'No messages yet. Send a message to start.',
                      style: TextStyle(color: Color(0xFF64748B)),
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 12,
                    ),
                    itemCount: _messages.length,
                    itemBuilder: (ctx, index) {
                      final msg = _messages[index];
                      final isMe =
                          msg['sender_id'] == myUserId ||
                          msg['sender_id'] == 'me';
                      final content = msg['content']?.toString() ?? '';
                      final timeStr = msg['created_at']?.toString() ?? '';

                      return Align(
                        alignment: isMe
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * 0.75,
                          ),
                          decoration: BoxDecoration(
                            color: isMe
                                ? const Color(0xFF1E40AF)
                                : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Column(
                            crossAxisAlignment: isMe
                                ? CrossAxisAlignment.end
                                : CrossAxisAlignment.start,
                            children: [
                              Text(
                                content,
                                style: TextStyle(
                                  color: isMe
                                      ? Colors.white
                                      : const Color(0xFF0F172A),
                                  fontSize: 14,
                                ),
                              ),
                              if (timeStr.length >= 16) ...[
                                const SizedBox(height: 4),
                                Text(
                                  timeStr.substring(11, 16),
                                  style: TextStyle(
                                    color: isMe
                                        ? Colors.white70
                                        : const Color(0xFF94A3B8),
                                    fontSize: 10,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  offset: const Offset(0, -2),
                  blurRadius: 4,
                ),
              ],
            ),
            child: SafeArea(
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _textController,
                      decoration: const InputDecoration(
                        hintText: 'Type message...',
                        border: InputBorder.none,
                      ),
                      onSubmitted: (_) => _sendMessage(),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(
                      Icons.send_rounded,
                      color: Color(0xFF1E40AF),
                    ),
                    onPressed: _sendMessage,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
