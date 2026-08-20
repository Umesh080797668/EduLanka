import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
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
        const userId = req.user.sub || req.user.user_id || req.user.id;
        return this.chatService.saveMessage(tenantId, body.conversationId, userId, body.content);
    }
}
