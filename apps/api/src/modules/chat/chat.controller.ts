import { Controller, Post, Body, Req, UseGuards, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('chat')
@UseGuards(AuthGuard('jwt'), ThrottlerGuard)
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @UseGuards(AuthGuard('jwt'))
    @Post('messages')
    async sendMessage(@Req() req: any, @Body() body: { conversationId: string, content: string }) {
        const tenantId = req.user.tenantId;
        const callerRole = req.user.role;
        const userId = req.user.sub || req.user.user_id || req.user.id;
        return this.chatService.saveMessage(tenantId, body.conversationId, userId, body.content, callerRole);
    }

    @Post('messages/:id/pin')
    async pinMessage(@Req() req: any, @Body() body: { messageId: string, isPinned: boolean }) {
        const tenantId = req.user.tenantId;
        const role = req.user.role;
        return this.chatService.pinMessage(tenantId, body.messageId, body.isPinned, role);
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
        const userId = req.user.sub || req.user.user_id || req.user.id;
        return this.chatService.markAsRead(tenantId, messageId, userId);
    }
}
