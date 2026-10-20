import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { BillingService } from './billing.service';

export const BILLING_QUEUE_NAME = 'billing-queue';

@Processor(BILLING_QUEUE_NAME)
export class BillingProcessor extends WorkerHost implements OnApplicationBootstrap {
    private readonly logger = new Logger(BillingProcessor.name);

    constructor(
        private readonly billingService: BillingService,
        @InjectQueue(BILLING_QUEUE_NAME) private readonly billingQueue: Queue,
    ) {
        super();
    }

    async onApplicationBootstrap() {
        try {
            // Schedule the nightly BullMQ cron job running at 02:00 UTC (§7c)
            const anyQueue = this.billingQueue as any;
            if (typeof anyQueue.upsertJobScheduler === 'function') {
                await anyQueue.upsertJobScheduler(
                    'nightly-billing-cron',
                    { pattern: '0 2 * * *' },
                    { name: 'nightly-billing-snapshot', data: {} },
                );
            } else {
                await anyQueue.add(
                    'nightly-billing-snapshot',
                    {},
                    {
                        repeat: {
                            pattern: '0 2 * * *',
                        },
                        jobId: 'nightly-billing-cron',
                        removeOnComplete: true,
                    },
                );
            }
            this.logger.log('Nightly BullMQ billing cron scheduled at 02:00 UTC (0 2 * * *)');
        } catch (err: any) {
            this.logger.warn(`Failed to schedule repeatable billing job: ${err?.message}`);
        }
    }

    async process(job: Job<{ billingMonth?: string }, any, string>): Promise<any> {
        this.logger.log(`Processing billing job: ${job.name} (ID: ${job.id})`);

        if (job.name === 'nightly-billing-snapshot' || job.name === 'generate-snapshot') {
            const overdueCount = await this.billingService.processOverdueInvoices();
            const result = await this.billingService.generateBillingSnapshots(job.data?.billingMonth);
            return {
                success: true,
                count: result.length,
                overdueProcessed: overdueCount,
                billingMonth: job.data?.billingMonth || new Date().toISOString().slice(0, 7),
            };
        }

        this.logger.warn(`Unknown job name: ${job.name}`);
        return { ignored: true };
    }
}
