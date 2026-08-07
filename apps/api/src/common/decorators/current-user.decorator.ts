import type { JwtPayload } from '@edu-lanka/shared-types';
import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

/**
 * Extracts the authenticated user from the Fastify request.
 * Populated by JwtAuthGuard after JWT validation.
 *
 * Usage:
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: JwtPayload) { ... }
 */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): JwtPayload => {
        const request = ctx.switchToHttp().getRequest<FastifyRequest>();
        return request.user as JwtPayload; // Guaranteed present: JwtAuthGuard runs first
    },
);
