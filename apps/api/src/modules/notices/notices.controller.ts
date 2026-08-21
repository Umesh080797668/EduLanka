import { Controller, Post, Get, Body, Req, UseGuards, Param, Query } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@edu-lanka/shared-types';

// Global prefix ('api') + URI versioning (default '1') already yield /api/v1/notices.
@Controller('notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NoticesController {
    constructor(private readonly noticesService: NoticesService) { }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    async createNotice(@Req() req: any, @Body() body: any) {
        return this.noticesService.createNotice(req.user.tenantId, req.user.sub, body);
    }

    @Get()
    async getNotices(
        @Req() req: any,
        @Query('classId') classId?: string,
        @Query('gradeId') gradeId?: string
    ) {
        return this.noticesService.getNotices(req.user.tenantId, req.user.sub, req.user.role, classId, gradeId);
    }

    @Post('broadcast')
    async dispatchBroadcast(@Req() req: any, @Body() request: any) {
        if (req.user.role !== 'SUPER_ADMIN') {
            throw new Error('Strictly System Administrator privilege isolated.'); // Hard abort cleanly
        }
        return this.noticesService.broadcastGlobalNotice(req.user.sub, request);
    }

    @Post(':id/read')
    async markAsRead(@Req() req: any, @Param('id') id: string) {
        return this.noticesService.markAsRead(req.user.tenantId, id, req.user.sub);
    }
}
