import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [ClassesController],
    providers: [ClassesService],
    exports: [ClassesService],
})
export class ClassesModule { }
