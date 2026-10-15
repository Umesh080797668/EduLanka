import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
    PayloadTooLargeException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { CreateMediaAssetDto } from './dto/create-media-asset.dto';

export function isAllowedEmbedUrl(urlStr?: string): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        const host = parsed.hostname.toLowerCase();
        return (
            host === 'youtube.com' ||
            host.endsWith('.youtube.com') ||
            host === 'youtu.be' ||
            host === 'vimeo.com' ||
            host.endsWith('.vimeo.com') ||
            host === 'drive.google.com'
        );
    } catch {
        return false;
    }
}

export function isAllowedMediaUrl(urlStr?: string, isEmbed = false): boolean {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'https:') {
            return false;
        }
        const host = parsed.hostname.toLowerCase();
        if (isEmbed) {
            return isAllowedEmbedUrl(urlStr);
        }
        const isProd = process.env['NODE_ENV'] === 'production';
        if (isProd && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
            return false;
        }
        return (
            host === 'res.cloudinary.com' ||
            host.endsWith('.cloudinary.com') ||
            host.endsWith('.supabase.co') ||
            (!isProd && (host === 'localhost' || host === '127.0.0.1'))
        );
    } catch {
        return false;
    }
}

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * Lists media assets for the caller's tenant with pagination and optional subject/grade filtering.
     * Starter/Community tiers only receive external embedded resources.
     */
    async listAssets(
        caller: JwtPayload,
        options: { page?: number; limit?: number; subject?: string; gradeLevel?: number },
    ) {
        assertUuid(caller.tenantId, 'tenantId');
        const page = Math.max(1, options.page || 1);
        const limit = Math.min(Math.max(1, options.limit || 20), 100);
        const offset = (page - 1) * limit;

        const client = this.supabase.adminClient;
        let query = client
            .from('media_assets')
            .select('*', { count: 'exact' })
            .eq('tenant_id', caller.tenantId)
            .in('status', ['ready', 'processing'])
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (options.subject) {
            query = query.eq('subject', options.subject);
        }
        if (options.gradeLevel) {
            query = query.eq('grade_level', options.gradeLevel);
        }

        const { data, count, error } = await query;
        if (error) {
            this.logger.error(`Failed to list media assets: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve media assets');
        }

        const plan = caller.tenantPlan || 'COMMUNITY';
        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';

        const filtered = (data || []).map((asset: any) => {
            const isEmbed = isAllowedEmbedUrl(asset.cloudinary_secure_url);
            if (!isGrowthOrAbove) {
                // Starter and Community tiers: embedded links only, strip direct Cloudinary URLs and downloads
                return {
                    ...asset,
                    mp4_url: null,
                    hls_url: null,
                    cloudinary_secure_url: isEmbed ? asset.cloudinary_secure_url : null,
                    is_downloadable: false,
                };
            }
            return asset;
        });

        return {
            data: filtered,
            total: count || 0,
            page,
            limit,
            hasMore: (count || 0) > offset + limit,
        };
    }

    /**
     * Retrieves a single media asset by ID with tier-gated streaming properties.
     */
    async getAssetById(caller: JwtPayload, assetId: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(assetId, 'assetId');

        const { data, error } = await this.supabase.adminClient
            .from('media_assets')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .eq('id', assetId)
            .maybeSingle();

        if (error || !data || data.status === 'deleted' || data.status === 'failed') {
            throw new NotFoundException(`Media asset ${assetId} not found`);
        }

        const plan = caller.tenantPlan || 'COMMUNITY';
        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';
        const isEmbed = isAllowedEmbedUrl(data.cloudinary_secure_url);

        if (!isGrowthOrAbove) {
            return {
                ...data,
                mp4_url: null,
                hls_url: null,
                cloudinary_secure_url: isEmbed ? data.cloudinary_secure_url : null,
                is_downloadable: false,
            };
        }

        return data;
    }

    /**
     * Issues an encrypted offline download manifest (P3-S6) for Growth and Institutional tenants.
     * Enforces plan-based retention from public.plans and signed 1-hour expiry window.
     */
    async getDownloadManifest(caller: JwtPayload, assetId: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(assetId, 'assetId');

        const plan = caller.tenantPlan || 'COMMUNITY';
        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';
        if (!isGrowthOrAbove) {
            throw new ForbiddenException(
                'Offline video downloads require a Growth or Institutional plan subscription',
            );
        }

        const { data: asset, error } = await this.supabase.adminClient
            .from('media_assets')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .eq('id', assetId)
            .maybeSingle();

        if (error || !asset || asset.status === 'deleted' || asset.status === 'failed') {
            throw new NotFoundException(`Media asset ${assetId} not found`);
        }

        if (!asset.is_downloadable || !asset.mp4_url) {
            throw new ForbiddenException('This media asset is not marked as downloadable');
        }

        // Fetch offline retention from public.plans
        const { data: planInfo } = await this.supabase.adminClient
            .from('plans')
            .select('offline_retention_days')
            .eq('code', plan)
            .maybeSingle();

        const retentionDays = Number(planInfo?.offline_retention_days) || 30;

        // Generate cryptographic expiring token & signed URL
        const expiresTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1-hour validity
        const expiresAt = new Date(expiresTimestamp * 1000).toISOString();
        if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET must be configured in production');
        }
        const secret = process.env.JWT_SECRET || 'edulanka-secret-offline-manifest';
        const signature = createHmac('sha256', secret)
            .update(`${caller.tenantId}:${asset.id}:${caller.sub}:${expiresTimestamp}`)
            .digest('hex');

        let signedMp4Url = asset.mp4_url;
        if (asset.cloudinary_public_id && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            cloudinary.config({
                cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'edulanka',
                api_key: process.env.CLOUDINARY_API_KEY,
                api_secret: process.env.CLOUDINARY_API_SECRET,
                secure: true,
            });
            signedMp4Url = cloudinary.url(asset.cloudinary_public_id, {
                resource_type: 'video',
                sign_url: true,
                type: 'authenticated',
                expires_at: expiresTimestamp,
                format: 'mp4',
            });
        } else {
            signedMp4Url = asset.mp4_url.includes('?')
                ? `${asset.mp4_url}&exp=${expiresTimestamp}&sig=${signature.slice(0, 32)}`
                : `${asset.mp4_url}?exp=${expiresTimestamp}&sig=${signature.slice(0, 32)}`;
        }

        // Record media download telemetry event (P3-S6, P3-S9)
        try {
            await this.supabase.adminClient
                .from('media_download_logs')
                .insert({
                    tenant_id: caller.tenantId,
                    asset_id: asset.id,
                    user_id: caller.sub,
                    file_size_bytes: asset.file_size_bytes || 0,
                });
        } catch (logErr: any) {
            this.logger.warn(`Failed to log media download event: ${logErr?.message}`);
        }

        return {
            success: true,
            assetId: asset.id,
            title: asset.title,
            mp4Url: signedMp4Url,
            fileSizeBytes: asset.file_size_bytes,
            durationSeconds: asset.duration_seconds,
            expiresAt,
            signature,
            retentionDays,
            cipherAlgorithm: 'Chunked AES-256-GCM (Tink Streaming AEAD)',
        };
    }

    /**
     * Creates a new media asset record.
     * Starter/Community tiers only allow external embedded video URLs.
     * Growth/Institutional direct video uploads start in 'processing' status;
     * storage ledger is recorded by Cloudinary webhook to prevent double-counting.
     */
    async createAsset(caller: JwtPayload, dto: CreateMediaAssetDto) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const plan = caller.tenantPlan || 'COMMUNITY';
        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';

        const isExternalEmbed = isAllowedEmbedUrl(dto.cloudinarySecureUrl);

        if (!isGrowthOrAbove && !isExternalEmbed) {
            throw new ForbiddenException(
                'Starter and Community tiers only support embedded external video links. Upgrade to Growth or Institutional for direct video hosting.',
            );
        }

        if (isExternalEmbed && !isAllowedEmbedUrl(dto.cloudinarySecureUrl)) {
            throw new BadRequestException('Invalid embed URL: must be a valid YouTube, Vimeo, or Google Drive link');
        }

        if (dto.cloudinarySecureUrl && !isAllowedMediaUrl(dto.cloudinarySecureUrl, isExternalEmbed)) {
            throw new BadRequestException('cloudinarySecureUrl must be a secure HTTPS URL from an authorized host');
        }
        if (dto.mp4Url && !isAllowedMediaUrl(dto.mp4Url, false)) {
            throw new BadRequestException('mp4Url must be a secure HTTPS URL from an authorized host');
        }
        if (dto.hlsUrl && !isAllowedMediaUrl(dto.hlsUrl, false)) {
            throw new BadRequestException('hlsUrl must be a secure HTTPS URL from an authorized host');
        }

        if (!isExternalEmbed) {
            if (!dto.cloudinaryPublicId || dto.cloudinaryPublicId.startsWith('embed_')) {
                throw new BadRequestException('A valid cloudinaryPublicId is required for direct video hosting');
            }

            // Cross-tenant verification: Ensure public ID starts with the caller's tenant prefix
            const tenantPrefix1 = `edulanka/${caller.tenantId}/`;
            const tenantPrefix2 = `${caller.tenantId}/`;
            if (
                !dto.cloudinaryPublicId.startsWith(tenantPrefix1) &&
                !dto.cloudinaryPublicId.startsWith(tenantPrefix2)
            ) {
                throw new ForbiddenException(
                    `Unauthorized resource: cloudinaryPublicId must start with your tenant directory prefix (${tenantPrefix1})`,
                );
            }

            // Check storage quota from public.tenant_storage_usage before initiating direct upload
            const { data: usage } = await this.supabase.adminClient
                .from('tenant_storage_usage')
                .select('is_quota_exceeded, total_bytes_used, storage_quota_gb')
                .eq('tenant_id', caller.tenantId)
                .maybeSingle();

            if (usage?.is_quota_exceeded) {
                throw new PayloadTooLargeException(
                    `Tenant storage quota of ${usage.storage_quota_gb} GB exceeded. Upgrade plan to upload additional media.`,
                );
            }
        }

        // Insert media asset record: direct videos start in 'processing'; embeds are immediately 'ready'
        const initialStatus = isExternalEmbed ? 'ready' : 'processing';
        const initialBytes = isExternalEmbed ? 0 : (dto.fileSizeBytes || 0);
        const publicId = isExternalEmbed
            ? `embed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
            : dto.cloudinaryPublicId;

        const { data, error } = await this.supabase.adminClient
            .from('media_assets')
            .insert({
                tenant_id: caller.tenantId,
                uploaded_by: caller.sub,
                title: dto.title,
                description: dto.description || null,
                cloudinary_public_id: publicId,
                cloudinary_secure_url: dto.cloudinarySecureUrl,
                hls_url: isExternalEmbed ? null : (dto.hlsUrl || null),
                mp4_url: isExternalEmbed ? null : (dto.mp4Url || null),
                duration_seconds: dto.durationSeconds || null,
                file_size_bytes: initialBytes,
                status: initialStatus,
                subject: dto.subject || null,
                grade_level: dto.gradeLevel || null,
                is_downloadable: isExternalEmbed ? false : (dto.isDownloadable ?? false),
            })
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to create media asset: ${error.message}`);
            throw new InternalServerErrorException('Failed to create media asset record');
        }

        // Note: Storage ledger is recorded when the Cloudinary webhook confirms actual uploaded bytes,
        // preventing double-counting between createAsset and the webhook.

        return {
            success: true,
            asset: data,
        };
    }

    /**
     * Soft-deletes a media asset with teacher ownership enforcement and logs ledger credit entry.
     */
    async deleteAsset(caller: JwtPayload, assetId: string) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(assetId, 'assetId');

        const { data: existing, error: getErr } = await this.supabase.adminClient
            .from('media_assets')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .eq('id', assetId)
            .maybeSingle();

        if (getErr || !existing || existing.status === 'deleted') {
            throw new NotFoundException(`Media asset ${assetId} not found`);
        }

        // Enforce teacher deletion ownership: teachers can only delete their own uploads
        if (caller.role === UserRole.TEACHER && existing.uploaded_by !== caller.sub) {
            throw new ForbiddenException('Teachers are only permitted to delete media resources they uploaded');
        }

        const { error: delErr } = await this.supabase.adminClient
            .from('media_assets')
            .update({
                status: 'deleted',
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', assetId);

        if (delErr) {
            this.logger.error(`Failed to delete media asset: ${delErr.message}`);
            throw new InternalServerErrorException('Failed to delete media asset');
        }

        // Reclaim storage quota in ledger with negative bytes
        if (Number(existing.file_size_bytes) > 0) {
            await this.supabase.adminClient.from('tenant_storage_ledgers').insert({
                tenant_id: caller.tenantId,
                resource_id: assetId,
                resource_type: 'video_deleted',
                bytes: -Math.abs(Number(existing.file_size_bytes)),
                format: 'mp4',
                idempotency_key: `delete_${assetId}`,
                metadata: { deletedAt: new Date().toISOString(), deletedBy: caller.sub },
            });
        }

        return {
            success: true,
            message: `Media asset ${assetId} deleted and quota reclaimed.`,
        };
    }

    /**
     * Retrieves storage usage metrics.
     * Super Admin receives platform-wide breakdown; tenant admins receive their tenant quota.
     */
    async getStorageUsage(caller: JwtPayload) {
        const client = this.supabase.adminClient;
        if (caller.role === UserRole.SUPER_ADMIN) {
            const { data, error } = await client
                .from('tenant_storage_usage')
                .select('*')
                .order('total_bytes_used', { ascending: false });

            if (error) {
                this.logger.error(`Failed to retrieve storage overview: ${error.message}`);
                throw new InternalServerErrorException('Failed to retrieve storage overview');
            }

            return {
                success: true,
                tenants: data || [],
            };
        }

        assertUuid(caller.tenantId, 'tenantId');
        const { data, error } = await client
            .from('tenant_storage_usage')
            .select('*')
            .eq('tenant_id', caller.tenantId)
            .maybeSingle();

        if (error) {
            this.logger.error(`Failed to retrieve tenant storage usage: ${error.message}`);
            throw new InternalServerErrorException('Failed to retrieve tenant storage usage');
        }

        return {
            success: true,
            usage: data || null,
        };
    }
}
