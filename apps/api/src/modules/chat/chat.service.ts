import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UserRole } from '@edu-lanka/shared-types';

/**
 * Newest-first slice of messages used to derive inbox previews and unread
 * badges. A conversation list only ever shows recent activity, so pulling a
 * bounded window keeps the query flat instead of one round-trip per thread.
 */
const INBOX_WINDOW = 300;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** People pickers are searched, not scrolled — a wide cap is plenty. */
const DIRECTORY_LIMIT = 200;
const MAX_GROUP_MEMBERS = 100;

interface MessagePageOptions {
    limit?: number;
    /** ISO timestamp — returns messages strictly older than this (pagination). */
    before?: string;
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /** School and platform admins moderate every thread in their tenant. */
    private isModerator(role?: string): boolean {
        return role === UserRole.SCHOOL_ADMIN || role === UserRole.SUPER_ADMIN;
    }

    /**
     * Membership gate for reading and writing a conversation. Admins bypass it so
     * they can moderate threads they were never enrolled in; everyone else needs
     * a participant row that is not currently muted.
     */
    private async assertParticipant(
        client: any,
        conversationId: string,
        userId: string,
        callerRole?: string,
        opts: { enforceMute?: boolean } = {},
    ): Promise<void> {
        if (this.isModerator(callerRole)) return;

        const { data: participant } = await client
            .from('chat_participants')
            .select('id, muted_until')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .maybeSingle();

        if (!participant) {
            this.logger.warn(`User ${userId} attempted unauthorized access to ${conversationId}`);
            throw new ForbiddenException('You are not a participant in this conversation.');
        }

        if (
            opts.enforceMute &&
            participant.muted_until &&
            new Date(participant.muted_until).getTime() > Date.now()
        ) {
            throw new ForbiddenException('You are muted in this conversation.');
        }
    }

    /** Resolve display identities for a set of `public.users.id` values. */
    private async resolveUsers(
        client: any,
        userIds: string[],
    ): Promise<Map<string, { full_name: string; role: string; avatar_url: string | null }>> {
        const unique = [...new Set(userIds.filter(Boolean))];
        if (unique.length === 0) return new Map();

        const { data } = await client
            .from('users')
            .select('id, full_name, role, avatar_url')
            .in('id', unique);

        return new Map(
            (data ?? []).map((u: any) => [
                u.id,
                { full_name: u.full_name, role: u.role, avatar_url: u.avatar_url ?? null },
            ]),
        );
    }

