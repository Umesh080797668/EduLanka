import { Module } from '@nestjs/common';
import { ObservabilityController } from './observability.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
    imports: [RedisModule],
    controllers: [ObservabilityController]
})
export class SystemAdminModule { }
