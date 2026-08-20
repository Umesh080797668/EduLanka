import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for development
  },
  transports: ['websocket', 'polling'], // Hybrid strategy
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private realtimeChannel: any;

  constructor(private readonly supabaseService: SupabaseService) { }

  onModuleInit() {
    this.realtimeChannel = this.supabaseService.adminClient.channel('system_notifications');
    this.realtimeChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        this.logger.log('Connected to Supabase Realtime for broadcasts');
      }
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id} (Transport: ${client.conn.transport.name})`);

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

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Example of broadcasting a system notification from an admin
  @SubscribeMessage('broadcast_notification')
  handleBroadcast(@MessageBody() data: any) {
    const payload = {
      id: Date.now().toString(),
      title: data.title || 'System Alert',
      message: data.message || 'A new system broadcast has been issued.',
      timestamp: new Date().toISOString(),
      type: 'warning'
    };

    // 1. Emit via socket.io for local/VPS deployments
    this.server.emit('system_notification', payload);

    // 2. Emit via Supabase Realtime for Vercel/Serverless deployments
    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'system_notification',
        payload: payload
      }).catch((e: any) => this.logger.error('Failed to broadcast to Supabase', e));
    }
  }
}
