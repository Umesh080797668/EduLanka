import { Controller, Get, Post, Body, Req, UseGuards, Param, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Handshake tickets are deliberately short-lived: they exist only to survive the
 * moment between page load and socket connect, and socket.io refetches one on
 * every reconnect attempt.
 */
const SOCKET_TICKET_TTL_SECONDS = 300;

@Controller('chat')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly gateway: ChatGateway,
        private readonly jwt: JwtService,
    ) { }

    /** Tokens are issued with `sub`; the aliases cover older payload shapes. */
    private callerId(req: any): string {
        return req.user.sub || req.user.user_id || req.user.id;
    }

    // =========================================================================
    // Reads
    // =========================================================================

    /**
     * Short-lived handshake credential for the WebSocket gateway.
     *
     * The session JWT lives in an httpOnly cookie the page cannot read, and the
     * gateway is reached on its own origin so that cookie never rides along with
     * the handshake. Minting a brief equivalent from the already-authenticated
     * request keeps live delivery working across reloads without ever handing
     * the long-lived token to JavaScript.
     */
    @Get('socket-ticket')
    async socketTicket(@Req() req: any) {
        const { sub, tenantId, role, email } = req.user;
        const token = await this.jwt.signAsync(
            { sub, tenantId, role, email },
            { secret: process.env.JWT_SECRET, expiresIn: SOCKET_TICKET_TTL_SECONDS },
        );
        return { token, expiresIn: SOCKET_TICKET_TTL_SECONDS };
    }

    @Get('conversations')
    async listConversations(@Req() req: any) {
        return this.chatService.listConversations(
            req.user.tenantId,
            this.callerId(req),
            req.user.role,
        );
    }

    @Get('conversations/:id/messages')
    async getMessages(
        @Req() req: any,
        @Param('id') conversationId: string,
        @Query('limit') limit?: string,
        @Query('before') before?: string,
    ) {
        const parsed = Number.parseInt(limit ?? '', 10);
        return this.chatService.getMessages(
            req.user.tenantId,
            conversationId,
            this.callerId(req),
            req.user.role,
            {
                ...(Number.isFinite(parsed) ? { limit: parsed } : {}),
                ...(before ? { before } : {}),
            },
        );
    }

    @Get('conversations/:id/participants')
    async listParticipants(@Req() req: any, @Param('id') conversationId: string) {
        return this.chatService.listParticipants(
            req.user.tenantId,
            conversationId,
            this.callerId(req),
            req.user.role,
        );
    }

    // =========================================================================
    // Writes
    // =========================================================================

    @Post('messages')
    async sendMessage(@Req() req: any, @Body() body: { conversationId: string, content: string }) {
        const tenantId = req.user.tenantId;
        const callerRole = req.user.role;
        const saved = await this.chatService.saveMessage(tenantId, body.conversationId, this.callerId(req), body.content, callerRole);

        // Clients post over HTTP so refusals (muted, not a participant) surface as
        // errors, but the other participants still need the message pushed to them.
        this.gateway.broadcastMessage(tenantId, saved);
        return saved;
    }

    @Post('messages/:id/pin')
    async pinMessage(@Req() req: any, @Param('id') messageId: string, @Body() body: { messageId?: string, isPinned: boolean }) {
        const tenantId = req.user.tenantId;
        const role = req.user.role;
        return this.chatService.pinMessage(tenantId, body.messageId ?? messageId, body.isPinned, role);
    }

    @Post('participants/mute')
    async muteParticipant(@Req() req: any, @Body() body: { conversationId: string, participantUserId: string, durationMinutes: number }) {
        const tenantId = req.user.tenantId;
        const role = req.user.role;
        return this.chatService.muteParticipant(tenantId, body.conversationId, body.participantUserId, body.durationMinutes, role);
    }

    @Post('participants/remove')
    async removeParticipant(@Req() req: any, @Body() body: { conversationId: string, participantUserId: string }) {
        const tenantId = req.user.tenantId;
        const role = req.user.role;
        return this.chatService.removeParticipant(tenantId, body.conversationId, body.participantUserId, role);
    }

    @Post('messages/:id/read')
    async markAsRead(@Req() req: any, @Param('id') messageId: string) {
        const tenantId = req.user.tenantId;
        return this.chatService.markAsRead(tenantId, messageId, this.callerId(req));
    }
}
