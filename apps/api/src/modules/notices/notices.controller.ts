import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Req,
    UseGuards,
    Param,
    Query,
    ForbiddenException,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NoticesService } from './notices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@edu-lanka/shared-types';
import {
    CreateNoticeDto,
    UpdateNoticeDto,
    CreateMaintenanceNoticeDto,
    BroadcastNoticeDto,
} from './dto/notices.dto';

export { CreateMaintenanceNoticeDto };

// Global prefix ('api') + URI versioning (default '1') already yield /api/v1/notices.
@ApiTags('notices')
@ApiBearerAuth()
@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
    constructor(private readonly noticesService: NoticesService) { }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    @ApiOperation({ summary: 'Create a new notice' })
    async createNotice(@Req() req: any, @Body() body: CreateNoticeDto) {
        return this.noticesService.createNotice(req.user.tenantId, req.user.sub, body, req.user.role);
    }

    @Get()
    @ApiOperation({ summary: 'Get notices scoped to the caller' })
    async getNotices(
        @Req() req: any,
        @Query('classId') classId?: string,
        @Query('gradeId') gradeId?: string,
        @Query('includeArchived') includeArchived?: string
    ) {
        return this.noticesService.getNotices(
            req.user.tenantId,
            req.user.sub,
            req.user.role,
            classId,
            gradeId,
            includeArchived === 'true'
        );
    }

    @Patch(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    @ApiOperation({ summary: 'Update an existing notice' })
    async updateNotice(
        @Req() req: any,
        @Param('id') id: string,
        @Body() body: UpdateNoticeDto
    ) {
        return this.noticesService.updateNotice(req.user.tenantId, id, req.user.sub, body, req.user.role);
    }

    @Patch(':id/archive')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Archive a notice' })
    async archiveNotice(@Req() req: any, @Param('id') id: string) {
        return this.noticesService.archiveNotice(req.user.tenantId, id, req.user.sub, req.user.role);
    }

    @Delete(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete a notice' })
    async deleteNotice(@Req() req: any, @Param('id') id: string) {
        return this.noticesService.deleteNotice(req.user.tenantId, id, req.user.sub, req.user.role);
    }

    @Post('broadcast')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Dispatch cross-tenant announcement' })
    async dispatchBroadcast(@Req() req: any, @Body() dto: BroadcastNoticeDto) {
        if (req.user.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Strictly System Administrator privilege isolated.');
        }
        return this.noticesService.broadcastGlobalNotice(req.user.sub, dto);
    }

    @Post(':id/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark notice as read' })
    async markAsRead(@Req() req: any, @Param('id') id: string) {
        return this.noticesService.markAsRead(req.user.tenantId, id, req.user.sub);
    }

    @Post(':id/acknowledge')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Explicitly acknowledge a notice' })
    async acknowledgeNotice(@Req() req: any, @Param('id') id: string) {
        return this.noticesService.acknowledgeNotice(req.user.tenantId, id, req.user.sub);
    }

    @Get(':id/acknowledgments')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    @ApiOperation({ summary: 'View readers who acknowledged a notice' })
    async getAcknowledgments(@Req() req: any, @Param('id') id: string) {
        return this.noticesService.getNoticeAcknowledgments(
            req.user.tenantId,
            id,
            req.user.sub,
            req.user.role,
        );
    }

    // ── System Maintenance Notices (Platform-wide downtime & upgrades) ─────────

    @Get('maintenance/active')
    @ApiOperation({ summary: 'Retrieve active platform maintenance notices' })
    async getActiveMaintenanceNotices() {
        return this.noticesService.getActiveMaintenanceNotices();
    }

    @Get('maintenance')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Retrieve all platform maintenance notices (history)' })
    async getAllMaintenanceNotices() {
        return this.noticesService.getAllMaintenanceNotices();
    }

    @Post('maintenance')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Create platform maintenance announcement' })
    async createMaintenanceNotice(@Req() req: any, @Body() dto: CreateMaintenanceNoticeDto) {
        if (req.user.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only System Administrators can create maintenance announcements.');
        }
        return this.noticesService.createMaintenanceNotice(req.user.sub, dto);
    }

    @Delete('maintenance/:id')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Deactivate platform maintenance announcement' })
    async deactivateMaintenanceNotice(@Req() req: any, @Param('id') id: string) {
        if (req.user.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenException('Only System Administrators can deactivate maintenance announcements.');
        }
        return this.noticesService.deactivateMaintenanceNotice(id);
    }
}
