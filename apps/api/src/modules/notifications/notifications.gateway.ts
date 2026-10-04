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
import { Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  transports: ['websocket', 'polling'], // Hybrid strategy
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private realtimeChannel: any;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly redisService: RedisService,
    private readonly jwtService: JwtService,
  ) { }

  onModuleInit() {
    this.realtimeChannel = this.supabaseService.adminClient.channel('system_notifications');
    this.realtimeChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        this.logger.log('Connected to Supabase Realtime for broadcasts');
      }
    });
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to notifications: ${client.id} (Transport: ${client.conn.transport.name})`);
    await this.redisService.getClient().incr('metrics:ws:notifications:connections');
    client.data.counted = true;

    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (token) {
        const payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
        client.data.tenantId = payload.tenantId;
        client.data.userId = payload.sub || payload.userId;
        client.data.role = payload.role;

        if (client.data.tenantId) {
          await client.join(`tenant_${client.data.tenantId}`);
        }
        if (client.data.userId) {
          await client.join(`user_${client.data.userId}`);
        }
      }
    } catch {
      // Connects unauthenticated (e.g. public visitor or fallback), client.data stays empty
      this.logger.debug(`Client ${client.id} connected unauthenticated to notifications`);
    }

    // Send a welcome system notification immediately (Socket.io only)
    setTimeout(() => {
      client.emit('system_notification', {
        id: Date.now().toString(),
        title: 'System Online',
        message: 'Connected to EduLanka real-time notification server.',
        timestamp: new Date().toISOString(),
        type: 'info'
      });
    }, 1000);
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from notifications: ${client.id}`);
    if (client.data?.counted) {
      await this.redisService.getClient().decr('metrics:ws:notifications:connections');
      client.data.counted = false;
    }
  }

  /**
   * Broadcast a system notification from an admin.
   * Strictly restricted to SUPER_ADMIN role.
   */
  @SubscribeMessage('broadcast_notification')
  handleBroadcast(@ConnectedSocket() client: Socket, @MessageBody() data: any) {
    const role = client.data?.role;
    if (role !== UserRole.SUPER_ADMIN && role !== 'SUPER_ADMIN') {
      this.logger.warn(
        `Unauthorized broadcast_notification attempt blocked from client ${client.id} (user: ${client.data?.userId}, role: ${role})`
      );
      client.emit('notification_error', {
        message: 'Forbidden: only System Administrators can broadcast notifications.',
      });
      return;
    }

    const payload = {
      id: Date.now().toString(),
      title: data?.title || 'System Alert',
      message: data?.message || 'A new system broadcast has been issued.',
      timestamp: new Date().toISOString(),
      type: data?.type || 'warning',
    };

    // If super admin specifies a target tenant, scope to that tenant; otherwise global
    if (data?.tenantId) {
      this.server.to(`tenant_${data.tenantId}`).emit('system_notification', payload);
    } else {
      this.server.emit('system_notification', payload);
    }

    // Emit via Supabase Realtime for Vercel/Serverless deployments
    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'system_notification',
        payload: payload
      }).catch((e: any) => this.logger.error('Failed to broadcast to Supabase', e));
    }
  }

  /**
   * Programmatic dispatch of a system notification from backend services.
   */
  sendNotification(payload: any, tenantId?: string): void {
    if (tenantId) {
      this.server.to(`tenant_${tenantId}`).emit('system_notification', payload);
    } else {
      this.server.emit('system_notification', payload);
    }

    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'system_notification',
        payload,
      }).catch((e: any) => this.logger.error('Failed to broadcast to Supabase', e));
    }
  }
}
