import { Controller, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
    HealthCheck,
    HealthCheckService,
    MemoryHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('health')
@Controller('health')
export class HealthController {
    constructor(
        private readonly health: HealthCheckService,
        private readonly memory: MemoryHealthIndicator,
    ) { }

    /**
     * GET /api/v1/health
     * Returns service liveness and basic resource metrics.
     * No auth required — used by Nginx upstream health checks.
     */
    @Get()
    @Version('1')
    @HealthCheck()
    @ApiOperation({ summary: 'Service liveness check' })
    check() {
        return this.health.check([
            // Heap must stay below 512 MB
            () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
            // RSS must stay below 1 GB
            () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
        ]);
    }
}
