import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

import { BulkReportCardsProcessor } from './bulk-report-cards.processor';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService, BULK_REPORT_CARDS_QUEUE_NAME } from './report-cards.service';

@Module({
    imports: [
        BullModule.registerQueue({
            name: BULK_REPORT_CARDS_QUEUE_NAME,
        }),
        SupabaseModule,
        TenantModule,
    ],
    controllers: [ReportCardsController],
    providers: [ReportCardsService, BulkReportCardsProcessor],
    exports: [ReportCardsService],
})
export class ReportCardsModule { }

