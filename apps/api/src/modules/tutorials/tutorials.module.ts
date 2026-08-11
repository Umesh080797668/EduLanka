import { Module } from '@nestjs/common';
import { TutorialsController } from './tutorials.controller';
import { TutorialsService } from './tutorials.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [TutorialsController],
    providers: [TutorialsService],
    exports: [TutorialsService],
})
export class TutorialsModule { }
