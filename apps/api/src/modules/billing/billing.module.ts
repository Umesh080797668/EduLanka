import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingController } from './billing.controller';
import { BillingProcessor, BILLING_QUEUE_NAME } from './billing.processor';
import { BillingService } from './billing.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: BILLING_QUEUE_NAME,
        }),
        SupabaseModule,
    ],
    controllers: [BillingController],
    providers: [BillingService, BillingProcessor],
    exports: [BillingService],
})
export class BillingModule { }
