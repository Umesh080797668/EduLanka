import type { JwtPayload } from '@edu-lanka/shared-types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AppConfiguration } from '../../../config/configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(configService: ConfigService<AppConfiguration>) {
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
     * The returned value is attached to `request.user`.
     */
    validate(payload: JwtPayload): JwtPayload {
        return payload;
    }
}