    async saveMessage(tenantId: string, conversationId: string, senderId: string, content: string, callerRole?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

        await this.assertParticipant(client, conversationId, senderId, callerRole, {
            enforceMute: true,
        });

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

    /**
     * Conversations the caller can open, newest activity first. Each row carries
     * the last message and the caller's unread count so the inbox needs exactly
     * one request.
     */
    async listConversations(tenantId: string, userId: string, callerRole?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);

        const conversations: any[] = [];
        const mutedUntil = new Map<string, string | null>();

        if (this.isModerator(callerRole)) {
            const { data, error } = await client
                .from('chat_conversations')
                .select('id, name, type, class_id, created_at')
                .order('created_at', { ascending: false });

            if (error) {
                this.logger.error(`Failed to list conversations: ${error.message}`);
                throw error;
            }
            conversations.push(...(data ?? []));
        } else {
            const { data, error } = await client
                .from('chat_participants')
                .select('conversation_id, muted_until, chat_conversations(id, name, type, class_id, created_at)')
                .eq('user_id', userId);

            if (error) {
                this.logger.error(`Failed to list conversations: ${error.message}`);
                throw error;
            }

            for (const row of data ?? []) {
                const conversation = (row as any).chat_conversations;
                if (!conversation) continue; // membership row outlived its conversation
                conversations.push(conversation);
                mutedUntil.set(conversation.id, (row as any).muted_until ?? null);
            }
        }

        if (conversations.length === 0) return [];

        const ids = conversations.map((c) => c.id);

        const { data: recent } = await client
            .from('chat_messages')
            .select('id, conversation_id, sender_id, content, created_at')
            .in('conversation_id', ids)
            .order('created_at', { ascending: false })
            .limit(INBOX_WINDOW);

        const window: any[] = recent ?? [];

        const readIds = new Set<string>();
        if (window.length > 0) {
            const { data: receipts } = await client
                .from('chat_read_receipts')
                .select('message_id')
                .eq('user_id', userId)
                .in('message_id', window.map((m) => m.id));

            for (const receipt of receipts ?? []) readIds.add((receipt as any).message_id);
        }

        const latest = new Map<string, any>();
        const unread = new Map<string, number>();

        for (const message of window) {
            // Already newest-first, so the first hit per conversation is the latest.
            if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
            if (message.sender_id !== userId && !readIds.has(message.id)) {
                unread.set(message.conversation_id, (unread.get(message.conversation_id) ?? 0) + 1);
            }
        }

        // DIRECT threads have no stored name — label them with the other person.
        const directIds = conversations.filter((c) => c.type === 'DIRECT').map((c) => c.id);
        const counterpart = new Map<string, string>();

        if (directIds.length > 0) {
            const { data: members } = await client
                .from('chat_participants')
                .select('conversation_id, user_id')
                .in('conversation_id', directIds);

            const others = (members ?? []).filter((m: any) => m.user_id !== userId);
            const names = await this.resolveUsers(client, others.map((m: any) => m.user_id));

            for (const member of others) {
                const name = names.get((member as any).user_id)?.full_name;
                if (name && !counterpart.has((member as any).conversation_id)) {
                    counterpart.set((member as any).conversation_id, name);
                }
            }
        }

        return conversations
            .map((conversation) => ({
                ...conversation,
                name: conversation.name ?? counterpart.get(conversation.id) ?? null,
                muted_until: mutedUntil.get(conversation.id) ?? null,
                last_message: latest.get(conversation.id) ?? null,
                unread_count: unread.get(conversation.id) ?? 0,
            }))
            .sort((a, b) => {
                const left = a.last_message?.created_at ?? a.created_at ?? '';
                const right = b.last_message?.created_at ?? b.created_at ?? '';
                return String(right).localeCompare(String(left));
            });
    }

    // =========================================================================
    // Starting conversations
    // =========================================================================

    /**
     * The set of `public.users.id` values the caller is allowed to open a thread
     * with, or `null` for "no restriction".
     *
     * The boundary that matters here is a child-safety one: students and
     * guardians may reach school staff, and never each other. Teachers reach
     * staff plus the families of the classes they are actually assigned to, so a
     * teacher cannot cold-message a child they do not teach. Admins moderate the
     * whole tenant and are unrestricted.
     */
    private async resolveContactIds(
        client: any,
        userId: string,
        callerRole?: string,
    ): Promise<string[] | null> {
        if (this.isModerator(callerRole)) return null;

        const { data: staff } = await client
            .from('users')
            .select('id')
            .in('role', [UserRole.TEACHER, UserRole.SCHOOL_ADMIN])
            .eq('is_active', true);

        const ids = new Set<string>((staff ?? []).map((u: any) => u.id));

        if (callerRole === UserRole.TEACHER) {
            const { data: teacher } = await client
                .from('teachers')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (teacher?.id) {
                // `class_teachers` carries no tenant_id, but filtering by a
                // tenant-scoped teacher id keeps the reach inside the tenant.
                const { data: assignments } = await client
                    .from('class_teachers')
                    .select('class_id')
                    .eq('teacher_id', teacher.id);

                const classIds = (assignments ?? []).map((a: any) => a.class_id).filter(Boolean);

                if (classIds.length > 0) {
                    const { data: students } = await client
                        .from('students')
                        .select('id, user_id')
                        .in('class_id', classIds);

                    for (const student of students ?? []) {
                        if ((student as any).user_id) ids.add((student as any).user_id);
                    }

                    const studentIds = (students ?? []).map((s: any) => s.id);
                    if (studentIds.length > 0) {
                        const { data: guardians } = await client
                            .from('parents')
                            .select('user_id')
                            .in('student_id', studentIds);

                        for (const guardian of guardians ?? []) {
                            if ((guardian as any).user_id) ids.add((guardian as any).user_id);
                        }
                    }
                }
            }
        }

        ids.delete(userId);
        return [...ids];
    }

