import type { JwtPayload } from '@edu-lanka/shared-types';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, InternalServerErrorException, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService, assertUuid } from '../supabase/supabase.service';
import type { RegisterDeviceTokenDto } from './dto/mobile.dto';
import type { FcmPushJobPayload } from './fcm.processor';

@Injectable()
export class MobilePushService {
    private readonly logger = new Logger(MobilePushService.name);

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() @InjectQueue('fcm-push') private readonly fcmPushQueue?: Queue<FcmPushJobPayload>,
    ) {}

    /**
     * Registers or updates an FCM device token for the caller.
     */
    async registerDeviceToken(dto: RegisterDeviceTokenDto, caller: JwtPayload) {
        assertUuid(caller.tenantId, 'tenantId');
        assertUuid(caller.sub, 'userId');

        const client = this.supabase.adminClient;

        const { data, error } = await client
            .from('device_tokens')
            .upsert(
                {
                    tenant_id: caller.tenantId,
                    user_id: caller.sub,
                    token: dto.token,
                    platform: dto.platform,
                    device_model: dto.deviceModel ?? null,
                    is_active: true,
                    last_seen_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'token' },
            )
            .select('*')
            .single();

        if (error) {
            this.logger.error(`Failed to register device token: ${error.message}`);
            throw new InternalServerErrorException('Failed to register device token');
        }

        return {
            success: true,
            deviceToken: data,
        };
    }

    /**
     * Enqueue a push notification job into BullMQ.
     */
    async queuePushJob(payload: FcmPushJobPayload) {
        if (!this.fcmPushQueue) {
            this.logger.warn('fcm-push queue is not available in current environment; skipping push dispatch');
            return null;
        }
        return this.fcmPushQueue.add('send-push', payload);
    }
}
