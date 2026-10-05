import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [ReportCardsController],
    providers: [ReportCardsService],
    exports: [ReportCardsService],
})
export class ReportCardsModule { }