    private async assertCanMessage(
        client: any,
        userId: string,
        callerRole: string | undefined,
        targetIds: string[],
    ): Promise<void> {
        const allowed = await this.resolveContactIds(client, userId, callerRole);
        if (allowed === null) return;

        const permitted = new Set(allowed);
        if (targetIds.some((id) => !permitted.has(id))) {
            throw new ForbiddenException(
                'You are not permitted to start a conversation with one or more of those people.',
            );
        }
    }

    /**
     * People the caller may start a thread with. Powers the new-conversation
     * picker, so it is deliberately name-searchable and role-labelled.
     */
    async listDirectory(tenantId: string, userId: string, callerRole?: string, search?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);
        const allowed = await this.resolveContactIds(client, userId, callerRole);
        if (allowed !== null && allowed.length === 0) return [];

        let query = client
            .from('users')
            .select('id, full_name, role, avatar_url')
            .eq('is_active', true)
            .neq('id', userId)
            .order('full_name', { ascending: true })
            .limit(DIRECTORY_LIMIT);

        if (allowed !== null) query = query.in('id', allowed);

        // Commas and parentheses terminate a PostgREST filter, and %/_ are LIKE
        // wildcards — none of them belong in a name search.
        const term = (search ?? '').replace(/[,()%_*]/g, ' ').trim();
        if (term) query = query.ilike('full_name', `%${term}%`);

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to list chat directory: ${error.message}`);
            throw error;
        }

        return (data ?? []).map((user: any) => ({
            user_id: user.id,
            full_name: user.full_name,
            role: user.role,
            avatar_url: user.avatar_url ?? null,
        }));
    }

    /**
     * Open the one-to-one thread between the caller and someone else, creating it
     * on first contact. Idempotent in practice: two people pressing send at the
     * same instant can produce a duplicate pair, which is harmless — both threads
     * are valid and the newer one simply goes quiet.
     */
    async startDirectConversation(
        tenantId: string,
        userId: string,
        callerRole: string | undefined,
        targetUserId: string,
    ) {
        if (!targetUserId || targetUserId === userId) {
            throw new BadRequestException('Choose someone else to message.');
        }

        const client = this.supabaseService.getTenantClient(tenantId);
        await this.assertCanMessage(client, userId, callerRole, [targetUserId]);

        const existing = await this.findDirectConversation(client, userId, targetUserId);
        if (existing) return this.shapeConversation(client, existing, userId);

        const { data: conversation, error } = await client
            .from('chat_conversations')
            .insert({ tenant_id: tenantId, type: 'DIRECT', name: null, class_id: null })
            .select('id, name, type, class_id, created_at')
            .single();

        if (error) {
            this.logger.error(`Failed to create direct conversation: ${error.message}`);
            throw error;
        }

        const { error: memberError } = await client.from('chat_participants').insert([
            { tenant_id: tenantId, conversation_id: conversation.id, user_id: userId, role: 'MEMBER' },
            { tenant_id: tenantId, conversation_id: conversation.id, user_id: targetUserId, role: 'MEMBER' },
        ]);

        if (memberError) {
            this.logger.error(`Failed to enrol direct participants: ${memberError.message}`);
            throw memberError;
        }

        return this.shapeConversation(client, conversation, userId);
    }

    /**
     * Ad-hoc group thread — a subject panel, a prefects' committee, a parents'
     * working group. Only staff may open one; the creator moderates it.
     */
    async createGroupConversation(
        tenantId: string,
        userId: string,
        callerRole: string | undefined,
        name: string,
        memberUserIds: string[],
    ) {
        this.ensureModerator(callerRole ?? '');

        const label = (name ?? '').trim();
        if (!label) throw new BadRequestException('Give the group a name.');

        const members = [
            ...new Set(
                (memberUserIds ?? []).filter(
                    (id) => typeof id === 'string' && id.length > 0 && id !== userId,
                ),
            ),
        ];

        if (members.length === 0) {
            throw new BadRequestException('Add at least one member to the group.');
        }
        if (members.length > MAX_GROUP_MEMBERS) {
            throw new BadRequestException(`A group can hold at most ${MAX_GROUP_MEMBERS} members.`);
        }

        const client = this.supabaseService.getTenantClient(tenantId);
        await this.assertCanMessage(client, userId, callerRole, members);

        const { data: conversation, error } = await client
            .from('chat_conversations')
            .insert({
                tenant_id: tenantId,
                type: 'GROUP',
                name: label.slice(0, 255),
                class_id: null,
            })
            .select('id, name, type, class_id, created_at')
            .single();

        if (error) {
            this.logger.error(`Failed to create group conversation: ${error.message}`);
            throw error;
        }

        const rows = [
            { tenant_id: tenantId, conversation_id: conversation.id, user_id: userId, role: 'MODERATOR' },
            ...members.map((id) => ({
                tenant_id: tenantId,
                conversation_id: conversation.id,
                user_id: id,
                role: 'MEMBER',
            })),
        ];

        const { error: memberError } = await client.from('chat_participants').insert(rows);
        if (memberError) {
            this.logger.error(`Failed to enrol group participants: ${memberError.message}`);
            throw memberError;
        }

        return this.shapeConversation(client, conversation, userId);
    }

    /** Existing DIRECT thread shared by two people, if there is one. */
    private async findDirectConversation(client: any, userId: string, targetUserId: string) {
        const { data: mine } = await client
            .from('chat_participants')
            .select('conversation_id')
            .eq('user_id', userId);

        const ids = (mine ?? []).map((row: any) => row.conversation_id);
        if (ids.length === 0) return null;

        const { data: shared } = await client
            .from('chat_participants')
            .select('conversation_id')
            .eq('user_id', targetUserId)
            .in('conversation_id', ids);

        const sharedIds = (shared ?? []).map((row: any) => row.conversation_id);
        if (sharedIds.length === 0) return null;

        const { data } = await client
            .from('chat_conversations')
            .select('id, name, type, class_id, created_at')
            .in('id', sharedIds)
            .eq('type', 'DIRECT')
            .limit(1)
            .maybeSingle();

        return data ?? null;
    }

    /** Dress a freshly created conversation in the same shape as the inbox rows. */
    private async shapeConversation(client: any, conversation: any, userId: string) {
        let name: string | null = conversation.name ?? null;

        if (!name && conversation.type === 'DIRECT') {
            const { data: members } = await client
                .from('chat_participants')
                .select('user_id')
                .eq('conversation_id', conversation.id);

            const other = (members ?? [])
                .map((member: any) => member.user_id)
                .find((id: string) => id !== userId);

            if (other) {
                name = (await this.resolveUsers(client, [other])).get(other)?.full_name ?? null;
            }
        }

        return {
            ...conversation,
            name,
            muted_until: null,
            last_message: null,
            unread_count: 0,
        };
    }

    /**
     * One page of history, oldest-first for rendering. Pass `before` (the oldest
     * `created_at` already held) to walk further back.
     */
    async getMessages(
        tenantId: string,
        conversationId: string,
        userId: string,
        callerRole?: string,
        opts: MessagePageOptions = {},
    ) {
        const client = this.supabaseService.getTenantClient(tenantId);
        await this.assertParticipant(client, conversationId, userId, callerRole);

        const limit = Math.min(Math.max(opts.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

        let query = client
            .from('chat_messages')
            .select('id, conversation_id, sender_id, content, is_pinned, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (opts.before) query = query.lt('created_at', opts.before);

        const { data, error } = await query;
        if (error) {
            this.logger.error(`Failed to load messages for ${conversationId}: ${error.message}`);
            throw error;
        }

        const page = (data ?? []).slice().reverse();
        if (page.length === 0) return { conversationId, messages: [], hasMore: false };

        // Sender identities are resolved separately rather than as a PostgREST
        // embed so history keeps loading even before the schema cache reloads.
        const [senders, receipts] = await Promise.all([
            this.resolveUsers(client, page.map((m: any) => m.sender_id)),
            client
                .from('chat_read_receipts')
                .select('message_id, user_id')
                .in('message_id', page.map((m: any) => m.id)),
        ]);

        const readers = new Map<string, string[]>();
        for (const receipt of (receipts as any)?.data ?? []) {
            const list = readers.get(receipt.message_id) ?? [];
            list.push(receipt.user_id);
            readers.set(receipt.message_id, list);
        }

        return {
            conversationId,
            hasMore: page.length === limit,
            messages: page.map((message: any) => {
                const readBy = readers.get(message.id) ?? [];
                return {
                    ...message,
                    sender_name: senders.get(message.sender_id)?.full_name ?? null,
                    sender_role: senders.get(message.sender_id)?.role ?? null,
                    sender_avatar_url: senders.get(message.sender_id)?.avatar_url ?? null,
                    read_by: readBy,
                    is_read: readBy.some((id) => id !== message.sender_id),
                };
            }),
        };
    }

    /**
     * Reconcile a class group chat against the class roster. Idempotent and
     * two-way: joiners are added, people who left the roll or the staffing sheet
     * are dropped. Safe to call after any enrolment, transfer or reassignment.
     *
     * Admins are intentionally not enrolled — they moderate every thread without
     * a membership row, so adding them would only create rows to clean up.
     */
    async syncClassParticipants(tenantId: string, classId: string): Promise<number> {
        const client = this.supabaseService.getTenantClient(tenantId);

        const { data: conversation } = await client
            .from('chat_conversations')
            .select('id')
            .eq('class_id', classId)
            .eq('type', 'CLASS')
            .maybeSingle();

        if (!conversation) {
            this.logger.warn(`No class conversation provisioned for class ${classId}`);
            return 0;
        }

        const [{ data: students }, { data: staff }] = await Promise.all([
            client.from('students').select('user_id').eq('class_id', classId),
            client.from('class_teachers').select('teachers(user_id)').eq('class_id', classId),
        ]);

        const members = new Map<string, 'MEMBER' | 'MODERATOR'>();
        for (const student of students ?? []) {
            if ((student as any).user_id) members.set((student as any).user_id, 'MEMBER');
        }
        // Assigned teachers moderate their own class group.
        for (const assignment of staff ?? []) {
            const userId = (assignment as any).teachers?.user_id;
            if (userId) members.set(userId, 'MODERATOR');
        }

        if (members.size > 0) {
            const rows = [...members].map(([user_id, role]) => ({
                tenant_id: tenantId,
                conversation_id: conversation.id,
                user_id,
                role,
            }));

            // `UNIQUE (conversation_id, user_id)` absorbs the repeats.
            const { error } = await client
                .from('chat_participants')
                .upsert(rows, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true });

            if (error) {
                this.logger.error(`Failed to sync participants for class ${classId}: ${error.message}`);
                return 0;
            }
        }

        const { data: existing } = await client
            .from('chat_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id);

        const stale = (existing ?? [])
            .map((row: any) => row.user_id)
            .filter((userId: string) => !members.has(userId));

        if (stale.length > 0) {
            const { error } = await client
                .from('chat_participants')
                .delete()
                .eq('conversation_id', conversation.id)
                .in('user_id', stale);

            if (error) {
                this.logger.warn(`Failed to prune ${stale.length} stale participants: ${error.message}`);
            }
        }

        return members.size;
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

    /** Roster of a conversation — powers the moderation panel. */
    async listParticipants(tenantId: string, conversationId: string, userId: string, callerRole?: string) {
        const client = this.supabaseService.getTenantClient(tenantId);
        await this.assertParticipant(client, conversationId, userId, callerRole);

        const { data, error } = await client
            .from('chat_participants')
            .select('id, user_id, role, muted_until, joined_at')
            .eq('conversation_id', conversationId);

        if (error) throw error;

        const rows = data ?? [];
        const identities = await this.resolveUsers(client, rows.map((r: any) => r.user_id));

        return rows.map((row: any) => ({
            ...row,
            full_name: identities.get(row.user_id)?.full_name ?? null,
            user_role: identities.get(row.user_id)?.role ?? null,
            avatar_url: identities.get(row.user_id)?.avatar_url ?? null,
            is_muted: !!row.muted_until && new Date(row.muted_until).getTime() > Date.now(),
        }));
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
