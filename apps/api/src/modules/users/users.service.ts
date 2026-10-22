import { randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { BulkImportUsersDto, BulkImportUserRowDto } from './dto/bulk-import-users.dto';

@Injectable()
export class UsersService {
    private readonly logger = new Logger(UsersService.name);

    constructor(
        private readonly supabase: SupabaseService,
        private readonly redisService: RedisService,
    ) { }

    private guardAdmin(caller: JwtPayload): void {
        if (caller.role !== UserRole.SCHOOL_ADMIN && caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only school admins can manage users');
        }
    }


    async getMe(caller: JwtPayload) {
        const tenantId = caller.tenantId;

        // Route SUPER_ADMIN profile reads dynamically to the correct global table securely bypass the proxy
        if (caller.role === UserRole.SUPER_ADMIN) {
            const { data, error } = await this.supabase.adminClient
                .from('platform_admins')
                .select('*')
                .eq('id', caller.sub)
                .maybeSingle();

            if (error) throw new InternalServerErrorException('Failed to fetch platform profile: ' + error.message);
            if (!data) throw new NotFoundException('Platform admin profile not found for sub ' + caller.sub);
            return data;
        }

        if (caller.role === UserRole.INDEPENDENT_LEARNER || !tenantId) {
            const { data: user, error: userErr } = await this.supabase.adminClient
                .from('users')
                .select('*')
                .eq('id', caller.sub)
                .maybeSingle();

            if (userErr) throw new InternalServerErrorException('Failed to fetch user: ' + userErr.message);
            if (!user) throw new NotFoundException('User profile not found for sub ' + caller.sub);

            const { data: learner } = await this.supabase.adminClient
                .from('independent_learners')
                .select('*')
                .eq('user_id', caller.sub)
                .maybeSingle();

            // Query sponsored grant using learner.id as beneficiary_id.
            // The RLS policy "beneficiary_read_grants" sub-selects independent_learners by JWT sub,
            // so beneficiary_id must be independent_learners.id (not users.id).
            // If no learner profile exists yet, skip the grant query.
            const grant = learner
                ? await this.supabase.adminClient
                    .from('sponsored_grants')
                    .select('*')
                    .eq('beneficiary_type', 'INDEPENDENT_LEARNER')
                    .eq('beneficiary_id', learner.id)
                    .eq('is_active', true)
                    .maybeSingle()
                    .then((r) => r.data)
                : null;

            return {
                ...user,
                independent_learner: learner || null,
                active_grant: grant || null,
            };
        }

        const db = this.supabase.getTenantClient(tenantId);

        const { data, error } = await db
            .from('users')
            .select('*')
            .eq('id', caller.sub)
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to fetch user: ' + error.message);
        if (!data) throw new NotFoundException('User profile not found for sub ' + caller.sub);
        return data;
    }

    async create(dto: CreateUserDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        // Disallow creating SUPER_ADMINs through this tenant endpoint
        if (dto.role === UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Cannot create SUPER_ADMIN users here');
        }

        // 1. Create auth user
        // We use either phone or email for the primary identifier
        const authPayload: any = {
            password: dto.password,
            email_confirm: true,
        };

        if (dto.phoneNumber) {
            authPayload.phone = dto.phoneNumber;
            authPayload.phone_confirm = true;
        }

        if (dto.email) {
            authPayload.email = dto.email;
        }

        const { data: authData, error: authErr } = await this.supabase.adminClient.auth.admin.createUser(authPayload);

        if (authErr || !authData.user) {
            this.logger.error(`Failed to create auth user: ${authErr?.message}`);
            if (authErr?.message.includes('already registered')) {
                throw new ConflictException('A user with that email or phone already exists system-wide.');
            }
            throw new InternalServerErrorException('Failed to create user account');
        }

        const authUid = authData.user.id;

        try {
            // 2. Create tenant profile
            const { data, error } = await db
                .from('users')
                .insert({
                    user_id: authUid,
                    tenant_id: tenantId,
                    email: dto.email ?? null,
                    phone_number: dto.phoneNumber ?? null,
                    full_name: dto.fullName,
                    role: dto.role,
                })
                .select()
                .single();

            if (error) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid);
                if (error.code === '23505') throw new ConflictException('User with that email already exists in tenant');
                throw new InternalServerErrorException('Failed to create user profile');
            }

            return data;
        } catch (err) {
            if (err instanceof InternalServerErrorException || err instanceof ConflictException) {
                await this.supabase.adminClient.auth.admin.deleteUser(authUid).catch(() => null);
            }
            throw err;
        }
    }

    async findAll(caller: JwtPayload, role?: string) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        let query = db.from('users').select('*').order('created_at', { ascending: false });
        if (role) {
            query = query.eq('role', role);
        }

        const { data, error } = await query;
        if (error) throw new InternalServerErrorException('Failed to list users');
        return data ?? [];
    }

    async findAllGlobal(caller: JwtPayload) {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can view the global directory');
        }

        const { data, error } = await this.supabase.adminClient
            .from('users')
            .select(`
                *,
                tenants:tenant_id (
                    id,
                    slug,
                    name,
                    status,
                    sms_approved
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw new InternalServerErrorException('Failed to list global users: ' + error.message);
        return data ?? [];
    }

    async toggleTenantSms(tenantId: string, caller: JwtPayload) {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can toggle SMS features');
        }

        const { data: tenantData } = await this.supabase.adminClient
            .from('tenants')
            .select('sms_approved')
            .eq('id', tenantId)
            .maybeSingle();

        if (!tenantData) throw new NotFoundException('Tenant not found');

        const { data, error } = await this.supabase.adminClient
            .from('tenants')
            .update({ sms_approved: !tenantData.sms_approved })
            .eq('id', tenantId)
            .select()
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to toggle SMS approval');
        return data;
    }

    async findOne(id: string, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data, error } = await db.from('users').select('*').eq('id', id).maybeSingle();
        if (error) throw new InternalServerErrorException('Failed to fetch user');
        if (!data) throw new NotFoundException(`User ${id} not found`);
        return data;
    }

    async update(id: string, dto: UpdateUserDto, caller: JwtPayload) {
        if (id !== caller.sub) {
            this.guardAdmin(caller);
        }

        if (caller.role === UserRole.SUPER_ADMIN && id === caller.sub) {
            const { data, error } = await this.supabase.adminClient
                .from('platform_admins')
                .update({
                    ...(dto.fullName && { full_name: dto.fullName }),
                    ...(dto.phoneNumber !== undefined && { phone_number: dto.phoneNumber }),
                })
                .eq('id', id)
                .select()
                .maybeSingle();

            if (error) throw new InternalServerErrorException('Failed to update platform admin profile: ' + error.message);
            if (!data) throw new NotFoundException(`Platform admin ${id} not found`);
            return data;
        }

        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        const { data, error } = await db
            .from('users')
            .update({
                ...(dto.fullName && { full_name: dto.fullName }),
                ...(dto.phoneNumber !== undefined && { phone_number: dto.phoneNumber }),
                ...(dto.avatarUrl !== undefined && { avatar_url: dto.avatarUrl }),
            })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw new InternalServerErrorException('Failed to update user');
        if (!data) throw new NotFoundException(`User ${id} not found`);
        return data;
    }

    async setActivationStatus(id: string, isActive: boolean, caller: JwtPayload, reason?: string) {
        this.guardAdmin(caller);

        let db = this.supabase.getTenantClient(caller.tenantId);

        // Super Admins override RLS logic to manipulate global cross-tenant entities seamlessly
        if (caller.role === UserRole.SUPER_ADMIN) {
            db = this.supabase.adminClient;
        }

        // Check student cap if reactivating an inactive student
        if (isActive) {
            const { data: userToActivate } = await db
                .from('users')
                .select('id, role, tenant_id, is_active')
                .eq('id', id)
                .maybeSingle();

            if (!userToActivate) throw new NotFoundException(`User ${id} not found`);

            if (userToActivate.is_active === false && userToActivate.role === UserRole.STUDENT) {
                const targetTenantId = userToActivate.tenant_id;
                const { data: tenant } = await this.supabase.adminClient
                    .from('tenants')
                    .select('plan')
                    .eq('id', targetTenantId)
                    .maybeSingle();

                if (tenant?.plan === 'COMMUNITY') {
                    const { count, error: countErr } = await this.supabase.adminClient
                        .from('students')
                        .select('id, users!inner(is_active)', { count: 'exact', head: true })
                        .eq('tenant_id', targetTenantId)
                        .eq('users.is_active', true);

                    if (!countErr && (count ?? 0) >= 75) {
                        throw new ForbiddenException(
                            'COMMUNITY tier limit exceeded: Maximum 75 active students allowed. Please upgrade to Starter.',
                        );
                    }
                }
            }
        }

        const { data, error } = await db
            .from('users')
            .update({ is_active: isActive, deactivation_reason: isActive ? null : (reason || null) })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            if (
                error.message?.toLowerCase().includes('limit exceeded') ||
                error.message?.toLowerCase().includes('cap exceeded') ||
                error.message?.toLowerCase().includes('capped at')
            ) {
                throw new ForbiddenException(error.message);
            }
            throw new InternalServerErrorException(`Failed to set user activation to ${isActive}`);
        }
        if (!data) throw new NotFoundException(`User ${id} not found`);

        // Invalidate active cache and revoke sessions if deactivated
        await this.redisService.cacheUserActive(id, isActive, 60);
        if (!isActive) {
            await this.redisService.revokeAllUserRefreshTokens(id);

            // Deactivate device tokens so deactivated users no longer receive disaster pushes
            const { error: dtErr } = await this.supabase.adminClient
                .from('device_tokens')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('user_id', id);
            if (dtErr) {
                this.logger.error(`Failed to deactivate device tokens for user ${id}: ${dtErr.message}`);
            }

            // Target tenant ID is the user's tenant, NOT caller.tenantId (which is system_root for SUPER_ADMIN)
            const targetTenantId = data.tenant_id;

            // ADR-001 / ADR-002: Invalidate offline entitlement on client devices via monotonic sync stream
            const { error: syncErr } = await this.supabase.adminClient.rpc('append_sync_event', {
                p_tenant_id: targetTenantId,
                p_entity_type: 'entitlement_revocation',
                p_entity_id: id,
                p_event_type: 'DELETED',
                p_payload: {
                    user_id: id,
                    reason: reason || 'ACCOUNT_DEACTIVATED',
                    revoked_at: new Date().toISOString(),
                },
                p_client_uuid: randomUUID(),
            });

            if (syncErr) {
                this.logger.error(`Failed to emit entitlement revocation sync event: ${syncErr.message}`);
            }
        }

        // Automatically resolve pending inquiries if the account is being reactivated
        if (isActive) {
            await this.supabase.adminClient
                .from('deactivation_inquiries')
                .update({ status: 'RESOLVED' })
                .eq('user_id', id)
                .eq('status', 'PENDING');
        }

        return data;
    }

    async remove(id: string, caller: JwtPayload) {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only super admins can hard-delete users');
        }

        // Fetch user first to identify target tenant_id before deletion
        const { data: userRow } = await this.supabase.adminClient
            .from('users')
            .select('tenant_id')
            .eq('id', id)
            .maybeSingle();

        const targetTenantId = userRow?.tenant_id || caller.tenantId;
        const db = this.supabase.getTenantClient(targetTenantId);

        const { error, count } = await db
            .from('users')
            .delete({ count: 'exact' })
            .eq('id', id);

        if (error) {
            this.logger.error(`Failed to hard-delete user: ${error.message}`);
            throw new InternalServerErrorException('Failed to hard-delete user');
        }
        if (count === 0) {
            throw new NotFoundException(`User ${id} not found`);
        }

        // Clean up device tokens for removed user
        await this.supabase.adminClient
            .from('device_tokens')
            .delete()
            .eq('user_id', id);

        // Scrub user PII from sync_events (ADR-002) targeting correct tenant
        const { error: scrubErr } = await this.supabase.adminClient.rpc('scrub_user_sync_events_pii', {
            p_tenant_id: targetTenantId,
            p_user_id: id,
        });

        if (scrubErr) {
            this.logger.error(`Failed to scrub user sync events PII: ${scrubErr.message}`);
        }

        return { success: true };
    }

    resolveRole(rawRole: string | undefined, customRoleMapping?: Record<string, string>): UserRole {
        if (!rawRole || !rawRole.trim()) {
            throw new BadRequestException('Role field is required and cannot be empty');
        }

        const trimmed = rawRole.trim();
        const normalized = trimmed.toLowerCase();

        // 1. Check custom tenant role mapping first
        if (customRoleMapping) {
            const mapped = customRoleMapping[trimmed] || customRoleMapping[normalized];
            if (mapped) {
                const upperMapped = mapped.trim().toUpperCase();
                if (Object.values(UserRole).includes(upperMapped as UserRole)) {
                    return upperMapped as UserRole;
                }
            }
        }

        // 2. Standard canonical mapping & known aliases
        switch (normalized) {
            case 'student':
            case 'pupil':
            case 'learner':
                return UserRole.STUDENT;

            case 'teacher':
            case 'instructor':
            case 'faculty':
            case 'educator':
            case 'staff':
                return UserRole.TEACHER;

            case 'parent':
            case 'guardian':
            case 'father':
            case 'mother':
            case 'caregiver':
                return UserRole.PARENT;

            case 'school_admin':
            case 'admin':
            case 'administrator':
            case 'principal':
            case 'vice_principal':
                return UserRole.SCHOOL_ADMIN;

            default:
                throw new BadRequestException(
                    `Invalid or unmapped role: "${rawRole}". Valid roles are STUDENT, TEACHER, PARENT, SCHOOL_ADMIN, or provide a mapping in customRoleMapping.`,
                );
        }
    }

    async bulkImportUsers(dto: BulkImportUsersDto, caller: JwtPayload) {
        this.guardAdmin(caller);
        const tenantId = caller.tenantId;
        const db = this.supabase.getTenantClient(tenantId);

        if (!dto.rows || dto.rows.length === 0) {
            throw new BadRequestException('No user rows provided for import');
        }

        // 1. Validate and resolve all roles upfront
        const validatedRows: Array<{
            row: BulkImportUserRowDto;
            resolvedRole: UserRole;
            index: number;
        }> = [];

        const validationErrors: Array<{ row: number; error: string }> = [];

        for (let i = 0; i < dto.rows.length; i++) {
            const r = dto.rows[i];
            if (!r.fullName || !r.fullName.trim()) {
                validationErrors.push({ row: i + 1, error: 'Full name is required' });
                continue;
            }
            if (!r.email && !r.phoneNumber) {
                validationErrors.push({ row: i + 1, error: 'Either email or phoneNumber is required' });
                continue;
            }

            const rawRole = r.role || r.customRole;
            try {
                const resolvedRole = this.resolveRole(rawRole, dto.customRoleMapping);
                if (resolvedRole === UserRole.SUPER_ADMIN) {
                    validationErrors.push({ row: i + 1, error: 'Cannot create SUPER_ADMIN users via tenant import' });
                    continue;
                }
                validatedRows.push({ row: r, resolvedRole, index: i });
            } catch (err: any) {
                validationErrors.push({ row: i + 1, error: err.message });
            }
        }

        if (validationErrors.length > 0 && validatedRows.length === 0) {
            throw new BadRequestException({
                message: 'All rows in bulk import failed validation',
                errors: validationErrors,
            });
        }

        // 2. Check student cap if importing students on COMMUNITY plan
        const newStudentCount = validatedRows.filter((vr) => vr.resolvedRole === UserRole.STUDENT).length;
        if (newStudentCount > 0) {
            const { data: tenant } = await this.supabase.adminClient
                .from('tenants')
                .select('plan')
                .eq('id', tenantId)
                .maybeSingle();

            if (tenant?.plan === 'COMMUNITY') {
                const { count } = await this.supabase.adminClient
                    .from('students')
                    .select('id, users!inner(is_active)', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('users.is_active', true);

                if ((count ?? 0) + newStudentCount > 75) {
                    throw new ForbiddenException(
                        `COMMUNITY tier limit exceeded: Importing ${newStudentCount} students would exceed the 75 active student cap (current: ${count ?? 0}). Upgrade to Starter.`,
                    );
                }
            }
        }

        // 3. Process each validated row
        const importedUsers: any[] = [];
        const runtimeErrors: Array<{ row: number; error: string }> = [];

        for (const item of validatedRows) {
            const { row, resolvedRole, index } = item;
            try {
                const user = await this.create(
                    {
                        fullName: row.fullName,
                        email: row.email,
                        phoneNumber: row.phoneNumber,
                        password: row.password || randomUUID().slice(0, 12) + 'Aa1!',
                        role: resolvedRole,
                    },
                    caller,
                );

                // Auto-create role-specific profile row if student
                if (resolvedRole === UserRole.STUDENT && user?.id) {
                    try {
                        await db.from('students').insert({
                            tenant_id: tenantId,
                            user_id: user.user_id || user.id,
                            admission_no: row.admissionNo || `ADM-${Date.now().toString().slice(-6)}-${index + 1}`,
                            class_id: row.classId || null,
                        });
                    } catch {
                        // Ignore duplicate or constraint errors on student sub-record
                    }
                }

                importedUsers.push(user);
            } catch (err: any) {
                runtimeErrors.push({ row: index + 1, error: err.message });
            }
        }

        return {
            success: importedUsers.length > 0,
            totalRows: dto.rows.length,
            importedCount: importedUsers.length,
            failedCount: validationErrors.length + runtimeErrors.length,
            importedUsers,
            errors: [...validationErrors, ...runtimeErrors],
        };
    }
}
