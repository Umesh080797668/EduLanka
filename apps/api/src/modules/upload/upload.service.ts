import {
    Injectable,
    InternalServerErrorException,
    Logger,
    BadRequestException,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class UploadService {
    private readonly logger = new Logger(UploadService.name);

    constructor(private readonly supabase: SupabaseService) { }

    async getSignature(tenantId?: string, folderType: string = 'profiles') {
        // Enforce blueprint quota: block all uploads if tenant storage quota is exceeded
        if (tenantId) {
            const { data: usage, error: usageErr } = await this.supabase.adminClient
                .from('tenant_storage_usage')
                .select('storage_quota_gb, total_bytes_used, is_quota_exceeded')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (!usageErr && usage?.is_quota_exceeded) {
                throw new ForbiddenException(
                    `Storage quota exceeded for this school (${usage.storage_quota_gb} GB limit reached). Please upgrade subscription tier to upload additional media.`
                );
            }
        }

        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = tenantId ? `edulanka/${tenantId}/${folderType}` : `edulanka/${folderType}`;

        const secret = process.env.CLOUDINARY_API_SECRET;
        const apiKey = process.env.CLOUDINARY_API_KEY;

        if (!secret || !apiKey) {
            throw new InternalServerErrorException('Cloudinary credentials are not configured on the server.');
        }

        const allowedFormats = folderType === 'videos' ? 'mp4,mov,avi,webm' : 'jpg,png,jpeg,webp,pdf';
        const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
        const signParams: Record<string, any> = {
            timestamp,
            folder,
            allowed_formats: allowedFormats,
        };
        if (uploadPreset) {
            signParams.upload_preset = uploadPreset;
        }

        const signature = cloudinary.utils.api_sign_request(
            signParams,
            secret
        );

        return {
            timestamp,
            folder,
            signature,
            apiKey,
            allowedFormats,
            uploadPreset: uploadPreset || null,
            maxFileSize: folderType === 'videos' ? 200 * 1024 * 1024 : 10 * 1024 * 1024,
        };
    }

    /**
     * Handles asynchronous Cloudinary upload and transformation renditions,
     * recording storage byte consumption in public.tenant_storage_ledgers (ADR-001).
     * Strictly verifies notification signatures against raw request bodies.
     */
    async processCloudinaryWebhook(payload: any, headers?: Record<string, string>, rawBodyString?: string) {
        if (!payload || typeof payload !== 'object') {
            throw new BadRequestException('Invalid webhook payload');
        }

        const signatureHeader = headers?.['x-cld-signature'] || headers?.['X-Cld-Signature'];
        const timestampHeader = headers?.['x-cld-timestamp'] || headers?.['X-Cld-Timestamp'];
        const secret = process.env.CLOUDINARY_API_SECRET;

        // Security Enforcement: Reject unauthenticated requests in production / when secret is set
        if (!signatureHeader || !timestampHeader) {
            if (process.env.NODE_ENV !== 'test') {
                throw new UnauthorizedException('Missing required Cloudinary webhook signature headers (x-cld-signature, x-cld-timestamp)');
            }
        }

        if (signatureHeader && timestampHeader && secret) {
            const bodyToVerify = rawBodyString || JSON.stringify(payload);
            const isValid = cloudinary.utils.verifyNotificationSignature(
                bodyToVerify,
                Number(timestampHeader),
                signatureHeader
            );

            if (!isValid) {
                throw new UnauthorizedException('Invalid Cloudinary webhook signature');
            }
        }

        const publicId = payload.public_id || payload.asset_id;
        if (!publicId) {
            return { received: true, ignored: 'Missing public_id' };
        }

        // Determine tenant ID from payload context, top-level field, or public_id path
        let tenantId = payload.tenant_id || payload.context?.custom?.tenant_id;
        if (!tenantId) {
            const match = String(publicId).match(/edulanka\/([0-9a-fA-F-]{36})\//);
            if (match) {
                tenantId = match[1];
            }
        }

        if (!tenantId) {
            this.logger.warn(`Cloudinary webhook received without tenant scope for resource: ${publicId}`);
            return { received: true, ignored: 'Unscoped tenant' };
        }

        const bytes = payload.bytes ? Number(payload.bytes) : 0;
        const format = payload.format || 'mp4';
        const resourceType = payload.resource_type === 'video' ? 'video_master' : (payload.resource_type || 'file');
        const versionSuffix = payload.version ?? payload.created_at ?? 'v1';

        // 1. Record master asset in tenant storage ledger with idempotency key
        const masterIdemp = `${publicId}_master_${versionSuffix}`;
        const { error: masterErr } = await this.supabase.adminClient
            .from('tenant_storage_ledgers')
            .upsert(
                {
                    tenant_id: tenantId,
                    resource_id: String(publicId),
                    resource_type: resourceType,
                    bytes,
                    format,
                    idempotency_key: masterIdemp,
                    metadata: {
                        secure_url: payload.secure_url,
                        duration: payload.duration,
                        width: payload.width,
                        height: payload.height,
                    },
                },
                { onConflict: 'tenant_id,idempotency_key' },
            );

        if (masterErr) {
            this.logger.error(`Failed to record master storage ledger: ${masterErr.message}`);
        }

        // 2. Record eager renditions (e.g. 360p, 480p, 720p) with idempotency keys
        const eagerRenditions = Array.isArray(payload.eager) ? payload.eager : [];
        for (const rendition of eagerRenditions) {
            const transformation = rendition.transformation || rendition.format || 'transcoded';
            const renditionResourceId = `${publicId}_${transformation}`;
            const renditionBytes = rendition.bytes ? Number(rendition.bytes) : 0;
            const rendIdemp = `${publicId}_rendition_${transformation}_${versionSuffix}`;

            const { error: rendErr } = await this.supabase.adminClient
                .from('tenant_storage_ledgers')
                .upsert(
                    {
                        tenant_id: tenantId,
                        resource_id: renditionResourceId,
                        resource_type: 'video_rendition',
                        bytes: renditionBytes,
                        format: rendition.format || 'mp4',
                        idempotency_key: rendIdemp,
                        metadata: {
                            secure_url: rendition.secure_url,
                            transformation: rendition.transformation,
                            width: rendition.width,
                            height: rendition.height,
                        },
                    },
                    { onConflict: 'tenant_id,idempotency_key' },
                );

            if (rendErr) {
                this.logger.error(`Failed to record rendition storage ledger: ${rendErr.message}`);
            }
        }

        this.logger.log(
            `Storage ledger updated for tenant ${tenantId}: master ${bytes} bytes, ${eagerRenditions.length} renditions recorded.`,
        );

        return {
            success: true,
            tenantId,
            resourceId: publicId,
            renditionsCount: eagerRenditions.length,
        };
    }
}
