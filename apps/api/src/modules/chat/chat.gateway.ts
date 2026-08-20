import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({ cors: { origin: '*' } })
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
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token provided');

      // Note: Ideally, JwtService secret should be configured here or globally.
      const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
      client.data.tenantId = payload.tenantId;
      client.data.userId = payload.sub || payload.userId;

      const roomName = `tenant_${client.data.tenantId}`;
      await client.join(roomName);

      this.logger.log(`Client ${client.id} connected. Subscribed to ${roomName}`);
      await this.redisService.getClient().incr('metrics:ws:connections');
    } catch (error) {
      this.logger.warn(`Disconnecting unauthenticated/cross-tenant client ${client.id}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    await this.redisService.getClient().decr('metrics:ws:connections');
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: Socket, @MessageBody() payload: any) {
    const { tenantId, userId } = client.data;
    if (!tenantId || !userId) return;

    try {
      // Primary Driver flow: Validate, Save to Supabase, then Broadcast to connected workers via Redis pub/sub.
      const savedMessage = await this.chatService.saveMessage(tenantId, payload.conversationId, userId, payload.content);

      this.server.to(`tenant_${tenantId}`).emit('new_message', savedMessage);
    } catch (e: any) {
      this.logger.error(`Error sending message: ${e.message}`, e);
    }
  }
}
