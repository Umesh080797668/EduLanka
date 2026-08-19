import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@edu-lanka/shared-types';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditLogsController {
    constructor(private readonly auditLogsService: AuditLogsService) { }

    @Get()
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'List all audit logs across the system' })
    async getAuditLogs(
        @Query('limit') limitArg?: string,
        @Query('offset') offsetArg?: string,
        @Query('targetUserId') targetUserId?: string,
    ) {
        const limit = parseInt(limitArg || '50', 10);
        const offset = parseInt(offsetArg || '0', 10);

        return this.auditLogsService.listLogs(limit, offset, targetUserId);
    }
}
