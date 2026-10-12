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
        const heapLimit = process.env['NODE_ENV'] === 'test' ? 1024 * 1024 * 1024 : 512 * 1024 * 1024;
        return this.health.check([
            // Heap must stay below 512 MB in prod, 1 GB in test runner
            () => this.memory.checkHeap('memory_heap', heapLimit),
            // RSS must stay below 1 GB
            () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),
        ]);
    }
}
