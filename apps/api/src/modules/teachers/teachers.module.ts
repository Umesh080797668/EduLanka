import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { TeachersController } from './teachers.controller';
import { TeachersService } from './teachers.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [TeachersController],
    providers: [TeachersService],
    exports: [TeachersService],
})
export class TeachersModule { }
