import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [ParentsController],
    providers: [ParentsService],
    exports: [ParentsService],
})
export class ParentsModule { }
