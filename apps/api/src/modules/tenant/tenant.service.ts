import type { JwtPayload, Tenant } from '@edu-lanka/shared-types';
import {
    TenantPlan,
    TenantStatus,
    UserRole,
    SchoolType,
    DisasterReason,
} from '@edu-lanka/shared-types';
import {
    Injectable,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SmsService } from '../sms/sms.service';
import { SupabaseService } from '../supabase/supabase.service';

import type { CreateTenantDto } from './tenant.controller';

/** Shape returned from public.tenants Supabase query */
interface TenantRow {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    school_type: string;
    logo_url: string | null;
    contact_email: string;
    phone_number: string | null;
    address_street: string | null;
    address_city: string | null;
    address_district: string | null;
    address_province: string | null;
    address_postal?: string | null;
    sms_approved: boolean;
    disaster_mode?: boolean;
    disaster_reason?: string | null;
    disaster_resume_date?: string | null;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class TenantService {
    private readonly logger = new Logger(TenantService.name);
    private tenantCache = new Map<string, { tenant: Tenant, expiresAt: number }>();
    private CACHE_TTL_MS = 5 * 60 * 1000;

    constructor(
        private readonly supabase: SupabaseService,
        private readonly auditLogs: AuditLogsService,
        private readonly smsService: SmsService
    ) { }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private rowToTenant(row: TenantRow): Tenant {
        return {
            id: row.id,
            name: row.name,
            slug: row.slug,
            plan: row.plan as TenantPlan,
            status: row.status as TenantStatus,
            schoolType: row.school_type as SchoolType,
            logoUrl: row.logo_url ?? undefined,
            contactEmail: row.contact_email,
            phoneNumber: row.phone_number ?? undefined,
            smsApproved: row.sms_approved ?? false,
            disasterMode: row.disaster_mode ?? false,
            disasterReason: (row.disaster_reason as DisasterReason) ?? undefined,
            disasterResumeDate: row.disaster_resume_date ?? undefined,
            address: row.address_city
                ? {
                    street: row.address_street ?? undefined,
                    city: row.address_city,
                    district: row.address_district ?? '',
                    province: row.address_province ?? '',
                    postalCode: row.address_postal ?? undefined,
                }
                : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    // ── Public methods ────────────────────────────────────────────────────────

    /**
     * POST /api/v1/tenants
     * Inserts into public.tenants and calls create_tenant_schema() RPC.
     * Only SUPER_ADMIN can create tenants.
     */
    async create(dto: CreateTenantDto, caller: JwtPayload): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can provision tenants');
        }

        // 1. Insert registry row (status = PROVISIONING, PRO gets SMS automatically)
        const { data: inserted, error: insertErr } = await this.supabase.adminClient
            .from('tenants')
            .insert({
                name: dto.name,
                slug: dto.slug,
                plan: dto.plan ?? TenantPlan.COMMUNITY,
                status: TenantStatus.PROVISIONING,
                school_type: dto.schoolType,
                contact_email: dto.contactEmail,
                sms_approved: dto.plan === TenantPlan.INSTITUTIONAL ? true : false,
            })
            .select()
            .single();

        if (insertErr) {
            if (insertErr.code === '23505') {
                throw new ConflictException(`Slug "${dto.slug}" is already in use`);
            }
            this.logger.error(`Failed to insert tenant: ${insertErr.message}`);
            throw new InternalServerErrorException('Failed to create tenant');
        }

        // Sprint 7: Schema provisioning is obliterated! Tenants instantly share the natively isolated public schema!
        await this.supabase.adminClient
            .from('tenants')
            .update({ status: TenantStatus.ACTIVE })
            .eq('id', inserted.id);

        await this.auditLogs.logAction({
            tenantId: inserted.id,
            actorId: caller.sub,
            actorRole: caller.role,
            action: 'TENANT_PROVISIONED',
            entityType: 'TENANT',
            entityId: inserted.id,
            newValues: { status: TenantStatus.ACTIVE, plan: inserted.plan }
        });

        this.logger.log(`Created tenant "${dto.slug}" (${inserted.id}) in unified public schema.`);
        return this.rowToTenant({ ...inserted, status: TenantStatus.ACTIVE } as TenantRow);
    }

    /**
     * GET /api/v1/tenants/:id
     * Retrieve a tenant. Users can only access their own tenantId
     * unless they are SUPER_ADMIN.
     */
    async findOneById(id: string, caller: JwtPayload): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN && caller.tenantId !== id) {
            throw new ForbiddenException('Access to this tenant is not permitted');
        }

