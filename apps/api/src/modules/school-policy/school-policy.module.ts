import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { SchoolPolicyController } from './school-policy.controller';
import { SchoolPolicyService } from './school-policy.service';

@Module({
    imports: [SupabaseModule, TenantModule],
    controllers: [SchoolPolicyController],
    providers: [SchoolPolicyService],
    exports: [SchoolPolicyService],
})
export class SchoolPolicyModule { }
