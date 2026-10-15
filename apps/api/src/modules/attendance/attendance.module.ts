import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
    imports: [SupabaseModule],
    controllers: [AttendanceController],
    providers: [AttendanceService],
    exports: [AttendanceService],
})
export class AttendanceModule { }
