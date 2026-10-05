import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

import { TutorialsController } from './tutorials.controller';
import { TutorialsService } from './tutorials.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [TutorialsController],
    providers: [TutorialsService],
    exports: [TutorialsService],
})
export class TutorialsModule { }
