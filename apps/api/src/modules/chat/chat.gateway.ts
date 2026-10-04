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

@WebSocketGateway()
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
      client.data.userName = payload.name || payload.email || undefined;
      client.data.authenticated = true;

      // Join user-specific room for direct socket messaging if needed
      await client.join(`user_${client.data.userId}`);

      this.logger.log(`Client ${client.id} (user ${client.data.userId}) connected to chat`);
      await this.redisService.getClient().incr('metrics:ws:chat:connections');
      client.data.counted = true;
    } catch (error: any) {
      this.logger.warn(`Disconnecting unauthenticated/invalid chat client ${client.id}: ${error?.message}`);
      await this.redisService.getClient().incr('metrics:ws:errors').catch(() => { });
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

  /**
   * Broadcast live read receipt to the conversation's room.
   */
  broadcastReadReceipt(conversationId: string, messageId: string, userId: string): void {
    if (!this.server || !conversationId) return;
    this.server.to(`conversation_${conversationId}`).emit('message_read', {
      conversationId,
      messageId,
      userId,
    });
  }

  /**
   * Evict a user's active sockets from a conversation room (e.g. after remove/leave).
   */
  evictUserFromConversation(conversationId: string, userId: string): void {
    if (!this.server) return;
    this.server.in(`user_${userId}`).socketsLeave(`conversation_${conversationId}`);
  }

  /**
   * Evict all active sockets from a conversation room (e.g. on delete for everyone).
   */
  evictAllFromConversation(conversationId: string): void {
    if (!this.server) return;
    this.server.socketsLeave(`conversation_${conversationId}`);
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
      await this.redisService.getClient().incr('metrics:ws:errors').catch(() => { });
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

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean }
  ) {
    if (!payload?.conversationId) return;
    client.to(`conversation_${payload.conversationId}`).emit('user_typing', {
      conversationId: payload.conversationId,
      userId: client.data.userId,
      isTyping: Boolean(payload.isTyping),
    });
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const { tenantId, userId, role } = client.data;
    if (!tenantId || !userId || !payload?.conversationId) {
      client.emit('send_error', { message: 'Unauthenticated or invalid message request.' });
      return;
    }

    const content = payload?.content;

    try {
      // Primary Driver flow: Validate, Save to Supabase (with atomic rate limit), then Broadcast.
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
      await this.redisService.getClient().incr('metrics:ws:errors').catch(() => { });
      client.emit('send_error', { conversationId: payload.conversationId, message: e.message });
    }
  }
}

