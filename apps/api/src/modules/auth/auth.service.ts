import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    NotFoundException,
    InternalServerErrorException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

import type { AppConfiguration } from '../../config/configuration';
import { RedisService } from '../redis/redis.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { SignupDto } from './dto/signup.dto';

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}

/** Parse a duration string (e.g. "7d", "15m", "1h") into total seconds */
function parseDurationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 7 * 24 * 3600; // default 7 days
    const value = parseInt(match[1]!, 10);
    switch (match[2]) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return 7 * 24 * 3600;
    }
}

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService<AppConfiguration>,
        private readonly supabaseService: SupabaseService,
        private readonly redisService: RedisService,
    ) { }

    // ── Internal helpers ───────────────────────────────────────────────────────

    private get expiresIn(): string {
        return this.configService.get('jwt.expiresIn', { infer: true }) ?? '15m';
    }

    private get refreshExpiresIn(): string {
        return this.configService.get('jwt.refreshExpiresIn', { infer: true }) ?? '7d';
    }

    private async issueTokenPair(payload: Omit<JwtPayload, 'jti'>): Promise<TokenPair> {
        const accessJti = randomUUID();
        const refreshJti = randomUUID();

        const accessEx = parseDurationToSeconds(this.expiresIn);
        const refreshEx = parseDurationToSeconds(this.refreshExpiresIn);

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync({ ...payload, jti: accessJti }, { expiresIn: accessEx }),
            this.jwtService.signAsync({ ...payload, jti: refreshJti }, { expiresIn: refreshEx }),
        ]);

        const refreshTtl = parseDurationToSeconds(this.refreshExpiresIn);
        await this.redisService.storeRefreshToken(refreshJti, payload.sub, refreshTtl);

        return { accessToken, refreshToken, expiresIn: this.expiresIn };
    }

    private async resolveTenantUser(
        tenantId: string,
        authUid: string,
    ): Promise<{ tenantSlug: string; userId: string; role: UserRole }> {
        const { data: tenantData, error: tenantError } = await this.supabaseService.adminClient
            .from('tenants')
            .select('slug, status')
            .eq('id', tenantId)
            .maybeSingle();

        if (tenantError || !tenantData) throw new NotFoundException('Tenant not found');
        if (tenantData.status !== 'ACTIVE') throw new UnauthorizedException('Tenant is not active');

        const tenantClient = this.supabaseService.getTenantClient(tenantData.slug);
        console.log(`resolveTenantUser QUERYING Schema: tenant_${tenantData.slug}, user_id: ${authUid}`);
        const { data: userData, error: userError } = await tenantClient
            .from('users')
            .select('id, role, is_active')
            .eq('user_id', authUid)
            .maybeSingle();

        console.log(`resolveTenantUser RESULT:`, userData, userError);
        if (userError) console.error("resolveTenantUser DB Error:", userError);
        if (userError || !userData) throw new UnauthorizedException('User does not belong to this tenant');
        if (!userData.is_active) throw new UnauthorizedException('User account is deactivated');

        return { tenantSlug: tenantData.slug, userId: userData.id as string, role: userData.role as UserRole };
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * POST /auth/login
     * Validate credentials via Supabase, confirm tenant membership, issue JWT pair.
     */
    async login(email: string, password: string, tenantId: string): Promise<any> {
        if (!email || !password || !tenantId) {
            throw new BadRequestException('Email, password, and tenantId are required');
        }

        const { data, error } = await this.supabaseService.adminClient.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("signInWithPassword Error:", error.message, error.name, error.status);
            throw new UnauthorizedException('Invalid credentials');
        }
        if (!data.user) throw new UnauthorizedException('Invalid credentials');

        const { userId, role: userRole } = await this.resolveTenantUser(tenantId, data.user.id);

        const tokens = await this.issueTokenPair({ sub: userId, tenantId, role: userRole, email });
        return {
            data: {
                access_token: tokens.accessToken,
                refresh_token: tokens.refreshToken,
                user: {
                    id: userId,
                    role: userRole
                }
            }
        };
    }

    /**
     * POST /auth/signup
     * Create a Supabase Auth user + tenant-schema user row, then issue tokens.
     * Only SCHOOL_ADMIN and SUPER_ADMIN can call this (enforced by RolesGuard on the controller).
     */
    async signup(dto: SignupDto, caller: JwtPayload): Promise<TokenPair> {
        // — ensure caller can only provision within their own tenant unless SUPER_ADMIN
        if (caller.role !== UserRole.SUPER_ADMIN && caller.tenantId !== dto.tenantId) {
            throw new ForbiddenException('Cannot create users in a different tenant');
        }

        // 1. Resolve tenant
        const { data: tenantData, error: tenantError } = await this.supabaseService.adminClient
            .from('tenants')
            .select('slug, status')
            .eq('id', dto.tenantId)
            .maybeSingle();

        if (tenantError || !tenantData) throw new NotFoundException('Tenant not found');
        if (tenantData.status !== 'ACTIVE') throw new UnauthorizedException('Tenant is not active');

        // 2. Create Supabase Auth user
        const { data: created, error: createError } = await this.supabaseService.adminClient.auth.admin.createUser({
            email: dto.email,
            password: dto.password,
            email_confirm: true,
            user_metadata: { full_name: dto.fullName, tenant_id: dto.tenantId },
        });

        if (createError || !created.user) {
            this.logger.error(`Supabase createUser failed: ${createError?.message}`);
            if (createError?.message?.toLowerCase().includes('already')) {
                throw new BadRequestException('An account with this email already exists');
            }
            throw new InternalServerErrorException('Failed to create user account');
        }

        const authUid = created.user.id;

        // 3. Insert into tenant schema users table
        const tenantClient = this.supabaseService.getTenantClient(tenantData.slug);
        const { data: newUser, error: insertError } = await tenantClient
            .from('users')
            .insert({
                user_id: authUid,
                email: dto.email,
                full_name: dto.fullName,
                role: dto.role,
                is_active: true,
            })
            .select('id')
            .single();

        if (insertError || !newUser) {
            // Rollback Supabase auth user to avoid orphans
            await this.supabaseService.adminClient.auth.admin.deleteUser(authUid);
            this.logger.error(`Tenant user insert failed: ${insertError?.message}`);
            throw new InternalServerErrorException('Failed to register user in tenant');
        }

        return this.issueTokenPair({
            sub: newUser.id as string,
            tenantId: dto.tenantId,
            role: dto.role,
            email: dto.email,
        });
    }

    /**
     * POST /auth/forgot-password
     * Trigger Supabase password-reset email. Always returns success to prevent user enumeration.
     */
    async forgotPassword(email: string, tenantId: string): Promise<{ message: string }> {
        const redirectTo = `${this.configService.get('app.publicUrl', { infer: true }) ?? 'http://localhost:3000'}/reset-password?tenantId=${tenantId}`;

        // Fire-and-forget — we intentionally don't surface errors to prevent user enumeration
        const { error } = await this.supabaseService.adminClient.auth.resetPasswordForEmail(email, {
            redirectTo,
        });

        if (error) {
            this.logger.warn(`Password reset email failed for ${email}: ${error.message}`);
        }

        return { message: 'If that email is registered, a password reset link has been sent.' };
    }

    /**
     * POST /auth/reset-password
     * Complete password reset using the access token from the email link.
     */
    async resetPassword(accessToken: string, newPassword: string): Promise<{ message: string }> {
        // Build a Supabase client scoped to the user's session
        const supabaseUrl = this.configService.get('supabase.url', { infer: true })!;
        const supabaseKey = this.configService.get('supabase.serviceRoleKey', { infer: true })!;
        const userClient = createClient(supabaseUrl, supabaseKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Set the session so updateUser acts on behalf of the user
        const { error: sessionError } = await userClient.auth.setSession({
            access_token: accessToken,
            refresh_token: '', // not needed for one-shot update
        });

        if (sessionError) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        const { error: updateError } = await userClient.auth.updateUser({
            password: newPassword,
        });

        if (updateError) {
            throw new BadRequestException(`Password update failed: ${updateError.message}`);
        }

        return { message: 'Password has been reset successfully.' };
    }

    /**
     * POST /auth/refresh
     * Rotate refresh token — revoke old jti, issue new pair.
     */
    async refreshTokens(refreshToken: string): Promise<TokenPair> {
        let payload: JwtPayload;

        try {
            payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
        } catch {
            throw new UnauthorizedException('Invalid or expired refresh token');
        }

        const jti = payload.jti;
        if (!jti) throw new UnauthorizedException('Refresh token has no jti claim');

        const valid = await this.redisService.isRefreshTokenValid(jti);
        if (!valid) {
            throw new UnauthorizedException('Refresh token has been revoked or expired');
        }

        // Rotate: revoke old, issue new
        await this.redisService.revokeRefreshToken(jti);

        return this.issueTokenPair({
            sub: payload.sub,
            tenantId: payload.tenantId,
            role: payload.role,
            email: payload.email,
        });
    }

    /**
     * POST /auth/logout
     * Revoke the refresh token associated with the current session.
     */
    async logout(user: JwtPayload, refreshToken: string): Promise<void> {
        if (!refreshToken) return;

        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
            if (payload.jti) {
                await this.redisService.revokeRefreshToken(payload.jti);
            }
        } catch {
            // Token already expired or invalid — nothing to revoke
            this.logger.debug(`Logout called with invalid refresh token for user ${user.sub}`);
        }
    }
}
