import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
    imports: [SupabaseModule, TenantModule, RedisModule],
    controllers: [UsersController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