        const cached = this.tenantCache.get(id);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.tenant;
        }

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) {
            this.logger.error(`Tenant lookup error: ${error.message}`);
            throw new InternalServerErrorException('Tenant lookup failed');
        }

        if (!data) {
            throw new NotFoundException(`Tenant ${id} not found`);
        }

        const tenant = this.rowToTenant(data as TenantRow);
        this.tenantCache.set(id, { tenant, expiresAt: Date.now() + this.CACHE_TTL_MS });
        return tenant;
    }

    /**
     * GET /api/v1/tenants
     * List all tenants — SUPER_ADMIN only.
     */
    async listAll(caller: JwtPayload): Promise<Tenant[]> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can list all tenants');
        }

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            this.logger.error(`Tenant list error: ${error.message}`);
            throw new InternalServerErrorException('Failed to list tenants');
        }

        return (data ?? []).map((row) => this.rowToTenant(row as TenantRow));
    }

    /**
     * GET /api/v1/tenants/stats
     * Get school wide stats (student count, classes count)
     */
    async getStats(caller: JwtPayload): Promise<any> {
        const tenant = await this.findOneById(caller.tenantId, caller);
        const db = this.supabase.getTenantClient(tenant.id);

        const [usersReq, classesReq] = await Promise.all([
            db.from('users').select('*', { count: 'exact', head: true }),
            db.from('classes').select('*', { count: 'exact', head: true })
        ]);

        if (usersReq.error) this.logger.error('usersReq map err: ' + usersReq.error.message);
        if (classesReq.error) this.logger.error('classesReq map err: ' + classesReq.error.message);

        return {
            name: tenant.name,
            schoolName: tenant.name,
            users: usersReq.count || 0,
            classes: classesReq.count || 0,
            policies: 0, // No specific policy table exists right now
            status: tenant.status === TenantStatus.ACTIVE ? 'Healthy' : tenant.status,
            disasterMode: Boolean(tenant.disasterMode),
            disasterReason: (tenant as any).disasterReason || null,
            disasterResumeDate: (tenant as any).disasterResumeDate || null,
        };
    }

    /**
     * PATCH /api/v1/tenants/:id/status
     * Update tenant lifecycle status — SUPER_ADMIN only.
     */
    async updateStatus(
        id: string,
        dto: { status: TenantStatus, deactivationReason?: string },
        caller: JwtPayload,
    ): Promise<Tenant> {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can change tenant status');
        }

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .update({ status: dto.status, deactivation_reason: dto.deactivationReason || null })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            this.logger.error(`Tenant status update error: ${error.message}`);
            throw new InternalServerErrorException('Status update failed');
        }

        if (!data) {
            throw new NotFoundException(`Tenant ${id} not found`);
        }

        // Automatically resolve pending inquiries if the tenant is reactivated
        if (dto.status === TenantStatus.ACTIVE) {
            await this.supabase.adminClient
                .from('deactivation_inquiries')
                .update({ status: 'RESOLVED' })
                .eq('tenant_id', id)
                .eq('status', 'PENDING');
        }

        await this.auditLogs.logAction({
            tenantId: id,
            actorId: caller.sub,
            actorRole: caller.role,
            action: 'TENANT_STATUS_CHANGED',
            entityType: 'TENANT',
            entityId: id,
            newValues: { status: dto.status }
        });

        return this.rowToTenant(data as TenantRow);
    }

    /**
     * POST /api/v1/tenants/disaster-mode/activate
     * Atomically activates Disaster Mode, records in disaster_events history,
     * triggers emergency SMS blast to parents, and audit-logs for all tiers.
     */
    async activateDisasterMode(
        dto: { reason: DisasterReason; details?: string; resumeDate?: string; language?: 'EN' | 'SI' | 'TA' },
        caller: JwtPayload
    ): Promise<{ active: boolean; eventId: string; smsQueued: number }> {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only Administrators can activate Disaster Mode (emergency school closures).');
        }

        const { data: tenant } = await this.supabase.adminClient
            .from('tenants')
            .select('id, name, plan, disaster_mode')
            .eq('id', caller.tenantId)
            .single();

        if (!tenant) throw new NotFoundException('Tenant context unavailable.');

        // 1. Atomically activate via stored procedure to prevent duplicate activation races
        const { data: eventData, error: rpcErr } = await this.supabase.adminClient.rpc('activate_disaster_mode', {
            p_tenant_id: tenant.id,
            p_triggered_by: caller.sub,
            p_reason: dto.reason,
            p_details: dto.details || null,
            p_resume_date: dto.resumeDate ? new Date(dto.resumeDate).toISOString() : null,
        });

        if (rpcErr) {
            if (rpcErr.message?.includes('TENANT_NOT_FOUND')) {
                throw new NotFoundException('Tenant not found.');
            }
            if (rpcErr.code === '23505' || rpcErr.message?.includes('DISASTER_ALREADY_ACTIVE')) {
                throw new ConflictException('Disaster Mode is already active for this school.');
            }
            this.logger.error(`Failed to activate disaster mode: ${rpcErr.message}`);
            throw new InternalServerErrorException('Failed to record disaster event');
        }

        const disasterEvent = eventData;
        const eventId = disasterEvent?.id;

        this.logger.warn(`Disaster Mode ACTIVATED for ${tenant.name} (${dto.reason})!`);

        // 2. Emergency SMS blast for paid tiers (Community tier strictly excluded per blueprint)
        let smsQueued = 0;
        if (tenant.plan !== TenantPlan.COMMUNITY) {
            const { data: parents } = await this.supabase.getTenantClient(tenant.id)
                .from('users')
                .select('phone_number')
                .eq('role', 'PARENT')
                .not('phone_number', 'is', null);

            const phoneNumbers = (parents ?? [])
                .map((p) => p.phone_number)
                .filter((p): p is string => Boolean(p));

            if (phoneNumbers.length > 0) {
                const lang = dto.language || 'EN';
                const reopenDate = dto.resumeDate ? dto.resumeDate.slice(0, 10) : (
                    lang === 'SI' ? 'නැවත දැනුම් දෙන තුරු' :
                    lang === 'TA' ? 'மறு அறிவித்தல் வரை' :
                    'further notice'
                );

                let message = '';
                if (lang === 'SI') {
                    const siReasons: Record<string, string> = {
                        [DisasterReason.FLOOD]: 'ගංවතුර තත්ත්වය',
                        [DisasterReason.CYCLONE]: 'සුළි සුළං අවදානම',
                        [DisasterReason.LANDSLIDE]: 'නායයෑමේ අවදානම',
                        [DisasterReason.CIVIL_PUBLIC_HEALTH]: 'හදිසි මහජන සෞඛ්‍ය/ආරක්ෂක හේතු',
                        [DisasterReason.OTHER]: 'හදිසි ආපදා තත්ත්වය',
                    };
                    const friendlyReason = siReasons[dto.reason] || 'හදිසි ආපදා තත්ත්වය';
                    message = `[හදිසි නිවේදනය] ${tenant.name}: ${friendlyReason} හේතුවෙන් පාසල තාවකාලිකව වසා තැබේ. නැවත ආරම්භය: ${reopenDate}. ආරක්ෂිතව සිටින්න.`;
                } else if (lang === 'TA') {
                    const taReasons: Record<string, string> = {
                        [DisasterReason.FLOOD]: 'வெள்ளப் பெருக்கு',
                        [DisasterReason.CYCLONE]: 'சூறாவளி எச்சரிக்கை',
                        [DisasterReason.LANDSLIDE]: 'மண்சரிவு அபாயம்',
                        [DisasterReason.CIVIL_PUBLIC_HEALTH]: 'பொதுச் சுகாதார அவசரநிலை',
                        [DisasterReason.OTHER]: 'அவசர அனர்த்த நிலைமை',
                    };
                    const friendlyReason = taReasons[dto.reason] || 'அவசர அனர்த்த நிலைமை';
                    message = `[அவசர அறிவித்தல்] ${tenant.name}: ${friendlyReason} காரணமாக பாடசாலை தற்காலிகமாக மூடப்பட்டுள்ளது. மீள ஆரம்பம்: ${reopenDate}. பாதுகாப்பாக இருக்கவும்.`;
                } else {
                    const enReasons: Record<string, string> = {
                        [DisasterReason.FLOOD]: 'Flood conditions',
                        [DisasterReason.CYCLONE]: 'Cyclone alert',
                        [DisasterReason.LANDSLIDE]: 'Landslide warning',
                        [DisasterReason.CIVIL_PUBLIC_HEALTH]: 'Health and safety emergency',
                        [DisasterReason.OTHER]: 'Emergency closure',
                    };
                    const friendlyReason = enReasons[dto.reason] || 'Emergency closure';
                    message = `[EMERGENCY] ${tenant.name}: School closed due to ${friendlyReason}. Expected to reopen on ${reopenDate}. Please stay safe.`;
                }

                const smsResult = await this.smsService.sendBatchSms(
                    phoneNumbers,
                    message,
                    tenant.id,
                    {
                        disasterEventId: eventId,
                        bypassQuota: true,
                        isSafetyCritical: true,
                    }
                );
                smsQueued = smsResult.queuedCount;

                if (smsQueued > 0) {
                    await this.supabase.adminClient
                        .from('disaster_events')
                        .update({ sms_queued_count: smsQueued })
                        .eq('id', eventId);
                }
            }
        }

        // 3. Audit Log activation for ALL tiers (including Community)
        await this.auditLogs.logAction({
            tenantId: tenant.id,
            actorId: caller.sub,
            actorRole: caller.role,
            action: 'DISASTER_MODE_ENGAGED',
            entityType: 'TENANT',
            entityId: tenant.id,
            newValues: {
                disaster_mode: true,
                disaster_reason: dto.reason,
                disaster_event_id: eventId,
                disaster_resume_date: dto.resumeDate || null,
                sms_dispatched: smsQueued,
                bypassed_quotas: true,
            },
        });

        return { active: true, eventId, smsQueued };
    }

    /**
     * POST /api/v1/tenants/disaster-mode/deactivate
     * Atomically deactivates Disaster Mode, archives active event, and audit-logs.
     */
    async deactivateDisasterMode(
        dto: { note?: string },
        caller: JwtPayload
    ): Promise<{ active: boolean }> {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only Administrators can deactivate Disaster Mode (emergency school closures).');
        }

        const { data: tenant } = await this.supabase.adminClient
            .from('tenants')
            .select('id, name, plan, disaster_mode')
            .eq('id', caller.tenantId)
            .single();

        if (!tenant) throw new NotFoundException('Tenant context unavailable.');

        // 1. Atomically deactivate via stored procedure
        const { error: rpcErr } = await this.supabase.adminClient.rpc('deactivate_disaster_mode', {
            p_tenant_id: tenant.id,
            p_deactivated_by: caller.sub,
            p_note: dto.note || null,
        });

        if (rpcErr) {
            if (rpcErr.message?.includes('TENANT_NOT_FOUND')) {
                throw new NotFoundException('Tenant not found.');
            }
            if (rpcErr.message?.includes('DISASTER_NOT_ACTIVE')) {
                throw new ConflictException('Disaster Mode is not currently active for this school.');
            }
            this.logger.error(`Failed to deactivate disaster mode: ${rpcErr.message}`);
            throw new InternalServerErrorException('Failed to deactivate disaster mode');
        }

        this.logger.log(`Disaster Mode DEACTIVATED for ${tenant.name}.`);

        // 2. Audit Log deactivation for ALL tiers
        await this.auditLogs.logAction({
            tenantId: tenant.id,
            actorId: caller.sub,
            actorRole: caller.role,
            action: 'DISASTER_MODE_DISENGAGED',
            entityType: 'TENANT',
            entityId: tenant.id,
            newValues: {
                disaster_mode: false,
                deactivated_by: caller.sub,
                deactivation_note: dto.note || null,
            },
        });

        return { active: false };
    }

    /**
     * GET /api/v1/tenants/disaster-mode/history
     * Retrieves historical disaster event tracking for Phase 5/6 reporting.
     */
    async getDisasterHistory(tenantId: string) {
        const { data, error } = await this.supabase.adminClient
            .from('disaster_events')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('activated_at', { ascending: false });

        if (error) {
            this.logger.error(`Failed to fetch disaster history: ${error.message}`);
            throw new InternalServerErrorException('Failed to fetch disaster history');
        }

        return data ?? [];
    }

    /**
     * POST /api/v1/tenants/disaster-mode
     * Backward-compatible toggle that delegates to atomic activate/deactivate.
     */
    async toggleDisasterMode(
        dto: { reason?: DisasterReason; details?: string; resumeDate?: string; action?: 'activate' | 'deactivate' },
        caller: JwtPayload
    ): Promise<{ active: boolean }> {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only Administrators can activate Disaster Mode (emergency school closures).');
        }

        const { data: tenant } = await this.supabase.adminClient
            .from('tenants')
            .select('id, disaster_mode')
            .eq('id', caller.tenantId)
            .single();

        if (!tenant) throw new NotFoundException('Tenant context unavailable.');

        const shouldActivate = dto.action ? dto.action === 'activate' : !tenant.disaster_mode;

        if (shouldActivate) {
            const reason = dto.reason || DisasterReason.OTHER;
            const res = await this.activateDisasterMode({
                reason,
                details: dto.details,
                resumeDate: dto.resumeDate,
            }, caller);
            return { active: res.active };
        } else {
            return this.deactivateDisasterMode({ note: dto.details }, caller);
        }
    }
}
