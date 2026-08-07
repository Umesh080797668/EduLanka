import type { JwtPayload } from '@edu-lanka/shared-types';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfiguration } from '../../config/configuration';

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
    ) { }

    /**
     * Validate credentials and issue a JWT token pair.
     *
     * TODO (Phase 1): Replace stub with Supabase auth check.
     */
    async login(email: string, _password: string): Promise<TokenPair> {
        // ── Stub implementation ──────────────────────────────────────────────
        // In Phase 1 this will call Supabase Auth to verify credentials,
        // then fetch the user's role and tenantId from the DB.
        if (!email) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const payload: JwtPayload = {
            sub: 'stub-user-id',
            tenantId: 'stub-tenant-id',
            role: 'SCHOOL_ADMIN' as JwtPayload['role'],
            email,
        };

        const expiresIn = this.configService.get('jwt.expiresIn', { infer: true }) ?? '15m';
        const refreshExpiresIn =
            this.configService.get('jwt.refreshExpiresIn', { infer: true }) ?? '7d';

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, { expiresIn }),
            this.jwtService.signAsync(payload, { expiresIn: refreshExpiresIn }),
        ]);

        return { accessToken, refreshToken, expiresIn };
    }
}
