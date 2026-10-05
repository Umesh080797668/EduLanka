import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

import { StudentMarksController } from './student-marks.controller';
import { StudentMarksService } from './student-marks.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [StudentMarksController],
    providers: [StudentMarksService],
    exports: [StudentMarksService],
})
export class StudentMarksModule { }
