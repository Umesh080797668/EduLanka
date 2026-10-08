import { randomUUID } from 'crypto';

import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

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
                    tenant_id: slug,
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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

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

        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

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

        const { data, error } = await db
            .from('users')
            .update({ is_active: isActive, deactivation_reason: isActive ? null : (reason || null) })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw new InternalServerErrorException(`Failed to set user activation to ${isActive}`);
        if (!data) throw new NotFoundException(`User ${id} not found`);

        // Invalidate active cache and revoke sessions if deactivated
        await this.redisService.cacheUserActive(id, isActive, 60);
        if (!isActive) {
            await this.redisService.revokeAllUserRefreshTokens(id);
            // ADR-001 / ADR-002: Invalidate offline entitlement on client devices via monotonic sync stream
            try {
                await this.supabase.adminClient.rpc('append_sync_event', {
                    p_tenant_id: caller.tenantId,
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
            } catch (syncErr: any) {
                this.logger.warn(`Failed to emit entitlement revocation sync event: ${syncErr.message}`);
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
        const slug = caller.tenantId;
        const db = this.supabase.getTenantClient(slug);

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

        return { success: true };
    }
}
