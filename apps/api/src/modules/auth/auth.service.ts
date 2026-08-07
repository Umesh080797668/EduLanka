import type { JwtPayload } from '@edu-lanka/shared-types';
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfiguration } from '../../config/configuration';
import { SupabaseService } from '../supabase/supabase.service';

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService<AppConfiguration>,
        private readonly supabaseService: SupabaseService,
    ) { }

    /**
     * Validate credentials and issue a JWT token pair.
     */
    async login(email: string, password: string, tenantId: string): Promise<TokenPair> {
        if (!email || !password || !tenantId) {
            throw new BadRequestException('Email, password, and tenantId are required');
        }

        // 1. Verify credentials globally via Supabase Auth
        const { data: authData, error: authError } = await this.supabaseService.adminClient.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const authUid = authData.user.id;

        // 2. Fetch the tenant slug to know which schema to query
        const { data: tenantData, error: tenantError } = await this.supabaseService.adminClient
            .from('tenants')
            .select('slug, status')
            .eq('id', tenantId)
            .maybeSingle();

        if (tenantError || !tenantData) {
            throw new NotFoundException('Tenant not found');
        }

        if (tenantData.status !== 'ACTIVE') {
            throw new UnauthorizedException('Tenant is not active');
        }

        // 3. Query the tenant's specific `users` table to ensure they belong to this school
        const tenantClient = this.supabaseService.getTenantClient(tenantData.slug);
        const { data: userData, error: userError } = await tenantClient
            .from('users')
            .select('id, role, is_active')
            .eq('auth_uid', authUid)
            .maybeSingle();

        if (userError || !userData) {
            throw new UnauthorizedException('User does not belong to this tenant');
        }

        if (!userData.is_active) {
            throw new UnauthorizedException('User account is deactivated');
        }

        // 4. Issue the application JWT scoped to this tenant
        const payload: JwtPayload = {
            sub: userData.id, // the tenant-specific internal user ID
            tenantId,
            role: userData.role as JwtPayload['role'],
            email,
        };

        const expiresIn = this.configService.get('jwt.expiresIn', { infer: true }) ?? '15m';
        const refreshExpiresIn =
            this.configService.get('jwt.refreshExpiresIn', { infer: true }) ?? '7d';

        // Optionally, you might sign out the Supabase session if you don't intend to use their session management
        // await this.supabaseService.adminClient.auth.signOut();

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, { expiresIn }),
            this.jwtService.signAsync(payload, { expiresIn: refreshExpiresIn }),
        ]);

        return { accessToken, refreshToken, expiresIn };
    }
}
