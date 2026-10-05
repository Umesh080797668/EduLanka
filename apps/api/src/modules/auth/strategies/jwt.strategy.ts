import type { JwtPayload } from '@edu-lanka/shared-types';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfiguration } from '../../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        configService: ConfigService<AppConfiguration>,
        private readonly authService: AuthService,
        private readonly redisService: RedisService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: any) => {
                    const cookieHeader = request?.headers?.cookie;
                    if (cookieHeader) {
                        const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
                        if (match) return match[1];
                    }
                    return null;
                },
                ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get('jwt.secret', { infer: true }),
        });
    }

    /**
     * Called after token signature is verified.
     * Enforces token type (access only), revocation status, and active user state.
     */
    async validate(payload: JwtPayload): Promise<JwtPayload> {
        // Enforce token type: refresh tokens must never be accepted as access tokens
        if (payload.type && payload.type !== 'access') {
            throw new UnauthorizedException('Invalid token type: expected access token');
        }

        // Check if token was issued prior to a session revocation event (e.g. password change)
        const isRevoked = await this.redisService.isTokenRevoked(payload.sub, payload.iat);
        if (isRevoked) {
            throw new UnauthorizedException('Token has been revoked');
        }

        // Re-check user active status (cached with 60s TTL in Redis)
        const isActive = await this.authService.isUserActive(payload.sub, payload.role);
        if (!isActive) {
            throw new UnauthorizedException('User account is deactivated');
        }

        return payload;
    }
}
