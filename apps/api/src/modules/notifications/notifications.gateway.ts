import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for development
  },
  transports: ['websocket', 'polling'], // Hybrid strategy
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id} (Transport: ${client.conn.transport.name})`);
    
    // Send a welcome system notification immediately
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
    this.server.emit('system_notification', {
      id: Date.now().toString(),
      title: data.title || 'System Alert',
      message: data.message || 'A new system broadcast has been issued.',
      timestamp: new Date().toISOString(),
      type: 'warning'
    });
  }
}
