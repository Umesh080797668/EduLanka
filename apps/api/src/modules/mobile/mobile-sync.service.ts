import { createPrivateKey, createPublicKey, KeyObject, sign, randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    Logger,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    GoneException,
    InternalServerErrorException,
} from '@nestjs/common';

import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import { assertCleanContent } from '../../common/utils/profanity-filter';
import type { AppendSyncEventDto } from './dto/mobile.dto';
import { getTenantSchoolPolicy } from './mobile-policy.util';

@Injectable()
export class MobileSyncService {
    private readonly logger = new Logger(MobileSyncService.name);

    // Persistent Ed25519 Key Identifier and Keypair
    public static readonly keyId = process.env.OFFLINE_LICENSE_KEY_ID ?? 'edulanka-offline-v1';
    public static signingKeyPair?: { publicKey: KeyObject; privateKey: KeyObject };

    public static getSigningKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
        if (MobileSyncService.signingKeyPair) {
            return MobileSyncService.signingKeyPair;
        }

        const env = process.env.NODE_ENV || 'development';
        const isStrictEnv = env === 'production' || env === 'staging';
        const envKey = process.env.OFFLINE_LICENSE_PRIVATE_KEY;

        if (isStrictEnv && !envKey) {
            throw new InternalServerErrorException(
                'OFFLINE_LICENSE_PRIVATE_KEY must be configured in production and staging environments',
            );
        }

        if (envKey) {
            try {
                const keyInput = envKey.includes('-----BEGIN')
                    ? envKey.replace(/\\n/g, '\n')
                    : { key: Buffer.from(envKey, 'base64'), format: 'der' as const, type: 'pkcs8' as const };
                const privateKey = createPrivateKey(keyInput as any);
                const publicKey = createPublicKey(privateKey);
                MobileSyncService.signingKeyPair = { privateKey, publicKey };
                return MobileSyncService.signingKeyPair;
            } catch (err: any) {
                throw new InternalServerErrorException(
                    `Invalid OFFLINE_LICENSE_PRIVATE_KEY: ${err?.message || 'failed to parse Ed25519 private key'}`,
                );
            }
        }

        if (env !== 'development' && env !== 'test') {
            throw new InternalServerErrorException(
                'OFFLINE_LICENSE_PRIVATE_KEY must be configured outside development/test environments',
            );
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new InternalServerErrorException(
                'OFFLINE_LICENSE_PRIVATE_KEY or JWT_SECRET must be configured for offline license signing',
            );
        }

