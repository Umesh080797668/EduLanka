import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [GradesController],
    providers: [GradesService],
    exports: [GradesService],
})
export class GradesModule { }
