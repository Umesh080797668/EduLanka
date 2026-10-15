import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';

import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SyncMaintenanceService implements OnApplicationBootstrap, OnModuleDestroy {
    private readonly logger = new Logger(SyncMaintenanceService.name);
    private fallbackTimer?: NodeJS.Timeout;

    constructor(
        private readonly supabase: SupabaseService,
        @Optional() @InjectQueue('fcm-push') private readonly pushQueue?: Queue,
    ) {}

    async onApplicationBootstrap() {
        if (!this.pushQueue) {
            this.logger.error(
                '[CRITICAL_MAINTENANCE_ALERT] BullMQ push queue is absent; automated 90-day sync events retention purge cannot be registered with BullMQ. Starting in-process daily fallback timer.',
            );
            this.startFallbackPurgeTimer();
            return;
        }

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
            this.logger.log('Scheduled daily 90-day sync events retention purge job via BullMQ');
        } catch (err: any) {
            this.logger.error(
                `[CRITICAL_MAINTENANCE_ALERT] Failed to schedule repeatable BullMQ 90-day purge job: ${err.message}. Starting in-process fallback timer.`,
                err.stack,
            );
            this.startFallbackPurgeTimer();
        }
    }

    onModuleDestroy() {
        if (this.fallbackTimer) {
            clearInterval(this.fallbackTimer);
            this.fallbackTimer = undefined;
        }
    }

    private startFallbackPurgeTimer() {
        if (this.fallbackTimer) return;
        // Run once a day (24 hours) as in-process backup when queue is absent
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
        this.fallbackTimer = setInterval(async () => {
            try {
                this.logger.log('Executing in-process fallback 90-day retention purge...');
                await this.executeRetentionPurge();
            } catch (err: any) {
                this.logger.error(`[CRITICAL_MAINTENANCE_ALERT] In-process fallback purge failed: ${err.message}`);
            }
        }, TWENTY_FOUR_HOURS);
        this.fallbackTimer.unref();
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