        try {
            const secretSeed = jwtSecret.padEnd(32, '0').slice(0, 32);
            const pkcs8Der = Buffer.concat([
                Buffer.from('302e020100300506032b657004220420', 'hex'),
                Buffer.from(secretSeed, 'utf8'),
            ]);

            const privateKey = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });
            const publicKey = createPublicKey(privateKey);
            MobileSyncService.signingKeyPair = { privateKey, publicKey };
            return MobileSyncService.signingKeyPair;
        } catch (err: any) {
            throw new InternalServerErrorException(
                `Failed to derive Ed25519 keypair from JWT_SECRET: ${err?.message}`,
            );
        }
    }

    constructor(private readonly supabase: SupabaseService) { }

    getKeyId(): string {
        return MobileSyncService.keyId;
    }

    getPublicKeyPem(): string {
        return MobileSyncService.getSigningKeyPair().publicKey.export({ type: 'spki', format: 'pem' }).toString();
    }

    async touchDeviceActivity(tenantId: string, userId: string, acknowledgedSequence?: number, deviceIdOrToken?: string) {
        try {
            const updatePayload: Record<string, any> = {
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            if (typeof acknowledgedSequence === 'number' && acknowledgedSequence >= 0) {
                updatePayload.last_synced_sequence = acknowledgedSequence;
            }

            let query = this.supabase.adminClient
                .from('device_tokens')
                .update(updatePayload)
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('is_active', true);

            if (deviceIdOrToken) {
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(deviceIdOrToken)) {
                    query = query.eq('id', deviceIdOrToken);
                } else {
                    query = query.eq('token', deviceIdOrToken);
                }
            } else {
                // If device is not explicitly specified, touch only the most recently seen active device
                // for this user so we never erroneously mark stale devices as synced
                const { data: activeDevice } = await this.supabase.adminClient
                    .from('device_tokens')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .order('last_seen_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (!activeDevice?.id) {
                    return;
                }
                query = query.eq('id', activeDevice.id);
            }

            await query;
        } catch (err: any) {
            this.logger.warn(`Failed to update device activity timestamp: ${err?.message}`);
        }
    }

    private async getTeacherClassIds(caller: JwtPayload): Promise<string[]> {
        const { data: tRec } = await this.supabase.adminClient
            .from('teachers')
            .select('id')
            .eq('tenant_id', caller.tenantId)
            .eq('user_id', caller.sub)
            .maybeSingle();

        if (!tRec?.id) return [];

        const { data: ctRows } = await this.supabase.adminClient
            .from('class_teachers')
            .select('class_id')
            .eq('tenant_id', caller.tenantId)
            .eq('teacher_id', tRec.id);

        return (ctRows ?? []).map((ct: any) => ct.class_id).filter(Boolean);
    }

    async appendSyncEvent(dto: AppendSyncEventDto, caller: JwtPayload, deviceIdOrToken?: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        assertUuid(dto.clientUuid, 'clientUuid');
        if (dto.entityId) {
            assertUuid(dto.entityId, 'entityId');
        }

        // 1. Enforce payload size limit (<= 64KB in bytes)
        if (dto.payload) {
            const payloadStr = JSON.stringify(dto.payload);
            if (Buffer.byteLength(payloadStr, 'utf8') > 65536) {
                throw new BadRequestException('Sync event payload exceeds maximum allowed size of 64KB');
            }
        }

        // 2. Role-based entity authorization
        const { role, sub } = caller;
        switch (dto.entityType) {
            case 'attendance':
                if (role !== UserRole.TEACHER && role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Only teachers and administrators can append attendance sync events');
                }
                if (role === UserRole.TEACHER) {
                    const classId = dto.payload?.class_id ?? dto.payload?.classId;
                    if (!classId) {
                        throw new BadRequestException('class_id is required for teacher attendance sync events');
                    }
                    const teacherClasses = await this.getTeacherClassIds(caller);
                    if (!teacherClasses.includes(classId)) {
                        throw new ForbiddenException('Teachers can only record attendance for their assigned classes');
                    }
                }
                break;

            case 'homework_submission':
                if (role === UserRole.STUDENT) {
                    const studentId = dto.payload?.student_id ?? dto.payload?.studentId;
                    if (!studentId) {
                        throw new ForbiddenException('student_id is required for student homework submissions');
                    }
                    assertUuid(studentId, 'student_id');

                    // Check caller's student record in this tenant
                    const { data: myStudRec } = await this.supabase.adminClient
                        .from('students')
                        .select('id, user_id')
                        .eq('tenant_id', caller.tenantId)
                        .eq('user_id', sub)
                        .maybeSingle();

                    const matchesCaller = studentId === sub || (myStudRec && studentId === myStudRec.id);
                    if (!matchesCaller) {
                        throw new ForbiddenException(
                            'Students can only record homework submissions on their own behalf; student_id must match caller',
                        );
                    }

                    if (dto.entityId && dto.entityId !== sub && dto.entityId !== myStudRec?.id) {
                        const { data: otherStudent } = await this.supabase.adminClient
                            .from('students')
                            .select('id, user_id')
                            .eq('tenant_id', caller.tenantId)
                            .eq('id', dto.entityId)
                            .maybeSingle();
                        if (otherStudent && otherStudent.user_id !== sub) {
                            throw new ForbiddenException(
                                'Students cannot target another student entity ID for homework submission',
                            );
                        }
                    }
                } else if (role === UserRole.TEACHER) {
                    const classId = dto.payload?.class_id ?? dto.payload?.classId;
                    if (!classId) {
                        throw new BadRequestException('class_id is required for teacher homework sync events');
                    }
                    const teacherClasses = await this.getTeacherClassIds(caller);
                    if (!teacherClasses.includes(classId)) {
                        throw new ForbiddenException('Teachers can only record homework for their assigned classes');
                    }
                } else if (role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Only students, teachers, or administrators can append homework events');
                }
                break;

            case 'chat_message': {
                const senderId = dto.payload?.sender_id ?? dto.payload?.senderId;
                if (!senderId || (senderId !== sub && role !== UserRole.SUPER_ADMIN)) {
                    throw new ForbiddenException('Chat message sender_id is required and must match authenticated caller');
                }
                if (role === UserRole.STUDENT && !dto.payload?.class_id && !dto.payload?.recipient_id && !dto.payload?.recipientId) {
                    throw new ForbiddenException('Student chat messages must target a specific class or recipient');
                }
                break;
            }

            case 'disaster_mode':
                if (role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Only administrators can append disaster mode sync events');
                }
                break;

            case 'entitlement_revocation':
                if (role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Only administrators can append entitlement revocation events');
                }
                break;

            case 'blog_post':
                if (role !== UserRole.TEACHER && role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Only teachers and administrators can append educational blog sync events');
                }
                assertCleanContent(dto.payload?.title, 'Blog title');
                assertCleanContent(dto.payload?.content_markdown ?? dto.payload?.contentMarkdown, 'Blog content');
                break;

            case 'blog_comment':
                assertCleanContent(dto.payload?.content, 'Comment');
                break;
            case 'blog_reaction':
                // Both teachers and students can participate in discourse
                break;

            default:
                throw new BadRequestException(`Unsupported sync entity type: ${String(dto.entityType)}`);
        }

        const client = this.supabase.adminClient;

        // Check whether event was previously ingested with this client UUID (idempotency check)
        const { data: preExistingEvent } = await client
            .from('sync_events')
            .select('id, client_uuid, applied')
            .eq('tenant_id', caller.tenantId)
            .eq('client_uuid', dto.clientUuid)
            .maybeSingle();

        // 3. Atomically append or deduplicate sync event via database function
        const { data, error } = await client.rpc('append_sync_event', {
            p_tenant_id: caller.tenantId,
            p_entity_type: dto.entityType,
            p_entity_id: dto.entityId,
            p_event_type: dto.eventType,
            p_payload: dto.payload ?? {},
            p_client_uuid: dto.clientUuid,
        });

        if (error) {
            this.logger.error(`append_sync_event RPC failed: ${error.message}`);
            if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique_violation')) {
                throw new ConflictException('A conflicting sync event with this client UUID already exists');
            }
            throw new InternalServerErrorException('Sync event ingestion failed');
        }

        // 4. Persist Attendance roll call if new OR if previously unapplied (retry recovery)
        const isAttendanceApplied = preExistingEvent ? preExistingEvent.applied === true : false;
        if (!isAttendanceApplied && dto.entityType === 'attendance' && dto.payload) {
            const classId = dto.payload.class_id ?? dto.payload.classId;
            const studentId = dto.payload.student_id ?? dto.payload.studentId ?? dto.entityId;
            const date = dto.payload.date;
            const status = dto.payload.status ?? 'PRESENT';
            const clientMarkedAt = dto.payload.marked_at ?? dto.payload.markedAt ?? new Date().toISOString();

            if (classId && studentId && date) {
                let resolvedStudentUserId = studentId;
                const { data: sRow } = await client
                    .from('students')
                    .select('user_id')
                    .eq('tenant_id', caller.tenantId)
                    .eq('id', studentId)
                    .maybeSingle();
                if (sRow?.user_id) {
                    resolvedStudentUserId = sRow.user_id;
                }

                const serverNow = Date.now();
                const clientTime = new Date(clientMarkedAt).getTime();
                const clampedTimeMs = Math.min(clientTime, serverNow + 60_000);
                const clampedMarkedAt = new Date(clampedTimeMs).toISOString();

                const { data: existingAtt } = await client
                    .from('attendance')
                    .select('*')
                    .eq('tenant_id', caller.tenantId)
                    .eq('class_id', classId)
                    .eq('student_id', resolvedStudentUserId)
                    .eq('date', date)
                    .maybeSingle();

                if (existingAtt) {
                    const existingMarkedAtMs = existingAtt.marked_at ? new Date(existingAtt.marked_at).getTime() : 0;
                    const clientWins = clampedTimeMs > existingMarkedAtMs;

                    if (existingAtt.status !== status) {
                        const { error: conflictLogErr } = await client.from('attendance_conflicts_log').insert({
                            tenant_id: caller.tenantId,
                            class_id: classId,
                            student_id: resolvedStudentUserId,
                            conflict_date: date,
                            client_state: { status, marked_at: clampedMarkedAt },
                            server_state: { status: existingAtt.status, marked_at: existingAtt.marked_at },
                            resolution: clientWins ? 'CLIENT_WINS' : 'SERVER_WINS',
                            resolved_by: caller.sub,
                        });
                        if (conflictLogErr) {
                            this.logger.warn(`Attendance conflict log write failed: ${conflictLogErr.message}`);
                        }
                    }

                    if (clientWins) {
                        const { error: attUpdateErr } = await client
                            .from('attendance')
                            .update({
                                status,
                                marked_at: clampedMarkedAt,
                                marked_by: caller.sub,
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', existingAtt.id);
                        if (attUpdateErr) {
                            this.logger.error(`Attendance update failed: ${attUpdateErr.message}`);
                            throw new InternalServerErrorException('Attendance record update failed');
                        }
                    }
                } else {
                    const { error: attInsertErr } = await client.from('attendance').insert({
                        tenant_id: caller.tenantId,
                        class_id: classId,
                        student_id: resolvedStudentUserId,
                        date,
                        status,
                        marked_at: clampedMarkedAt,
                        marked_by: caller.sub,
                    });
                    if (attInsertErr) {
                        this.logger.error(`Attendance insert failed: ${attInsertErr.message}`);
                        throw new InternalServerErrorException('Attendance record insert failed');
                    }
                }

                const eventId = data?.id ?? preExistingEvent?.id;
                if (eventId) {
                    const { error: applyErr } = await client
                        .from('sync_events')
                        .update({ applied: true })
                        .eq('id', eventId);
                    if (applyErr) {
                        this.logger.warn(`Failed to mark sync event ${eventId} as applied: ${applyErr.message}`);
                    }
                }
            }
        }

        // 5. Persist Chat message into real chat_messages row so web users see offline mobile messages (P3-S4)
        const isChatApplied = preExistingEvent ? preExistingEvent.applied === true : false;
        if (!isChatApplied && dto.entityType === 'chat_message' && dto.payload) {
            const conversationId = dto.payload.conversation_id ?? dto.payload.conversationId;
            const senderId = dto.payload.sender_id ?? dto.payload.senderId ?? caller.sub;
            const content = dto.payload.content;
            const messageId = dto.entityId || dto.clientUuid;

            if (conversationId && senderId && content) {
                const messageRow: Record<string, any> = {
                    id: messageId,
                    tenant_id: caller.tenantId,
                    conversation_id: conversationId,
                    sender_id: senderId,
                    content: content,
                    created_at: dto.payload.created_at ?? new Date().toISOString(),
                };

                const { error: chatInsertErr } = await client
                    .from('chat_messages')
                    .upsert(messageRow, { onConflict: 'id' });

                if (chatInsertErr) {
                    this.logger.error(`Failed to persist offline chat message: ${chatInsertErr.message}`);
                } else {
                    const eventId = data?.id ?? preExistingEvent?.id;
                    if (eventId) {
                        await client
                            .from('sync_events')
                            .update({ applied: true })
                            .eq('id', eventId);
                    }
                }
            }
        }

        // 6. Materialize offline Blog comments if new
        if (dto.entityType === 'blog_comment' && dto.payload) {
            const commentId = dto.entityId || dto.payload.id || randomUUID();
            const { error: commentErr } = await client
                .from('blog_comments')
                .upsert({
                    id: commentId,
                    tenant_id: caller.tenantId,
                    blog_id: dto.payload.blog_id ?? dto.payload.blogId,
                    parent_id: dto.payload.parent_id ?? dto.payload.parentId ?? null,
                    author_id: caller.sub,
                    author_name: dto.payload.author_name ?? dto.payload.authorName ?? 'EduLanka Member',
                    author_role: caller.role,
                    content: dto.payload.content ?? '',
                    created_at: dto.payload.created_at ?? new Date().toISOString(),
                }, { onConflict: 'id' });

            if (!commentErr) {
                const eventId = data?.id ?? preExistingEvent?.id;
                if (eventId) {
                    await client.from('sync_events').update({ applied: true }).eq('id', eventId);
                }
            }
        }

        // 7. Materialize offline Blog reactions if new
        if (dto.entityType === 'blog_reaction' && dto.payload) {
            const reactionId = dto.entityId || dto.payload.id || randomUUID();
            const { error: reactionErr } = await client
                .from('blog_reactions')
                .upsert({
                    id: reactionId,
                    tenant_id: caller.tenantId,
                    blog_id: dto.payload.blog_id ?? dto.payload.blogId ?? null,
                    comment_id: dto.payload.comment_id ?? dto.payload.commentId ?? null,
                    user_id: caller.sub,
                    reaction_type: dto.payload.reaction_type ?? dto.payload.reactionType ?? 'LIKE',
                }, { onConflict: 'id' });

            if (!reactionErr) {
                const eventId = data?.id ?? preExistingEvent?.id;
                if (eventId) {
                    await client.from('sync_events').update({ applied: true }).eq('id', eventId);
                }
            }
        }

        await this.touchDeviceActivity(caller.tenantId, caller.sub, data?.sequence ? Number(data.sequence) : undefined, deviceIdOrToken);

        return {
            success: true,
            event: data,
        };
    }

    async getSyncEvents(caller: JwtPayload, sinceSequence = 0, limit = 50, deviceIdOrToken?: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const safeLimit = Math.min(Math.max(1, limit), 200);
        const client = this.supabase.adminClient;

        // Check if client since sequence predates 90-day retention purge window
        if (sinceSequence > 0) {
            const { data: oldestEvent } = await client
                .from('sync_events')
                .select('sequence')
                .eq('tenant_id', caller.tenantId)
                .order('sequence', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (oldestEvent) {
                const oldestSeq = Number(oldestEvent.sequence);
                if (sinceSequence < oldestSeq - 1) {
                    throw new GoneException(
                        'Sync sequence predates retention purge window (events older than 90 days purged). Full snapshot resync required.',
                    );
                }
            } else {
                const { data: counter } = await client
                    .from('tenant_sync_counters')
                    .select('last_sequence')
                    .eq('tenant_id', caller.tenantId)
                    .maybeSingle();

                const lastSeq = Number(counter?.last_sequence ?? 0);
                if (lastSeq > 0 && sinceSequence < lastSeq) {
                    throw new GoneException(
                        'Sync sequence predates retention purge window (all past events purged). Full snapshot resync required.',
                    );
                }
            }
        }

        const { data, error } = await client
            .from('sync_events')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .gt('sequence', sinceSequence)
            .order('sequence', { ascending: true })
            .limit(safeLimit + 1);

        if (error) {
            this.logger.error(`Failed to fetch sync events: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve sync events');
        }

        const rows = data ?? [];
        const hasMore = rows.length > safeLimit;
        const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;

        let studentClassId: string | undefined;
        let studentRecordId: string | undefined;
        if (caller.role === UserRole.STUDENT) {
            const { data: sRec } = await client
                .from('students')
                .select('id, class_id')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub)
                .maybeSingle();
            studentClassId = sRec?.class_id;
            studentRecordId = sRec?.id;
        }

        let teacherClassIds: string[] = [];
        if (caller.role === UserRole.TEACHER) {
            teacherClassIds = await this.getTeacherClassIds(caller);
        }

        const filteredEvents = pageRows.filter((event: any) => {
            if (caller.role === UserRole.SUPER_ADMIN || caller.role === UserRole.SCHOOL_ADMIN) {
                return true;
            }

            if (event.entity_type === 'disaster_mode') {
                return true;
            }

            if (event.entity_type === 'entitlement_revocation') {
                const affectedUserId = event.payload?.user_id ?? event.entity_id;
                return affectedUserId === caller.sub;
            }

            if (caller.role === UserRole.TEACHER) {
                if (event.entity_type === 'attendance' || event.entity_type === 'homework_submission') {
                    const classId = event.payload?.class_id ?? event.payload?.classId;
                    if (classId) {
                        return teacherClassIds.includes(classId);
                    }
                    return true;
                }
                if (event.entity_type === 'chat_message') {
                    const sender = event.payload?.sender_id ?? event.payload?.senderId;
                    const recipient = event.payload?.recipient_id ?? event.payload?.recipientId;
                    const classId = event.payload?.class_id ?? event.payload?.classId;
                    return sender === caller.sub || recipient === caller.sub || (classId && teacherClassIds.includes(classId));
                }
                if (event.entity_type === 'blog_post' || event.entity_type === 'blog_comment' || event.entity_type === 'blog_reaction') {
                    const scope = event.payload?.scope;
                    if (!scope || scope === 'PLATFORM' || scope === 'SCHOOL') return true;
                    const classId = event.payload?.class_id ?? event.payload?.classId;
                    return !classId || teacherClassIds.includes(classId);
                }
                return false;
            }

            if (caller.role === UserRole.STUDENT) {
                if (event.entity_type === 'attendance' || event.entity_type === 'homework_submission') {
                    const studentId = event.payload?.student_id ?? event.payload?.studentId;
                    return (
                        event.entity_id === caller.sub ||
                        studentId === caller.sub ||
                        (studentRecordId && (studentId === studentRecordId || event.entity_id === studentRecordId))
                    );
                }
                if (event.entity_type === 'chat_message') {
                    const sender = event.payload?.sender_id ?? event.payload?.senderId;
                    const recipient = event.payload?.recipient_id ?? event.payload?.recipientId;
                    const classId = event.payload?.class_id ?? event.payload?.classId;
                    return (
                        sender === caller.sub ||
                        recipient === caller.sub ||
                        (classId && studentClassId && classId === studentClassId)
                    );
                }
                if (event.entity_type === 'blog_post' || event.entity_type === 'blog_comment' || event.entity_type === 'blog_reaction') {
                    const scope = event.payload?.scope;
                    if (!scope || scope === 'PLATFORM' || scope === 'SCHOOL') return true;
                    const classId = event.payload?.class_id ?? event.payload?.classId;
                    return !classId || (studentClassId && classId === studentClassId);
                }
                return false;
            }

            if (caller.role === UserRole.PARENT) {
                return false;
            }

            return false;
        });

        const latestSeq = pageRows.length > 0 ? Number(pageRows[pageRows.length - 1].sequence) : sinceSequence;

        await this.touchDeviceActivity(caller.tenantId, caller.sub, latestSeq, deviceIdOrToken);

        return {
            tenantId: caller.tenantId,
            sinceSequence,
            latestSequence: latestSeq,
            hasMore,
            count: filteredEvents.length,
            events: filteredEvents,
        };
    }

    async getOfflineLicense(caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        // 1. Verify user is active
        const { data: user, error: userErr } = await this.supabase.adminClient
            .from('users')
            .select('id, is_active, role, full_name')
            .eq('id', caller.sub)
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

        if (userErr || !user || !user.is_active) {
            throw new ForbiddenException('User is inactive or not found. Cannot issue offline license.');
        }

        // 2. Fetch tenant & subscription plan
        const { data: tenant } = await this.supabase.adminClient
            .from('tenants')
            .select('id, name, plan, status')
            .eq('id', caller.tenantId)
            .maybeSingle();

        if (!tenant || tenant.status !== 'ACTIVE') {
            throw new ForbiddenException('Tenant is not active.');
        }

        const planCode = String(tenant.plan).toUpperCase();
        if (planCode === 'COMMUNITY') {
            throw new ForbiddenException('Community plan does not support offline mode. Upgrade to Starter or Growth.');
        }

        const isGrowthOrAbove = planCode === 'GROWTH' || planCode === 'INSTITUTIONAL';

        // Single source of truth: read retention from public.plans
        let retentionDays = isGrowthOrAbove ? 30 : 7;
        try {
            const { data: planInfo } = await this.supabase.adminClient
                .from('plans')
                .select('offline_retention_days')
                .eq('code', planCode)
                .maybeSingle();

            if (typeof planInfo?.offline_retention_days === 'number' && planInfo.offline_retention_days > 0) {
                retentionDays = planInfo.offline_retention_days;
            }
        } catch {
            // Fallback to plan tier defaults
            retentionDays = isGrowthOrAbove ? 30 : 7;
        }

        const offlineVideoEnabled = isGrowthOrAbove;

        // 3. Centralized deduplicated school policy lookup
        const policy = await getTenantSchoolPolicy(this.supabase, caller.tenantId);

        const nowSec = Math.floor(Date.now() / 1000);
        const validitySec = retentionDays * 24 * 3600;
        const expiresAtSec = nowSec + validitySec;

        const licensePayload = {
            kid: this.getKeyId(),
            sub: caller.sub,
            tenantId: caller.tenantId,
            role: caller.role,
            plan: tenant.plan,
            academicYear: policy?.academic_year || new Date().getFullYear(),
            retentionDays,
            issuedAt: nowSec,
            expiresAt: expiresAtSec,
            offlineVideoEnabled,
        };

        const licenseBuffer = Buffer.from(JSON.stringify(licensePayload));
        const signature = sign(null, licenseBuffer, MobileSyncService.getSigningKeyPair().privateKey).toString('base64url');

        return {
            success: true,
            kid: this.getKeyId(),
            license: licensePayload,
            signature,
            algorithm: 'Ed25519',
            publicKey: this.getPublicKeyPem(),
            issuedAt: new Date(nowSec * 1000).toISOString(),
            expiresAt: new Date(expiresAtSec * 1000).toISOString(),
        };
    }

    async getSnapshot(caller: JwtPayload, deviceIdOrToken?: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const tenantClient = this.supabase.getTenantClient(caller.tenantId);

        // Fetch tenant details
        const { data: tenant } = await this.supabase.adminClient
            .from('tenants')
            .select('id, name, slug, plan, school_type, disaster_mode, disaster_reason, disaster_resume_date')
            .eq('id', caller.tenantId)
            .maybeSingle();

        // Fetch current monotonic sequence counter
        const { data: counter } = await this.supabase.adminClient
            .from('tenant_sync_counters')
            .select('last_sequence')
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

        // Fetch caller user record
        const { data: user } = await tenantClient
            .from('users')
            .select('id, email, full_name, role, is_active')
            .eq('id', caller.sub)
            .maybeSingle();

        // Deduplicated school policy lookup
        const policy = await getTenantSchoolPolicy(this.supabase, caller.tenantId);

        // Fetch active classes
        const { data: classes } = await tenantClient
            .from('classes')
            .select('*')
            .order('grade', { ascending: true });

        // Fetch school-wide circulars
        const { data: notices } = await tenantClient
            .from('notices')
            .select('id, title, content_html, scope, priority, attachments, created_at')
            .in('scope', ['UNIVERSAL', 'SCHOOL_WIDE'])
            .order('created_at', { ascending: false })
            .limit(20);

        const latestSequence = Number(counter?.last_sequence ?? 0);
        await this.touchDeviceActivity(caller.tenantId, caller.sub, latestSequence, deviceIdOrToken);

        return {
            snapshotAt: new Date().toISOString(),
            tenantId: caller.tenantId,
            latestSequence,
            tenant,
            policy,
            user,
            classes: classes ?? [],
            notices: notices ?? [],
        };
    }

    async getSyncHealth(caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        const client = this.supabase.adminClient;

        const { data: devices, count: deviceCount } = await client
            .from('device_tokens')
            .select('id, user_id, platform, device_model, last_seen_at, last_synced_sequence, is_active', { count: 'exact' })
            .eq('tenant_id', caller.tenantId)
            .eq('is_active', true);

        const { data: counter } = await client
            .from('tenant_sync_counters')
            .select('last_sequence, updated_at')
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

        const currentSeq = Number(counter?.last_sequence || 0);
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

        const devicesWithHealth = (devices || []).map((d: any) => {
            const syncedSeq = Number(d.last_synced_sequence || 0);
            const sequenceLag = Math.max(0, currentSeq - syncedSeq);
            const isStaleByTime = !d.last_seen_at || d.last_seen_at < threeDaysAgo;
            const hasSequenceLag = sequenceLag > 0;
            return {
                ...d,
                last_synced_sequence: syncedSeq,
                sequenceLag,
                isStale: isStaleByTime || hasSequenceLag,
            };
        });

        const unsyncedDevices = devicesWithHealth.filter((d: any) => d.sequenceLag > 0);
        const staleDevices = devicesWithHealth.filter((d: any) => d.isStale);

        return {
            tenantId: caller.tenantId,
            totalActiveDevices: deviceCount || 0,
            latestSyncSequence: currentSeq,
            lastSequenceAllocatedAt: counter?.updated_at || null,
            unsyncedDevicesCount: unsyncedDevices.length,
            staleDevicesCount: staleDevices.length,
            staleDevices: staleDevices.slice(0, 50),
            devices: devicesWithHealth.slice(0, 50),
        };
    }
}
