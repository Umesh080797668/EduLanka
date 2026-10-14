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
        if (
            path.includes('/mobile/version') ||
            path.includes('/mobile/public-key') ||
            path.includes('/health') ||
            path.includes('/docs')
        ) {
            return true;
        }

        const clientVersionHeader = (
            request.headers['x-client-version'] || request.headers['x-app-version']
        ) as string | undefined;

        const platformHeader = (
            request.headers['x-client-platform'] as string | undefined
        )?.toLowerCase();

        const isMobileRoute = path.includes('/mobile/');
        const isMobilePlatform = platformHeader === 'android' || platformHeader === 'ios';
        const isMobileClient = isMobilePlatform || isMobileRoute || Boolean(clientVersionHeader);

        // Allow requests from web browsers, cron, or legacy non-mobile clients
        if (!isMobileClient) {
            return true;
        }

        // If client is mobile (via platform header or mobile route), X-Client-Version MUST NOT be omitted
        if (!clientVersionHeader || !clientVersionHeader.trim()) {
            throw new HttpException(
                {
                    statusCode: HTTP_STATUS_UPGRADE_REQUIRED,
                    error: 'Upgrade Required',
                    message: 'Mobile client version header (x-client-version) is required for mobile requests.',
                    forceUpdate: true,
                },
                HTTP_STATUS_UPGRADE_REQUIRED,
            );
        }

        const clientVersion = clientVersionHeader.trim();
        if (!parseSemver(clientVersion)) {
            throw new HttpException(
                {
                    statusCode: HTTP_STATUS_UPGRADE_REQUIRED,
                    error: 'Upgrade Required',
                    message: `Invalid semantic version "${clientVersion}" provided in x-client-version header.`,
                    forceUpdate: true,
                },
                HTTP_STATUS_UPGRADE_REQUIRED,
            );
        }

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

        return true;
    }
}
