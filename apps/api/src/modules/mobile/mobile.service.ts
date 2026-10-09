import { createPrivateKey, createPublicKey, KeyObject, sign, randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { InjectQueue } from '@nestjs/bullmq';
import {
    Injectable,
    Logger,
    BadRequestException,
    ForbiddenException,
    ConflictException,
    GoneException,
    ServiceUnavailableException,
    InternalServerErrorException,
    Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService, assertUuid } from '../supabase/supabase.service';

import type { RegisterDeviceTokenDto, AppendSyncEventDto, TriggerDisasterPushDto } from './dto/mobile.dto';
import type { FcmPushJobPayload } from './fcm.processor';

@Injectable()
export class MobileService {
    private readonly logger = new Logger(MobileService.name);

    // Persistent Ed25519 Key Identifier and Keypair
    private static readonly keyId = process.env.OFFLINE_LICENSE_KEY_ID ?? 'edulanka-offline-v1';
    private static signingKeyPair?: { publicKey: KeyObject; privateKey: KeyObject };

    private static getSigningKeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
        if (MobileService.signingKeyPair) {
            return MobileService.signingKeyPair;
        }

        const envKey = process.env.OFFLINE_LICENSE_PRIVATE_KEY;
        if (envKey) {
            try {
                const privateKey = createPrivateKey(envKey.includes('-----BEGIN') ? envKey : Buffer.from(envKey, 'base64'));
                const publicKey = createPublicKey(privateKey);
                MobileService.signingKeyPair = { privateKey, publicKey };
                return MobileService.signingKeyPair;
            } catch (err: any) {
                // fall back to persistent seed
            }
        }

        // Fixed 32-byte PKCS#8 DER header for Ed25519 private key: 302e020100300506032b657004220420 + 32-byte seed
        const secretSeed = (process.env.JWT_SECRET || 'edulanka-offline-signing-secret-key-salt-2026')
            .padEnd(32, '0')
            .slice(0, 32);
        const pkcs8Der = Buffer.concat([
            Buffer.from('302e020100300506032b657004220420', 'hex'),
            Buffer.from(secretSeed, 'utf8'),
        ]);

        const privateKey = createPrivateKey({ key: pkcs8Der, format: 'der', type: 'pkcs8' });
        const publicKey = createPublicKey(privateKey);
        MobileService.signingKeyPair = { privateKey, publicKey };
        return MobileService.signingKeyPair;
    }

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() @InjectQueue('fcm-push') private readonly fcmPushQueue?: Queue<FcmPushJobPayload>,
    ) { }

    getKeyId(): string {
        return MobileService.keyId;
    }

    /**
     * Returns the server's public key (SPKI PEM) for client-side offline signature verification.
     */
    getPublicKeyPem(): string {
        return MobileService.getSigningKeyPair().publicKey.export({ type: 'spki', format: 'pem' }).toString();
    }

    /**
     * Registers or updates an FCM device token for the caller.
     */
    async registerDeviceToken(dto: RegisterDeviceTokenDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

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
                break;

            case 'homework_submission':
                if (role === UserRole.STUDENT) {
                    const studentId = dto.payload?.student_id ?? dto.payload?.studentId;
                    if (!studentId) {
                        throw new ForbiddenException('student_id is required for student homework submissions');
                    }
                    if (studentId !== sub && dto.entityId !== sub) {
                        // Check if studentId matches student record id for caller
                        const { data: studRec } = await this.supabase.adminClient
                            .from('students')
                            .select('id, user_id')
                            .eq('tenant_id', caller.tenantId)
                            .eq('id', studentId)
                            .maybeSingle();

                        if (!studRec || studRec.user_id !== sub) {
                            throw new ForbiddenException(
                                'Students can only record homework submissions on their own behalf; student_id must match caller',
                            );
                        }
                    }
                } else if (role !== UserRole.TEACHER && role !== UserRole.SCHOOL_ADMIN && role !== UserRole.SUPER_ADMIN) {
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

            default:
                throw new BadRequestException(`Unsupported sync entity type: ${String(dto.entityType)}`);
        }

        const client = this.supabase.adminClient;

        // 3. Persist Attendance roll call and audit conflicts in ADR-002 log
        if (dto.entityType === 'attendance' && dto.payload) {
            const classId = dto.payload.class_id ?? dto.payload.classId;
            const studentId = dto.payload.student_id ?? dto.payload.studentId ?? dto.entityId;
            const date = dto.payload.date;
            const status = dto.payload.status ?? 'PRESENT';
            const clientMarkedAt = dto.payload.marked_at ?? dto.payload.markedAt ?? new Date().toISOString();

            // Clamp clock skew to server time (cannot mark attendance in future)
            const now = new Date();
            const clientDate = new Date(clientMarkedAt);
            const clampedMarkedAt = clientDate > now ? now.toISOString() : clientMarkedAt;

            if (classId && studentId && date) {
                const { data: existingAtt } = await client
                    .from('attendance')
                    .select('*')
                    .eq('tenant_id', caller.tenantId)
                    .eq('class_id', classId)
                    .eq('student_id', studentId)
                    .eq('date', date)
                    .maybeSingle();

                if (existingAtt) {
                    if (existingAtt.status !== status) {
                        await client.from('attendance_conflicts_log').insert({
                            tenant_id: caller.tenantId,
                            class_id: classId,
                            student_id: studentId,
                            conflict_date: date,
                            client_state: { status, marked_at: clampedMarkedAt },
                            server_state: { status: existingAtt.status, marked_at: existingAtt.marked_at },
                            resolution: 'CLIENT_WINS',
                            resolved_by: caller.sub,
                        });
                    }

                    await client
                        .from('attendance')
                        .update({
                            status,
                            marked_at: clampedMarkedAt,
                            marked_by: caller.sub,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existingAtt.id);
                } else {
                    await client.from('attendance').insert({
                        tenant_id: caller.tenantId,
                        class_id: classId,
                        student_id: studentId,
                        date,
                        status,
                        marked_at: clampedMarkedAt,
                        marked_by: caller.sub,
                    });
                }
            }
        }

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

            if (oldestEvent && sinceSequence < Number(oldestEvent.sequence)) {
                throw new GoneException(
                    'Sync sequence predates retention purge window (events older than 90 days purged). Full snapshot resync required.',
                );
            }
        }

        // Fetch safeLimit + 1 rows to accurately compute hasMore
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

        // Resolve student's class and teacher's assigned classes from database for precise chat visibility
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
            const { data: tRec } = await client
                .from('teachers')
                .select('id')
                .eq('tenant_id', caller.tenantId)
                .eq('user_id', caller.sub)
                .maybeSingle();
            if (tRec?.id) {
                const { data: ctRows } = await client
                    .from('class_teachers')
                    .select('class_id')
                    .eq('teacher_id', tRec.id);
                teacherClassIds = (ctRows ?? []).map((ct: any) => ct.class_id);
            }
        }

        // Scoped privacy filtering per recipient role
        const filteredEvents = pageRows.filter((event: any) => {
            // System and school admins receive full tenant event stream
            if (caller.role === UserRole.SUPER_ADMIN || caller.role === UserRole.SCHOOL_ADMIN) {
                return true;
            }

            // Universal broadcast events (school closures, emergency announcements)
            if (event.entity_type === 'disaster_mode') {
                return true;
            }

            // Entitlement revocation events: ONLY deliver to affected user (or admins handled above)
            if (event.entity_type === 'entitlement_revocation') {
                const affectedUserId = event.payload?.user_id ?? event.entity_id;
                return affectedUserId === caller.sub;
            }

            // Teachers can see attendance, homework submissions, and messages for their assigned classes or DMs
            if (caller.role === UserRole.TEACHER) {
                if (event.entity_type === 'attendance' || event.entity_type === 'homework_submission') {
                    return true;
                }
                if (event.entity_type === 'chat_message') {
                    const sender = event.payload?.sender_id ?? event.payload?.senderId;
                    const recipient = event.payload?.recipient_id ?? event.payload?.recipientId;
                    const classId = event.payload?.class_id ?? event.payload?.classId;
                    return sender === caller.sub || recipient === caller.sub || (classId && teacherClassIds.includes(classId));
                }
                return false;
            }

            // Students can only see their own attendance/homework records and chats targeted to them or their class
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
                    // Strict class/recipient scoping matching database student class_id
                    return (
                        sender === caller.sub ||
                        recipient === caller.sub ||
                        (classId && studentClassId && classId === studentClassId)
                    );
                }
                return false;
            }

            // Parents receive disaster broadcasts only
            if (caller.role === UserRole.PARENT) {
                return false;
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
     * Issues an asymmetrically signed offline entitlement license record (ADR-001).
     * Tied to the school's plan and academic term (Starter: 7 days, Growth/Institutional: 30 days).
     * Mobile verifies using published Ed25519 public key without holding server secrets.
     */
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

        // 3. Blueprint Entitlement Enforcement:
        // - Community: No offline sync (0 days)
        // - Starter: Offline sync (7 days retention), NO offline video downloads
        // - Growth / Institutional: Full offline sync (30 days retention) + offline video downloads
        const planCode = String(tenant.plan).toUpperCase();
        if (planCode === 'COMMUNITY') {
            throw new ForbiddenException('Community plan does not support offline mode. Upgrade to Starter or Growth.');
        }

        const isGrowthOrAbove = planCode === 'GROWTH' || planCode === 'INSTITUTIONAL';
        const retentionDays = isGrowthOrAbove ? 30 : 7;
        const offlineVideoEnabled = isGrowthOrAbove;

        // 4. Fetch academic policy
        const { data: policy } = await this.supabase.adminClient
            .from('school_policy')
            .select('academic_year')
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

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

        // Asymmetric Ed25519 signing for phone offline verification
        const licenseBuffer = Buffer.from(JSON.stringify(licensePayload));
        const signature = sign(null, licenseBuffer, MobileService.getSigningKeyPair().privateKey).toString('base64url');

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

    /**
     * Full Snapshot Re-hydration for devices offline beyond 90-day retention window.
     */
    async getSnapshot(caller: JwtPayload) {
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

        // Fetch school policy
        const { data: policy } = await tenantClient
            .from('school_policy')
            .select('academic_year, max_students_per_class, default_language')
            .maybeSingle();

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

        return {
            snapshotAt: new Date().toISOString(),
            tenantId: caller.tenantId,
            latestSequence: Number(counter?.last_sequence ?? 0),
            tenant,
            policy,
            user,
            classes: classes ?? [],
            notices: notices ?? [],
        };
    }

    /**
     * Generates and returns the offline Disaster Pack bundle for the school tenant per Blueprint:
     * - contacts (School Principal, DMC 117, Police 119, Suwa Seriya 1990)
     * - circulars / notices (scoped to universal, school-wide, or user's class)
     * - closure status, reason and duration from public.tenants
     * - learning materials / official homework tasks (no student submissions)
     */
    async getDisasterPack(caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const tenantClient = this.supabase.getTenantClient(caller.tenantId);

        // Fetch active notices with scope and content_html
        const { data: notices, error: noticeErr } = await tenantClient
            .from('notices')
            .select('id, title, content_html, scope, target_group_id, priority, attachments, created_at')
            .order('created_at', { ascending: false })
            .limit(30);

        if (noticeErr) {
            this.logger.error(`Failed to fetch notices for disaster pack: ${noticeErr.message}`);
            throw new InternalServerErrorException('Failed to fetch disaster pack notices');
        }

        // Fetch school policy
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
            .select('id, name, slug, contact_email, address_city, address_district, disaster_mode, disaster_reason, disaster_resume_date')
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

        // Scope notices: filter out other classes' notices
        const rawNotices = notices ?? [];
        let callerClassId: string | undefined;
        if (caller.role === UserRole.STUDENT) {
            const { data: sRec } = await tenantClient
                .from('students')
                .select('class_id')
                .eq('user_id', caller.sub)
                .maybeSingle();
            callerClassId = sRec?.class_id;
        }

        const scopedNotices = rawNotices.filter((n: any) => {
            if (n.scope === 'UNIVERSAL' || n.scope === 'SCHOOL_WIDE' || !n.scope) return true;
            if (n.scope === 'CLASS_SPECIFIC' && callerClassId && n.target_group_id === callerClassId) return true;
            if (caller.role === UserRole.SCHOOL_ADMIN || caller.role === UserRole.SUPER_ADMIN) return true;
            return false;
        });

        // Extract learning resources from circular attachments
        const resources: any[] = [];
        for (const n of scopedNotices) {
            if (n.attachments && Array.isArray(n.attachments)) {
                for (const att of n.attachments) {
                    resources.push({
                        noticeId: n.id,
                        noticeTitle: n.title,
                        url: att.url ?? att.secure_url,
                        name: att.name ?? 'Resource Attachment',
                        format: att.format ?? 'pdf',
                    });
                }
            }
        }

        // Filter academic homework circulars (academic priority or learning tasks)
        const academicHomework = scopedNotices.filter((n: any) =>
            n.priority === 'HIGH' || n.title.toLowerCase().includes('homework') || n.title.toLowerCase().includes('assignment')
        );

        // Emergency contacts: correct phone numbers (never emails)
        const schoolPhone = (policy?.extra_config)?.phone ?? (policy?.extra_config)?.emergency_phone ?? '011-2695555';
        const configuredContacts = (policy?.extra_config)?.emergency_contacts ?? [];
        const standardEmergencyContacts = [
            { name: 'Disaster Management Centre (DMC)', role: 'National Emergency', phone: '117' },
            { name: 'Police Emergency Hotline', role: 'Security & Rescue', phone: '119' },
            { name: 'Suwa Seriya Ambulance', role: 'Medical Emergency', phone: '1990' },
            { name: 'School Administration Office', role: 'School Principal', phone: schoolPhone },
            ...configuredContacts,
        ];

        // Dynamic closure duration based on disaster_resume_date
        const resumeDate = tenant?.disaster_resume_date ?? activeDisasterEvent?.expected_resume_date;
        let expectedDuration = 'UNTIL_FURTHER_NOTICE';
        if (resumeDate) {
            const diffDays = Math.max(1, Math.ceil((new Date(resumeDate).getTime() - Date.now()) / (1000 * 3600 * 24)));
            expectedDuration = `${diffDays}_DAYS`;
        }

        return {
            status: 'DISASTER_PACK_READY',
            tenantId: caller.tenantId,
            syncedAt: new Date().toISOString(),
            closure: {
                isActive: Boolean(tenant?.disaster_mode),
                reason: tenant?.disaster_reason ?? activeDisasterEvent?.reason ?? 'EMERGENCY',
                expectedResumeDate: resumeDate ?? null,
                expectedDuration,
            },
            contacts: standardEmergencyContacts,
            notices: scopedNotices,
            homework: academicHomework,
            resources,
        };
    }

    /**
     * Triggers a disaster mode push broadcast, registering a sync event, querying active device tokens,
     * and dispatching a high-priority job to the BullMQ FCM queue with Twilio SMS fallback phone numbers.
     */
    async triggerDisasterPush(dto: TriggerDisasterPushDto, caller: JwtPayload) {
        if (!this.fcmPushQueue) {
            throw new ServiceUnavailableException('FCM Push queue is unavailable');
        }

        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');
        if (dto.schoolTenantId) {
            assertUuid(dto.schoolTenantId, 'schoolTenantId');
        }

        const client = this.supabase.adminClient;

        const targetTenantId =
            caller.role === UserRole.SUPER_ADMIN && dto.schoolTenantId
                ? dto.schoolTenantId
                : caller.tenantId;

        assertUuid(targetTenantId, 'targetTenantId');

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

        // 3. Query emergency contacts strictly from policy extra_config (never blast arbitrary random users)
        const { data: policy } = await client
            .from('school_policy')
            .select('extra_config')
            .eq('tenant_id', targetTenantId)
            .maybeSingle();

        const emergencyContacts = (policy?.extra_config)?.emergency_contacts ?? [];
        const emergencyPhones: string[] = [];
        for (const c of emergencyContacts) {
            if (c.phone) emergencyPhones.push(String(c.phone));
        }

        // 4. FCM Push Queue Dispatch (BullMQ high-priority data message with Twilio SMS fallback)
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
                emergencyPhoneNumbers: emergencyPhones,
            });
        } catch (queueErr: any) {
            this.logger.error(`Failed to enqueue disaster FCM push job: ${queueErr.message}`);
            throw new InternalServerErrorException('Failed to enqueue disaster push job');
        }

        return {
            success: true,
            tenantId: targetTenantId,
            event: syncEvent,
            enqueuedRecipientsCount: registeredTokens.length,
            emergencySmsRecipientsCount: emergencyPhones.length,
            dispatchedAt: new Date().toISOString(),
        };
    }
}
