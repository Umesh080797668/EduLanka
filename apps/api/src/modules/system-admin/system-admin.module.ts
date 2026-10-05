import { Module } from '@nestjs/common';

import { RedisModule } from '../redis/redis.module';

import { ObservabilityController } from './observability.controller';

@Module({
    imports: [RedisModule],
    controllers: [ObservabilityController]
})
export class SystemAdminModule { }
