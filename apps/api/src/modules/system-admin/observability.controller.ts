import { Controller, Get, UseGuards, Version } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@edu-lanka/shared-types';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';

@Controller('system-admin/observability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ObservabilityController {
    constructor(
        private readonly redisService: RedisService,
        private readonly smsService: SmsService,
    ) { }

    @Get('metrics')
    @Version('1')
    @Roles(UserRole.SUPER_ADMIN)
    async getSystemMetrics() {
        const redis = this.redisService.getClient();
        const [chatWs, notifWs, legacyWs, errorCount, queueMetrics] = await Promise.all([
            redis.get('metrics:ws:chat:connections'),
            redis.get('metrics:ws:notifications:connections'),
            redis.get('metrics:ws:connections'),
            redis.get('metrics:ws:errors'),
            this.smsService.getQueueMetrics().catch(() => ({ waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 })),
        ]);

        const chatCount = parseInt(chatWs || '0', 10);
        const notifCount = parseInt(notifWs || '0', 10);
        const legacyCount = parseInt(legacyWs || '0', 10);
        const totalActive = (chatCount + notifCount) > 0 ? (chatCount + notifCount) : legacyCount;

        return {
            date: new Date().toISOString(),
            status: 'Healthy',
            websockets: {
                active_connections: totalActive,
                chat_connections: chatCount,
                notification_connections: notifCount,
                error_count: parseInt(errorCount || '0', 10),
            },
            sms_queue: queueMetrics,
            uptime_seconds: process.uptime(),
        };
    }
}
