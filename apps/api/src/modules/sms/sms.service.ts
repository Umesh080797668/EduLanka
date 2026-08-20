import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SmsJobPayload } from './sms.processor';

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(
        @InjectQueue('sms-gateway') private readonly smsQueue: Queue<SmsJobPayload>
    ) { }

    async sendSms(to: string, message: string, tenantId: string, noticeId?: string) {
        this.logger.log(`Dispatching Queue worker to ${to}...`);

        await this.smsQueue.add('dispatch-sms', { to, message, tenantId, noticeId }, {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 3000
            },
            removeOnComplete: true,
            removeOnFail: 100 // retain last 100 queue logs max!
        });

        return { success: true, queued: true };
    }
}
