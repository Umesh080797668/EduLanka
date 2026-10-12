import { Injectable, CanActivate, ExecutionContext, HttpException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SupabaseService } from '../../modules/supabase/supabase.service';
import { compareSemver, parseSemver } from '../utils/semver.util';

export const HTTP_STATUS_UPGRADE_REQUIRED = 426;

@Injectable()
export class AppVersionGuard implements CanActivate {
    constructor(private readonly supabase: SupabaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const path = (request as any).originalUrl || request.url || '';

        // Allow version inspection and public key endpoints to bypass
        if (path.includes('/mobile/version') || path.includes('/mobile/public-key')) {
            return true;
        }

        const clientVersionHeader = (
            request.headers['x-client-version'] || request.headers['x-app-version']
        ) as string | undefined;

        if (!clientVersionHeader) {
            // Header is optional for non-mobile or legacy clients
            return true;
        }

        const clientVersion = clientVersionHeader.trim();
        if (!parseSemver(clientVersion)) {
            return true;
        }

        const platformHeader = (
            request.headers['x-client-platform'] as string | undefined
        )?.toLowerCase() || 'android';
        const platform = platformHeader === 'ios' ? 'ios' : 'android';

        // Query minimum version for the platform
        const { data: verRow } = await this.supabase.adminClient
            .from('mobile_app_versions')
            .select('min_version, latest_version, force_update, release_notes')
            .or(`platform.eq.${platform},platform.eq.all`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!verRow || !verRow.min_version) {
            return true;
        }

        try {
            if (compareSemver(clientVersion, verRow.min_version) < 0) {
                throw new HttpException(
                    {
                        statusCode: HTTP_STATUS_UPGRADE_REQUIRED,
                        error: 'Upgrade Required',
                        message: `Mobile client version ${clientVersion} is deprecated. Minimum required version is ${verRow.min_version}.`,
                        minVersion: verRow.min_version,
                        latestVersion: verRow.latest_version,
                        releaseNotes: verRow.release_notes,
                        forceUpdate: true,
                    },
                    HTTP_STATUS_UPGRADE_REQUIRED,
                );
            }
        } catch (err) {
            if (err instanceof HttpException) throw err;
        }

        return true;
    }
}
