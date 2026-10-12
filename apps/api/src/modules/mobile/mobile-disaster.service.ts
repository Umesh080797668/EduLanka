import { randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { InjectQueue } from '@nestjs/bullmq';
import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
    ServiceUnavailableException,
    Optional,
} from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { TriggerDisasterPushDto, UpsertEmergencyContactDto, UpsertShelterDto } from './dto/mobile.dto';
import type { FcmPushJobPayload } from './fcm.processor';
import { getTenantSchoolPolicy } from './mobile-policy.util';

@Injectable()
export class MobileDisasterService {
    private readonly logger = new Logger(MobileDisasterService.name);

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() @InjectQueue('fcm-push') private readonly fcmPushQueue?: Queue<FcmPushJobPayload>,
    ) {}

    /**
     * Resolves assigned class IDs for a teacher caller within their tenant.
     */
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

    /**
     * Touch device activity timestamp.
     */
    private async touchDeviceActivity(tenantId: string, userId: string): Promise<void> {
        try {
            await this.supabase.adminClient
                .from('device_tokens')
                .update({
                    last_seen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('tenant_id', tenantId)
                .eq('user_id', userId)
                .eq('is_active', true);
        } catch (err: any) {
            this.logger.warn(`Failed to update device activity timestamp: ${err?.message}`);
        }
    }

    /**
     * Pre-bundles the offline emergency disaster pack with notices, school policies,
     * official emergency contacts, designated evacuation shelters, and homework tasks.
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

        // Fetch school policy (consolidated deduplicated lookup)
        const policy = await getTenantSchoolPolicy(this.supabase, caller.tenantId);

        // Fetch tenant details
        const { data: tenant, error: tenantErr } = await this.supabase.adminClient
            .from('tenants')
            .select('id, name, slug, contact_email, address_city, address_district, disaster_mode, disaster_reason, disaster_resume_date')
            .eq('id', caller.tenantId)
            .maybeSingle();

        if (tenantErr) {
            this.logger.error(`Failed to fetch tenant details for disaster pack: ${tenantErr.message}`);
            throw new InternalServerErrorException('Failed to fetch school tenant details');
        }

        // Fetch active disaster event history if exists
        const { data: activeDisasterEvent } = await this.supabase.adminClient
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

        // 1. Fetch official emergency contacts (excluding tombstoned records)
        const { data: dbContacts } = await this.supabase.adminClient
            .from('school_emergency_contacts')
            .select('id, name, role, phone, is_primary')
            .eq('tenant_id', caller.tenantId)
            .is('deleted_at', null)
            .order('display_order', { ascending: true });

        const nationalEmergencyContacts = [
            { name: 'Disaster Management Centre (DMC)', role: 'National Emergency', phone: '117' },
            { name: 'Police Emergency Hotline', role: 'Security & Rescue', phone: '119' },
            { name: 'Suwa Seriya Ambulance', role: 'Medical Emergency', phone: '1990' },
        ];

        const schoolPhone = (policy?.extra_config)?.phone ?? (policy?.extra_config)?.emergency_phone ?? null;
        const allContacts = [
            ...nationalEmergencyContacts,
            ...(schoolPhone ? [{ name: 'School Administration Office', role: 'School Principal', phone: schoolPhone }] : []),
            ...(dbContacts ?? []),
        ];

        // 2. Fetch designated emergency evacuation shelters (excluding tombstoned records)
        const { data: shelters } = await this.supabase.adminClient
            .from('school_shelters')
            .select('id, name, address, capacity, gps_lat, gps_lng, notes')
            .eq('tenant_id', caller.tenantId)
            .is('deleted_at', null)
            .order('name', { ascending: true });

        // 3. Fetch academic homework tasks from homework_tasks table (excluding tombstoned records)
        let homeworkQuery = this.supabase.adminClient
            .from('homework_tasks')
            .select('id, class_id, teacher_id, title, description, due_date, attachments, created_at')
            .eq('tenant_id', caller.tenantId)
            .is('deleted_at', null);

        if (caller.role === UserRole.STUDENT && callerClassId) {
            homeworkQuery = homeworkQuery.eq('class_id', callerClassId);
        } else if (caller.role === UserRole.TEACHER) {
            const teacherClasses = await this.getTeacherClassIds(caller);
            if (teacherClasses.length > 0) {
                homeworkQuery = homeworkQuery.in('class_id', teacherClasses);
            }
        }
        const { data: homeworkTasks } = await homeworkQuery
            .order('due_date', { ascending: false })
            .limit(50);

        // Dynamic closure duration based on disaster_resume_date
        const resumeDate = tenant?.disaster_resume_date ?? activeDisasterEvent?.expected_resume_date;
        let expectedDuration = 'UNTIL_FURTHER_NOTICE';
        if (resumeDate) {
            const diffDays = Math.max(1, Math.ceil((new Date(resumeDate).getTime() - Date.now()) / (1000 * 3600 * 24)));
            expectedDuration = `${diffDays}_DAYS`;
        }

        await this.touchDeviceActivity(caller.tenantId, caller.sub);

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
            contacts: allContacts,
            shelters: shelters ?? [],
            notices: scopedNotices,
            homework: homeworkTasks ?? [],
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

        // 3. Query emergency contacts strictly from school_emergency_contacts table
        const { data: emergencyContactRows } = await client
            .from('school_emergency_contacts')
            .select('phone')
            .eq('tenant_id', targetTenantId)
            .is('deleted_at', null);

        const emergencyPhones: string[] = (emergencyContactRows ?? [])
            .map((c: any) => c.phone)
            .filter(Boolean);

        // 4. FCM Push Queue Dispatch
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

    /**
     * Retrieves emergency contacts for the tenant (P3-S8).
     */
    async getEmergencyContacts(caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        const { data, error } = await this.supabase.adminClient
            .from('school_emergency_contacts')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .is('deleted_at', null)
            .order('display_order', { ascending: true });

        if (error) {
            throw new InternalServerErrorException('Failed to fetch emergency contacts');
        }
        return data || [];
    }

    /**
     * Updates or inserts emergency contact (P3-S8) with tenant isolation verification.
     */
    async upsertEmergencyContact(caller: JwtPayload, contact: UpsertEmergencyContactDto) {
        assertUuid(caller.tenantId, 'tenantId');

        if (contact.id) {
            assertUuid(contact.id, 'contactId');
            const { data: existing, error: checkError } = await this.supabase.adminClient
                .from('school_emergency_contacts')
                .select('id, tenant_id')
                .eq('id', contact.id)
                .maybeSingle();

            if (checkError) {
                throw new InternalServerErrorException('Failed to verify emergency contact ownership');
            }

            if (existing && existing.tenant_id !== caller.tenantId) {
                throw new ForbiddenException('Cannot overwrite emergency contacts belonging to another institution');
            }
        }

        const { data, error } = await this.supabase.adminClient
            .from('school_emergency_contacts')
            .upsert({
                id: contact.id,
                tenant_id: caller.tenantId,
                name: contact.name,
                role: contact.role,
                phone: contact.phone,
                is_primary: contact.isPrimary ?? false,
                display_order: contact.displayOrder ?? 0,
                deleted_at: null,
                updated_at: new Date().toISOString(),
            })
            .select('*')
            .single();

        if (error) {
            throw new InternalServerErrorException('Failed to save emergency contact');
        }
        return data;
    }

    /**
     * Deletes an emergency contact by setting a tombstone (P3-S8, S2).
     */
    async deleteEmergencyContact(caller: JwtPayload, id: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(id, 'contactId');

        const { data: existing, error: checkError } = await this.supabase.adminClient
            .from('school_emergency_contacts')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (checkError || !existing) {
            throw new NotFoundException(`Emergency contact ${id} not found`);
        }

        if (existing.tenant_id !== caller.tenantId && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Cannot delete emergency contacts belonging to another institution');
        }

        // Set deleted_at tombstone
        const { error } = await this.supabase.adminClient
            .from('school_emergency_contacts')
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('tenant_id', caller.tenantId);

        if (error) {
            throw new InternalServerErrorException('Failed to delete emergency contact');
        }

        return { success: true };
    }

    /**
     * Retrieves designated emergency shelters for tenant (P3-S8).
     */
    async getShelters(caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        const { data, error } = await this.supabase.adminClient
            .from('school_shelters')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (error) {
            throw new InternalServerErrorException('Failed to fetch school shelters');
        }
        return data || [];
    }

    /**
     * Updates or inserts school shelter (P3-S8) with tenant isolation verification.
     */
    async upsertShelter(caller: JwtPayload, shelter: UpsertShelterDto) {
        assertUuid(caller.tenantId, 'tenantId');

        if (shelter.id) {
            assertUuid(shelter.id, 'shelterId');
            const { data: existing, error: checkError } = await this.supabase.adminClient
                .from('school_shelters')
                .select('id, tenant_id')
                .eq('id', shelter.id)
                .maybeSingle();

            if (checkError) {
                throw new InternalServerErrorException('Failed to verify shelter ownership');
            }

            if (existing && existing.tenant_id !== caller.tenantId) {
                throw new ForbiddenException('Cannot overwrite shelters belonging to another institution');
            }
        }

        const { data, error } = await this.supabase.adminClient
            .from('school_shelters')
            .upsert({
                id: shelter.id,
                tenant_id: caller.tenantId,
                name: shelter.name,
                address: shelter.address,
                capacity: shelter.capacity ?? null,
                gps_lat: shelter.gpsLat ?? null,
                gps_lng: shelter.gpsLng ?? null,
                notes: shelter.notes ?? null,
                deleted_at: null,
                updated_at: new Date().toISOString(),
            })
            .select('*')
            .single();

        if (error) {
            throw new InternalServerErrorException('Failed to save shelter record');
        }
        return data;
    }

    /**
     * Deletes a school shelter by setting a tombstone (P3-S8, S2).
     */
    async deleteShelter(caller: JwtPayload, id: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(id, 'shelterId');

        const { data: existing, error: checkError } = await this.supabase.adminClient
            .from('school_shelters')
            .select('id, tenant_id')
            .eq('id', id)
            .maybeSingle();

        if (checkError || !existing) {
            throw new NotFoundException(`Shelter ${id} not found`);
        }

        if (existing.tenant_id !== caller.tenantId && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Cannot delete shelters belonging to another institution');
        }

        // Set deleted_at tombstone
        const { error } = await this.supabase.adminClient
            .from('school_shelters')
            .update({
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .eq('tenant_id', caller.tenantId);

        if (error) {
            throw new InternalServerErrorException('Failed to delete shelter record');
        }

        return { success: true };
    }
}
