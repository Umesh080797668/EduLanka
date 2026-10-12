import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Injectable,
    Logger,
    BadRequestException,
    ForbiddenException,
    InternalServerErrorException,
} from '@nestjs/common';

import { compareSemver, parseSemver } from '../../common/utils/semver.util';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpdateMobileVersionDto } from './dto/mobile.dto';

@Injectable()
export class MobileReleaseService {
    private readonly logger = new Logger(MobileReleaseService.name);

    constructor(private readonly supabase: SupabaseService) {}

    /**
     * Returns mobile app minimum supported version and release metadata (P3-S1).
     */
    async getVersion(platform?: string) {
        const plat = (platform ?? 'android').toLowerCase();

        let { data } = await this.supabase.adminClient
            .from('mobile_app_versions')
            .select('*')
            .eq('platform', plat)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!data && plat !== 'all') {
            const fallback = await this.supabase.adminClient
                .from('mobile_app_versions')
                .select('*')
                .or(`platform.eq.${plat},platform.eq.all`)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            data = fallback.data;
        }

        if (!data) {
            const anyVersion = await this.supabase.adminClient
                .from('mobile_app_versions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            data = anyVersion.data;
        }

        return {
            platform: data?.platform ?? plat,
            minVersion: data?.min_version || '1.0.0',
            latestVersion: data?.latest_version || '1.0.0',
            releaseNotes:
                data?.release_notes ||
                'EduLanka Phase 3 Mobile Release — Offline Sync, Encrypted Video, Paper Hub & Disaster Pack',
            forceUpdate: data?.force_update || false,
        };
    }

    /**
     * Updates mobile app release metadata (P3-S9). Super admin only.
     * Enforces semver parsing and guarantees minVersion <= latestVersion so users are never locked out.
     */
    async updateVersion(caller: JwtPayload, dto: UpdateMobileVersionDto) {
        if (caller.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Super Admin privileges required to update mobile releases');
        }

        const minParsed = parseSemver(dto.minVersion);
        const latestParsed = parseSemver(dto.latestVersion);

        if (!minParsed || !latestParsed) {
            throw new BadRequestException('minVersion and latestVersion must be valid SemVer strings (e.g. 1.0.0)');
        }

        if (compareSemver(dto.minVersion, dto.latestVersion) > 0) {
            throw new BadRequestException(
                `minVersion (${dto.minVersion}) cannot be greater than latestVersion (${dto.latestVersion}) — this would lock out all users`,
            );
        }

        const platform = dto.platform ?? 'android';

        const { data, error } = await this.supabase.adminClient
            .from('mobile_app_versions')
            .upsert(
                {
                    platform,
                    min_version: dto.minVersion,
                    latest_version: dto.latestVersion,
                    release_notes: dto.releaseNotes ?? '',
                    force_update: dto.forceUpdate ?? false,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'platform' },
            )
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to update mobile app version: ${error.message}`);
            throw new InternalServerErrorException('Failed to update mobile app version');
        }

        return {
            success: true,
            version: {
                platform: data.platform,
                minVersion: data.min_version,
                latestVersion: data.latest_version,
                releaseNotes: data.release_notes,
                forceUpdate: data.force_update,
            },
        };
    }
}
