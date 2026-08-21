import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@edu-lanka/shared-types';
import { RedisService } from '../redis/redis.service';

@Controller('system-admin/observability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObservabilityController {
    constructor(private readonly redisService: RedisService) { }

    @Get('metrics')
    @Version('1')
    @Roles(UserRole.SUPER_ADMIN)
    async getSystemMetrics() {
        const wsCount = await this.redisService.getClient().get('metrics:ws:connections') || '0';

        return {
            date: new Date().toISOString(),
            status: 'Healthy',
            websockets: {
                active_connections: parseInt(wsCount, 10)
            },
            uptime_seconds: process.uptime()
        };
    }
}
