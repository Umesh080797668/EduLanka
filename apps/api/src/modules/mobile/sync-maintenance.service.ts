import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SyncMaintenanceService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SyncMaintenanceService.name);

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() @InjectQueue('fcm-push') private readonly pushQueue?: Queue,
    ) {}

    async onApplicationBootstrap() {
        if (this.pushQueue) {
            try {
                // Schedule recurring 90-day retention purge daily at 02:00 UTC (ADR-002)
                const anyQueue = this.pushQueue as any;
                if (typeof anyQueue.upsertJobScheduler === 'function') {
                    await anyQueue.upsertJobScheduler(
                        'scheduled-purge-old-sync-events',
                        { pattern: '0 2 * * *' },
                        { name: 'purge-sync-events', data: {} },
                    );
                } else {
                    await anyQueue.add('purge-sync-events', {}, {
                        repeat: { pattern: '0 2 * * *' },
                        jobId: 'scheduled-purge-old-sync-events',
                    });
                }
                this.logger.log('Scheduled daily 90-day sync events retention purge job');
            } catch (err: any) {
                this.logger.warn(`Could not schedule repeatable purge job: ${err.message}`);
            }
        }
    }

    /**
     * Executes the 90-day sync events purge RPC.
     */
    async executeRetentionPurge(): Promise<number> {
        const { data, error } = await this.supabase.adminClient.rpc('purge_old_sync_events');
        if (error) {
            this.logger.error(`purge_old_sync_events failed: ${error.message}`);
            return 0;
        }
        const count = Number(data) || 0;
        this.logger.log(`purge_old_sync_events completed: ${count} expired events purged.`);
        return count;
    }

    /**
     * Scrubs PII for a specific user across all sync_events in compliance with ADR-002.
     */
    async scrubUserPii(tenantId: string, userId: string): Promise<number> {
        const { data, error } = await this.supabase.adminClient.rpc('scrub_user_sync_events_pii', {
            p_tenant_id: tenantId,
            p_user_id: userId,
        });

        if (error) {
            this.logger.error(`scrub_user_sync_events_pii failed: ${error.message}`);
            return 0;
        }
        const count = Number(data) || 0;
        this.logger.log(`scrub_user_sync_events_pii completed for user ${userId}: ${count} rows scrubbed.`);
        return count;
    }
}
