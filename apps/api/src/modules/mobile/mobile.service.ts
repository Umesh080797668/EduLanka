import { createHmac, randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { InjectQueue } from '@nestjs/bullmq';
import {
    Injectable,
    Logger,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    InternalServerErrorException,
    Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService } from '../supabase/supabase.service';

import type { RegisterDeviceTokenDto, AppendSyncEventDto, TriggerDisasterPushDto } from './dto/mobile.dto';
import type { FcmPushJobPayload } from './fcm.processor';

@Injectable()
export class MobileService {
    private readonly logger = new Logger(MobileService.name);

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() @InjectQueue('fcm-push') private readonly fcmPushQueue?: Queue<FcmPushJobPayload>,
    ) { }

    /**
     * Registers or updates an FCM device token for the caller.
     */
    async registerDeviceToken(dto: RegisterDeviceTokenDto, caller: JwtPayload) {
        const client = this.supabase.adminClient;

        const { data, error } = await client
            .from('device_tokens')
            .upsert(
                {
                    tenant_id: caller.tenantId,
                    user_id: caller.sub,
                    token: dto.token,
                    platform: dto.platform,
                    device_model: dto.deviceModel ?? null,
                    is_active: true,
                    last_seen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'token' },
            )
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to register device token: ${error.message}`);
            throw new InternalServerErrorException('Failed to register device token');
        }

        return {
            success: true,
            deviceToken: data,
        };
    }

    /**
     * Appends a sync event using the atomic append_sync_event function with role authorization
     * and payload size enforcement (<= 64KB).
     */
    async appendSyncEvent(dto: AppendSyncEventDto, caller: JwtPayload) {
        // 1. Enforce payload size limit (<= 64KB)
        if (dto.payload) {
            const payloadStr = JSON.stringify(dto.payload);
            if (payloadStr.length > 65536) {
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
                break;

            case 'homework_submission':
                if (role === UserRole.STUDENT) {
                    const studentId = dto.payload?.student_id ?? dto.payload?.studentId;
                    if (dto.entityId !== sub && studentId && studentId !== sub) {
                        throw new ForbiddenException('Students can only record homework submissions on their own behalf');
                    }
                } else if (role !== UserRole.TEACHER && role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Only students, teachers, or administrators can append homework events');
                }
                break;

            case 'chat_message': {
                const senderId = dto.payload?.sender_id ?? dto.payload?.senderId;
                if (senderId && senderId !== sub && role !== UserRole.SUPER_ADMIN) {
                    throw new ForbiddenException('Chat message sender must match the authenticated caller');
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

            default:
                throw new BadRequestException(`Unsupported sync entity type: ${String(dto.entityType)}`);
        }

        const client = this.supabase.adminClient;

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

        return {
            success: true,
            event: data,
        };
    }

    /**
     * Retrieves sync events strictly partition-scoped to the caller's tenant,
     * applying per-role filtering and monotonic sequence pagination.
     */
    async getSyncEvents(caller: JwtPayload, sinceSequence = 0, limit = 50) {
        const safeLimit = Math.min(Math.max(1, limit), 200);
        const client = this.supabase.adminClient;

        // Fetch safeLimit + 1 rows to accurately compute hasMore
        const { data, error } = await client
            .from('sync_events')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .gt('sequence', sinceSequence)
            .order('sequence', { ascending: true })
            .limit(safeLimit + 1);

        if (error) {
            this.logger.error(`Failed to query sync_events: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch sync stream');
        }

        const allRows = data ?? [];
        const hasMore = allRows.length > safeLimit;
        const pageRows = hasMore ? allRows.slice(0, safeLimit) : allRows;

        // Apply recipient-scoped privacy filters based on caller role
        const filteredEvents = pageRows.filter((event: any) => {
            // Disaster mode events are universal for all users in the tenant
            if (event.entity_type === 'disaster_mode') return true;

            // Platform and school admins have full visibility of all tenant events
            if (caller.role === UserRole.SUPER_ADMIN || caller.role === UserRole.SCHOOL_ADMIN) {
                return true;
            }

            // Entitlement revocations visible to affected user
            if (event.entity_type === 'entitlement_revocation') {
                return event.entity_id === caller.sub || event.payload?.user_id === caller.sub;
            }

            // Teachers can see attendance, homework submissions, and relevant chat messages
            if (caller.role === UserRole.TEACHER) {
                if (event.entity_type === 'attendance' || event.entity_type === 'homework_submission') {
                    return true;
                }
                if (event.entity_type === 'chat_message') {
                    const sender = event.payload?.sender_id ?? event.payload?.senderId;
                    const recipient = event.payload?.recipient_id ?? event.payload?.recipientId;
                    return !recipient || sender === caller.sub || recipient === caller.sub;
                }
                return false;
            }

            // Students can only see their own attendance/homework records and chats
            if (caller.role === UserRole.STUDENT) {
                if (event.entity_type === 'attendance' || event.entity_type === 'homework_submission') {
                    const studentId = event.payload?.student_id ?? event.payload?.studentId;
                    return event.entity_id === caller.sub || studentId === caller.sub;
                }
                if (event.entity_type === 'chat_message') {
                    const sender = event.payload?.sender_id ?? event.payload?.senderId;
                    const recipient = event.payload?.recipient_id ?? event.payload?.recipientId;
                    return sender === caller.sub || recipient === caller.sub || !recipient;
                }
                return false;
            }

            // Parents receive disaster broadcasts
            if (caller.role === UserRole.PARENT) {
                return event.entity_type === 'disaster_mode';
            }

            return false;
        });

        const latestSeq = pageRows.length > 0 ? Number(pageRows[pageRows.length - 1].sequence) : sinceSequence;

        return {
            tenantId: caller.tenantId,
            sinceSequence,
            latestSequence: latestSeq,
            hasMore,
            count: filteredEvents.length,
            events: filteredEvents,
        };
    }

    /**
     * Issues a cryptographically signed offline entitlement license record (ADR-001).
     * Entitlement validity is tied to the school's plan and academic term (30 days max offline grace).
     */
    async getOfflineLicense(caller: JwtPayload) {
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

        // 3. Fetch academic policy
        const { data: policy } = await this.supabase.adminClient
            .from('school_policy')
            .select('academic_year')
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

        // 4. Calculate license validity (30-day offline grace window)
        const nowSec = Math.floor(Date.now() / 1000);
        const validitySec = 30 * 24 * 3600; // 30 days
        const expiresAtSec = nowSec + validitySec;

        const licensePayload = {
            sub: caller.sub,
            tenantId: caller.tenantId,
            role: caller.role,
            plan: tenant.plan,
            academicYear: policy?.academic_year || new Date().getFullYear(),
            issuedAt: nowSec,
            expiresAt: expiresAtSec,
            offlineVideoEnabled: tenant.plan !== 'COMMUNITY',
        };

        const secret = process.env.JWT_SECRET || 'edulanka_offline_secret_key';
        const signature = createHmac('sha256', secret)
            .update(JSON.stringify(licensePayload))
            .digest('hex');

        return {
            success: true,
            license: licensePayload,
            signature,
            issuedAt: new Date(nowSec * 1000).toISOString(),
            expiresAt: new Date(expiresAtSec * 1000).toISOString(),
        };
    }

    /**
     * Generates and returns the offline Disaster Pack bundle for the school tenant per Blueprint:
     * - contacts (School Principal, Zonal Education Office, DMC 117)
     * - circulars / notices (urgent and active school-wide notices with content_html)
     * - closure status, reason and duration
     * - last 7 days of homework assignments and submissions
     * - last 7 days of learning resources and attachments
     */
    async getDisasterPack(caller: JwtPayload) {
        const tenantClient = this.supabase.getTenantClient(caller.tenantId);

        // Fetch active notices with content_html column
        const { data: notices, error: noticeErr } = await tenantClient
            .from('notices')
            .select('id, title, content_html, priority, attachments, created_at')
            .order('created_at', { ascending: false })
            .limit(30);

        if (noticeErr) {
            this.logger.error(`Failed to fetch notices for disaster pack: ${noticeErr.message}`);
            throw new InternalServerErrorException('Failed to fetch disaster pack notices');
        }

        // Fetch singular school_policy table
        const { data: policy, error: policyErr } = await tenantClient
            .from('school_policy')
            .select('id, academic_year, max_students_per_class, allow_self_enrollment, sms_enabled, default_language, timezone, school_hours_start, school_hours_end, extra_config, updated_at')
            .maybeSingle();

        if (policyErr) {
            this.logger.error(`Failed to fetch school policy for disaster pack: ${policyErr.message}`);
            throw new InternalServerErrorException('Failed to fetch disaster pack policies');
        }

        // Fetch tenant details
        const { data: tenant, error: tenantErr } = await this.supabase
            .adminClient
            .from('tenants')
            .select('id, name, slug, contact_email, address_city, address_district, disaster_mode_enabled, disaster_reason, disaster_activated_at, disaster_expected_resume_date')
            .eq('id', caller.tenantId)
            .maybeSingle();

        if (tenantErr) {
            this.logger.error(`Failed to fetch tenant details for disaster pack: ${tenantErr.message}`);
            throw new InternalServerErrorException('Failed to fetch school tenant details');
        }

        // Fetch active disaster event history if exists
        const { data: activeDisasterEvent } = await this.supabase
            .adminClient
            .from('disaster_events')
            .select('id, reason, details, expected_resume_date, activated_at')
            .eq('tenant_id', caller.tenantId)
            .eq('is_active', true)
            .order('activated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Fetch last 7 days homework events and submissions from sync_events
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { data: homeworkEvents } = await this.supabase
            .adminClient
            .from('sync_events')
            .select('id, entity_type, entity_id, payload, created_at')
            .eq('tenant_id', caller.tenantId)
            .eq('entity_type', 'homework_submission')
            .gte('created_at', sevenDaysAgo)
            .order('sequence', { ascending: false })
            .limit(50);

        // Extract downloadable attachments/resources from circulars within last 7 days
        const rawNotices = notices ?? [];
        const resources: any[] = [];
        for (const n of rawNotices) {
            if (n.attachments && Array.isArray(n.attachments)) {
                for (const att of n.attachments) {
                    resources.push({
                        noticeId: n.id,
                        noticeTitle: n.title,
                        url: att.url ?? att.secure_url,
                        name: att.name ?? att.original_filename ?? 'Attachment',
                        format: att.format ?? 'pdf',
                    });
                }
            }
        }

        const emergencyContacts = [
            { title: 'School Principal', email: tenant?.contact_email ?? 'admin@school.lk' },
            { title: 'Zonal Education Office', phone: '1919' },
            { title: 'Disaster Management Centre', hotline: '117', emergency: true },
        ];

        return {
            tenantId: caller.tenantId,
            schoolName: tenant?.name ?? 'EduLanka School',
            generatedAt: new Date().toISOString(),
            status: 'DISASTER_PACK_READY',
            closure: {
                isDisasterMode: !!(tenant?.disaster_mode_enabled || activeDisasterEvent),
                reason: activeDisasterEvent?.reason ?? tenant?.disaster_reason ?? 'NONE',
                details: activeDisasterEvent?.details ?? null,
                expectedResumeDate: activeDisasterEvent?.expected_resume_date ?? tenant?.disaster_expected_resume_date ?? null,
                activatedAt: activeDisasterEvent?.activated_at ?? tenant?.disaster_activated_at ?? null,
            },
            contacts: emergencyContacts,
            emergencyContacts, // Backward compatibility
            circulars: rawNotices.map((n: any) => ({
                ...n,
                content: n.content_html, // Backward compatibility alias
            })),
            notices: rawNotices.map((n: any) => ({
                ...n,
                content: n.content_html, // Backward compatibility alias
            })),
            homework: homeworkEvents ?? [],
            resources,
            policies: policy ? [policy] : [],
            policy: policy ?? null,
        };
    }

    /**
     * Triggers an emergency Disaster Mode push notification to registered devices in the tenant.
     * Prevents device token leakage, enqueues to BullMQ worker with Twilio SMS fallback.
     */
    async triggerDisasterPush(dto: TriggerDisasterPushDto, caller: JwtPayload) {
        const client = this.supabase.adminClient;
        const targetTenantId =
            caller.role === UserRole.SUPER_ADMIN && dto.schoolTenantId
                ? dto.schoolTenantId
                : caller.tenantId;

        // 1. Record Disaster Event in Sync Event stream
        const clientUuid = randomUUID();
        const payload = {
            type: 'DISASTER_MODE_ACTIVATED',
            tenant_id: targetTenantId,
            reason: dto.reason ?? 'NATURAL_DISASTER',
            expected_duration: dto.expectedDuration ?? '3_DAYS',
            timestamp: Date.now(),
        };

        const { data: syncEvent, error: syncErr } = await client.rpc('append_sync_event', {
            p_tenant_id: targetTenantId,
            p_entity_type: 'disaster_mode',
            p_entity_id: caller.sub,
            p_event_type: 'CREATED',
            p_payload: payload,
            p_client_uuid: clientUuid,
        });

        if (syncErr) {
            this.logger.error(`Failed to append disaster sync event: ${syncErr.message}`);
            throw new InternalServerErrorException('Failed to record disaster event');
        }

        // 2. Query active device tokens registered for this specific tenant
        const { data: tokens, error: tokenErr } = await client
            .from('device_tokens')
            .select('token, platform, user_id')
            .eq('tenant_id', targetTenantId)
            .eq('is_active', true);

        if (tokenErr) {
            this.logger.error(`Failed to fetch device tokens: ${tokenErr.message}`);
            throw new InternalServerErrorException('Failed to query device tokens');
        }

        const registeredTokens = (tokens ?? []).map((t: any) => t.token);

        // 3. FCM Push Queue Dispatch (BullMQ high-priority data message with Twilio SMS fallback)
        if (this.fcmPushQueue) {
            try {
                await this.fcmPushQueue.add('disaster-broadcast', {
                    tenantId: targetTenantId,
                    tokens: registeredTokens,
                    data: {
                        type: 'DISASTER_MODE_ACTIVATED',
                        tenant_id: targetTenantId,
                        reason: dto.reason ?? 'NATURAL_DISASTER',
                        expected_duration: dto.expectedDuration ?? '3_DAYS',
                        timestamp: Date.now().toString(),
                    },
                    isDisasterMode: true,
                    smsFallbackMessage: `[EduLanka Emergency] School disaster mode activated (${dto.reason ?? 'Emergency'}). Offline packs ready.`,
                });
            } catch (queueErr: any) {
                this.logger.error(`Failed to enqueue disaster FCM push job: ${queueErr.message}`);
            }
        }

        this.logger.log(
            `Disaster Mode Triggered for tenant ${targetTenantId}. Active FCM tokens targeted: ${registeredTokens.length}`,
        );

        return {
            success: true,
            syncEvent,
            pushPayload: payload,
            registeredTokensCount: registeredTokens.length,
            dispatchedAt: new Date().toISOString(),
        };
    }
}
