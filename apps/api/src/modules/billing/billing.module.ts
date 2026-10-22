import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingController } from './billing.controller';
import { BillingProcessor, BILLING_QUEUE_NAME } from './billing.processor';
import { BillingService } from './billing.service';
import { SponsorshipService } from './sponsorship.service';

import { AccountLockGuard } from '../../common/guards/account-lock.guard';

@Module({
    imports: [
        BullModule.registerQueue({
            name: BILLING_QUEUE_NAME,
        }),
        SupabaseModule,
    ],
    controllers: [BillingController],
    providers: [BillingService, SponsorshipService, BillingProcessor, AccountLockGuard],
    exports: [BillingService, SponsorshipService, AccountLockGuard],
})
export class BillingModule { }
