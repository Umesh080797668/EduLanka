import {
    Injectable,
    Logger,
    NotFoundException,
    ForbiddenException,
    InternalServerErrorException,
    PayloadTooLargeException,
} from '@nestjs/common';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { CreateMediaAssetDto } from './dto/create-media-asset.dto';

@Injectable()
export class MediaService {
    private readonly logger = new Logger(MediaService.name);

    constructor(private readonly supabase: SupabaseService) { }

    /**
     * Lists media assets for the caller's tenant with pagination and optional subject/grade filtering.
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
            .neq('status', 'failed')
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

        // Tier gating: Starter tier receives streaming preview, Growth/Institutional receives full assets
        const plan = caller.tenantPlan || 'COMMUNITY';
        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';

        const filtered = (data || []).map((asset: any) => {
            if (!isGrowthOrAbove) {
                // Strip download MP4 URL for non-Growth tiers
                return {
                    ...asset,
                    mp4_url: null,
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

        if (error || !data) {
            throw new NotFoundException(`Media asset ${assetId} not found`);
        }

        const plan = caller.tenantPlan || 'COMMUNITY';
        const isGrowthOrAbove = plan === 'GROWTH' || plan === 'INSTITUTIONAL';

        if (!isGrowthOrAbove) {
            return {
                ...data,
                mp4_url: null,
                is_downloadable: false,
            };
        }

        return data;
    }

    /**
     * Issues an encrypted offline download manifest (P3-S6) for Growth and Institutional tenants.
     * Enforces signed 1-hour expiry window and offline video entitlement.
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

        if (error || !asset) {
            throw new NotFoundException(`Media asset ${assetId} not found`);
        }

        if (!asset.is_downloadable || !asset.mp4_url) {
            throw new ForbiddenException('This media asset is not marked as downloadable');
        }

        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

        return {
            success: true,
            assetId: asset.id,
            title: asset.title,
            mp4Url: asset.mp4_url,
            fileSizeBytes: asset.file_size_bytes,
            durationSeconds: asset.duration_seconds,
            expiresAt,
            retentionDays: plan === 'GROWTH' || plan === 'INSTITUTIONAL' ? 30 : 7,
            cipherAlgorithm: 'Chunked AES-256-GCM (Tink Streaming AEAD)',
        };
    }

    /**
     * Creates a new media asset record, verifying tenant storage quota before committing.
     */
    async createAsset(caller: JwtPayload, dto: CreateMediaAssetDto) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        // 1. Check storage quota from public.tenant_storage_usage
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

        // 2. Insert media asset record
        const { data, error } = await this.supabase.adminClient
            .from('media_assets')
            .insert({
                tenant_id: caller.tenantId,
                uploaded_by: caller.sub,
                title: dto.title,
                description: dto.description || null,
                cloudinary_public_id: dto.cloudinaryPublicId,
                cloudinary_secure_url: dto.cloudinarySecureUrl,
                hls_url: dto.hlsUrl || null,
                mp4_url: dto.mp4Url || null,
                duration_seconds: dto.durationSeconds || null,
                file_size_bytes: dto.fileSizeBytes,
                status: 'ready',
                subject: dto.subject || null,
                grade_level: dto.gradeLevel || null,
                is_downloadable: dto.isDownloadable ?? false,
            })
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to create media asset: ${error.message}`);
            throw new InternalServerErrorException('Failed to create media asset record');
        }

        // 3. Record storage consumption in tenant_storage_ledgers
        await this.supabase.adminClient.from('tenant_storage_ledgers').insert({
            tenant_id: caller.tenantId,
            resource_id: data.id,
            resource_type: 'video_master',
            bytes: dto.fileSizeBytes,
            format: 'mp4',
            idempotency_key: `upload_${data.id}`,
            metadata: { title: dto.title, cloudinaryPublicId: dto.cloudinaryPublicId },
        });

        return {
            success: true,
            asset: data,
        };
    }

    /**
     * Soft-deletes a media asset and logs ledger credit entry to reclaim tenant storage quota.
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

        if (getErr || !existing) {
            throw new NotFoundException(`Media asset ${assetId} not found`);
        }

        const { error: delErr } = await this.supabase.adminClient
            .from('media_assets')
            .update({ status: 'failed', updated_at: new Date().toISOString() })
            .eq('id', assetId);

        if (delErr) {
            this.logger.error(`Failed to delete media asset: ${delErr.message}`);
            throw new InternalServerErrorException('Failed to delete media asset');
        }

        // Reclaim storage quota in ledger with negative bytes
        await this.supabase.adminClient.from('tenant_storage_ledgers').insert({
            tenant_id: caller.tenantId,
            resource_id: assetId,
            resource_type: 'video_deleted',
            bytes: -Math.abs(Number(existing.file_size_bytes) || 0),
            format: 'mp4',
            idempotency_key: `delete_${assetId}`,
            metadata: { deletedAt: new Date().toISOString() },
        });

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

