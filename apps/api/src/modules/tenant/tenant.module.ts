import { Module, Global } from '@nestjs/common';

import { TenantGuard } from '../../common/guards/tenant.guard';
import { SupabaseModule } from '../supabase/supabase.module';

import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { PlanFeaturesService } from './plan-features.service';

@Global()
@Module({
    imports: [SupabaseModule],
    controllers: [TenantController],
    providers: [TenantService, TenantGuard, PlanFeaturesService],
    exports: [TenantService, TenantGuard, PlanFeaturesService],
})
export class TenantModule { }

