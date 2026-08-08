import { Module } from '@nestjs/common';
import { StudentMarksController } from './student-marks.controller';
import { StudentMarksService } from './student-marks.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [StudentMarksController],
    providers: [StudentMarksService],
    exports: [StudentMarksService],
})
export class StudentMarksModule { }
