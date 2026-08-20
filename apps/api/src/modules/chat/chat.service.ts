import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserRole } from '@edu-lanka/shared-types';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async saveMessage(tenantId: string, conversationId: string, senderId: string, content: string, callerRole?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

        // Business Logic: Check if the user is a valid participant or Admin
        if (callerRole !== UserRole.SCHOOL_ADMIN && callerRole !== UserRole.SUPER_ADMIN) {
            const { data: participant } = await client
                .from('chat_participants')
                .select('id')
                .eq('conversation_id', conversationId)
                .eq('user_id', senderId)
                .single();

            if (!participant) {
                this.logger.warn(`User ${senderId} attempted an unauthorized message to ${conversationId}`);
                throw new ForbiddenException('You are not authorized to send messages to this conversation.');
            }
        }

        const { data, error } = await client
            .from('chat_messages')
            .insert({
                tenant_id: tenantId,
                conversation_id: conversationId,
                sender_id: senderId,
                content: content
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to save message: ${error.message}`);
            throw error;
        }
        return data;
    }
}
