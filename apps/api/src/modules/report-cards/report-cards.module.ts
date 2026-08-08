import { Module } from '@nestjs/common';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [ReportCardsController],
    providers: [ReportCardsService],
    exports: [ReportCardsService],
})
export class ReportCardsModule { }
