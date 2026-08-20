import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserRole } from '@edu-lanka/shared-types';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async saveMessage(tenantId: string, conversationId: string, senderId: string, content: string, callerRole?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

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

    private ensureModerator(role: string): void {
        if (role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN && role !== UserRole.TEACHER) {
            throw new ForbiddenException('Only teachers and admins can perform moderation actions.');
        }
    }

    async pinMessage(tenantId: string, messageId: string, isPinned: boolean, callerRole: string) {
        this.ensureModerator(callerRole);
        const client = this.supabaseService.getTenantClient(tenantId);

        const { data, error } = await client
            .from('chat_messages')
            .update({ is_pinned: isPinned })
            .eq('id', messageId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async muteParticipant(tenantId: string, conversationId: string, participantUserId: string, durationMinutes: number, callerRole: string) {
        this.ensureModerator(callerRole);
        const client = this.supabaseService.getTenantClient(tenantId);

        const mutedUntil = new Date(Date.now() + durationMinutes * 60000).toISOString();

        const { data, error } = await client
            .from('chat_participants')
            .update({ muted_until: mutedUntil })
            .eq('conversation_id', conversationId)
            .eq('user_id', participantUserId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async removeParticipant(tenantId: string, conversationId: string, participantUserId: string, callerRole: string) {
        this.ensureModerator(callerRole);
        const client = this.supabaseService.getTenantClient(tenantId);

        const { error } = await client
            .from('chat_participants')
            .delete()
            .eq('conversation_id', conversationId)
            .eq('user_id', participantUserId);

        if (error) throw error;
        return { success: true };
    }

    async markAsRead(tenantId: string, messageId: string, userId: string) {
        const client = this.supabaseService.getTenantClient(tenantId);
        const { data, error } = await client
            .from('chat_read_receipts')
            .insert({ tenant_id: tenantId, message_id: messageId, user_id: userId })
            .select()
            .maybeSingle();
        if (error && error.code !== '23505') throw error; // Ignore duplicates
        return data;
    }
}
