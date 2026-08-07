import { Module } from '@nestjs/common';

import { TenantGuard } from '../../common/guards/tenant.guard';
import { SupabaseModule } from '../supabase/supabase.module';

import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
    imports: [SupabaseModule],
    controllers: [TenantController],
    providers: [TenantService, TenantGuard],
    exports: [TenantService, TenantGuard],
})
export class TenantModule { }
