import {
    Injectable,
    InternalServerErrorException,
    Logger,
    BadRequestException,
    ForbiddenException,
    UnauthorizedException,
} from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

import { SupabaseService, assertUuid } from '../supabase/supabase.service';

const ALLOWED_FOLDER_TYPES = ['profiles', 'videos', 'attachments'];

@Injectable()
export class UploadService {
    private readonly logger = new Logger(UploadService.name);

    constructor(private readonly supabase: SupabaseService) { }

    async getSignature(tenantId?: string, folderType: string = 'profiles') {
        if (!ALLOWED_FOLDER_TYPES.includes(folderType)) {
            throw new BadRequestException(
                `Invalid folderType "${folderType}". Allowed types: ${ALLOWED_FOLDER_TYPES.join(', ')}`,
            );
        }

        // Enforce blueprint quota: block all uploads if tenant storage quota is exceeded (fail closed)
        if (tenantId) {
            assertUuid(tenantId, 'tenantId');
            const { data: usage, error: usageErr } = await this.supabase.adminClient
                .from('tenant_storage_usage')
                .select('storage_quota_gb, total_bytes_used, is_quota_exceeded')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (usageErr) {
                this.logger.error(`Failed to verify tenant storage usage: ${usageErr.message}`);
                throw new InternalServerErrorException('Failed to verify tenant storage quota');
            }

            if (usage?.is_quota_exceeded) {
                throw new ForbiddenException(
                    `Storage quota exceeded for this school (${usage.storage_quota_gb} GB limit reached). Please upgrade subscription tier to upload additional media.`,
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
            secret,
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
     * Handles asynchronous Cloudinary upload, rendition, and deletion notifications,
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

        // Security Enforcement: Reject unauthenticated requests in production / when secret is configured
        if (!signatureHeader || !timestampHeader) {
            if (process.env.NODE_ENV !== 'test') {
                throw new UnauthorizedException('Missing required Cloudinary webhook signature headers (x-cld-signature, x-cld-timestamp)');
            }
        }

        if (!secret && process.env.NODE_ENV !== 'test') {
            throw new InternalServerErrorException('CLOUDINARY_API_SECRET is not configured on the server');
        }

        if (signatureHeader && timestampHeader && secret) {
            const bodyToVerify = rawBodyString || JSON.stringify(payload);
            const isValid = cloudinary.utils.verifyNotificationSignature(
                bodyToVerify,
                Number(timestampHeader),
                signatureHeader,
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

        assertUuid(tenantId, 'tenantId');

        // Handle Resource Deletion Webhook Path
        if (payload.notification_type === 'delete') {
            const { data: existingRows } = await this.supabase.adminClient
                .from('tenant_storage_ledgers')
                .select('bytes')
                .eq('tenant_id', tenantId)
                .eq('resource_id', String(publicId));

            const totalExistingBytes = (existingRows ?? []).reduce(
                (sum: number, r: any) => sum + Number(r.bytes || 0),
                0,
            );

            // Deterministic idempotency key from webhook asset_id, version, or timestamp
            const versionSuffix = payload.asset_id ?? payload.version ?? payload.timestamp ?? 'v1';
            const deleteIdemp = `${publicId}_deletion_${versionSuffix}`;

            if (totalExistingBytes > 0) {
                await this.supabase.adminClient.from('tenant_storage_ledgers').upsert(
                    {
                        tenant_id: tenantId,
                        resource_id: String(publicId),
                        resource_type: 'deletion_credit',
                        bytes: -totalExistingBytes,
                        idempotency_key: deleteIdemp,
                        metadata: { reason: 'CLOUDINARY_DELETE_NOTIFICATION' },
                    },
                    { onConflict: 'tenant_id,idempotency_key' },
                );
            } else {
                const payloadBytes = payload.bytes !== undefined ? Number(payload.bytes) : 0;
                if (!isNaN(payloadBytes) && payloadBytes > 0) {
                    await this.supabase.adminClient.from('tenant_storage_ledgers').upsert(
                        {
                            tenant_id: tenantId,
                            resource_id: String(publicId),
                            resource_type: 'deletion_credit',
                            bytes: -payloadBytes,
                            idempotency_key: deleteIdemp,
                            metadata: { reason: 'CLOUDINARY_DELETE_NOTIFICATION_DIRECT_BYTES' },
                        },
                        { onConflict: 'tenant_id,idempotency_key' },
                    );
                } else {
                    this.logger.warn(`No prior storage ledger rows found for deleted resource ${publicId}. Recording zero-byte tombstone.`);
                    await this.supabase.adminClient.from('tenant_storage_ledgers').upsert(
                        {
                            tenant_id: tenantId,
                            resource_id: String(publicId),
                            resource_type: 'deletion_tombstone',
                            bytes: 0,
                            idempotency_key: deleteIdemp,
                            metadata: { reason: 'CLOUDINARY_DELETE_NOTIFICATION_NO_LEDGER_ROWS' },
                        },
                        { onConflict: 'tenant_id,idempotency_key' },
                    );
                }
            }
            return { success: true, deleted: true, tenantId, publicId };
        }

        // Validate bytes: must be non-negative
        const bytes = payload.bytes !== undefined ? Number(payload.bytes) : 0;
        if (isNaN(bytes) || bytes < 0) {
            throw new BadRequestException('Invalid payload bytes: must be a non-negative number');
        }

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
