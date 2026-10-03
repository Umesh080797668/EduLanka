import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : '*';

@WebSocketGateway({ cors: { origin: allowedOrigins } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService
  ) { }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) throw new Error('No token provided');

      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
      client.data.tenantId = payload.tenantId;
      client.data.userId = payload.sub || payload.userId;
      client.data.role = payload.role;
      client.data.authenticated = true;

      // Join user-specific room for direct socket messaging if needed
      await client.join(`user_${client.data.userId}`);

      this.logger.log(`Client ${client.id} (user ${client.data.userId}) connected to chat`);
      await this.redisService.getClient().incr('metrics:ws:chat:connections');
      client.data.counted = true;
    } catch (error: any) {
      this.logger.warn(`Disconnecting unauthenticated/invalid chat client ${client.id}: ${error?.message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from chat: ${client.id}`);
    if (client.data?.counted) {
      await this.redisService.getClient().decr('metrics:ws:chat:connections');
      client.data.counted = false;
    }
  }

  /**
   * Push a stored message to the conversation's room.
   * Delivery is strictly scoped to participants who have joined conversation_<id>.
   */
  broadcastMessage(conversationIdOrTenant: string, message: any): void {
    if (!this.server || !message) return;
    const conversationId = message.conversation_id || conversationIdOrTenant;
    this.server.to(`conversation_${conversationId}`).emit('new_message', message);
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    const { tenantId, userId, role } = client.data;
    if (!tenantId || !userId || !payload?.conversationId) {
      client.emit('chat_error', { message: 'Authentication required or invalid conversation' });
      return;
    }

    try {
      await this.chatService.assertParticipantAccess(tenantId, payload.conversationId, userId, role);
      const roomName = `conversation_${payload.conversationId}`;
      await client.join(roomName);
      this.logger.log(`Client ${client.id} (user ${userId}) joined room ${roomName}`);
      client.emit('joined_conversation', { conversationId: payload.conversationId });
    } catch (e: any) {
      this.logger.warn(`User ${userId} denied joining conversation ${payload.conversationId}: ${e.message}`);
      client.emit('chat_error', { conversationId: payload?.conversationId, message: e.message });
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string }
  ) {
    if (payload?.conversationId) {
      const roomName = `conversation_${payload.conversationId}`;
      await client.leave(roomName);
      client.emit('left_conversation', { conversationId: payload.conversationId });
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const { tenantId, userId, role } = client.data;
    if (!tenantId || !userId || !payload?.conversationId) {
      client.emit('send_error', { message: 'Unauthenticated or invalid message request.' });
      return;
    }

    // 1. Content validation
    const content = payload?.content;
    if (!content || typeof content !== 'string' || !content.trim()) {
      client.emit('send_error', {
        conversationId: payload.conversationId,
        message: 'Message content cannot be empty.',
      });
      return;
    }

    if (content.length > 4000) {
      client.emit('send_error', {
        conversationId: payload.conversationId,
        message: 'Message content exceeds maximum length of 4000 characters.',
      });
      return;
    }

    // 2. Chat Flood Control: Rate limit (max 5 messages per 3 seconds per user)
    try {
      const redis = this.redisService.getClient();
      const rateKey = `ratelimit:chat:ws:${userId}`;
      const msgCount = await redis.incr(rateKey);
      if (msgCount === 1) {
        await redis.expire(rateKey, 3);
      }
      if (msgCount > 5) {
        this.logger.warn(`Rate limit triggered on chat for user ${userId} (${msgCount} messages in 3s)`);
        client.emit('send_error', {
          conversationId: payload.conversationId,
          message: 'Rate limit exceeded: too many messages sent. Please slow down.',
        });
        return;
      }
    } catch (e: any) {
      this.logger.warn(`Chat rate limit check bypassed: ${e?.message}`);
    }

    try {
      // Primary Driver flow: Validate, Save to Supabase, then Broadcast to conversation room.
      const savedMessage = await this.chatService.saveMessage(
        tenantId,
        payload.conversationId,
        userId,
        content,
        role
      );

      this.broadcastMessage(payload.conversationId, savedMessage);
    } catch (e: any) {
      this.logger.error(`Error sending message: ${e.message}`, e);
      client.emit('send_error', { conversationId: payload.conversationId, message: e.message });
    }
  }
}
