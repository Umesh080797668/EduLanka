import {
    Controller, Get, Post, Body, Param, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@edu-lanka/shared-types';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { TutorialsService } from './tutorials.service';
import { CreateTutorialDto, UpdateTutorialStatusDto } from './dto/tutorial.dto';

@ApiTags('tutorials')
@Controller()
export class TutorialsController {
    constructor(private readonly tutorialsService: TutorialsService) { }

    // =========================================================================
    // Public / Protected Global Endpoints
    // =========================================================================

    @Get('tutorials/:role/:screenId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get active tutorial and steps for a specific screen and role' })
    getTutorialByScreen(
        @Param('role') role: string,
        @Param('screenId') screenId: string
    ) {
        return this.tutorialsService.getTutorialForScreen(role, screenId);
    }

    // =========================================================================
    // Tenant-Scoped Endpoints
    // =========================================================================

    @Get('me/tutorials')
    @UseGuards(JwtAuthGuard, TenantGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get all completed/skipped tutorial IDs for the logged-in user' })
    getMyTutorials(@CurrentUser() user: JwtPayload) {
        return this.tutorialsService.getUserCompletions(user);
    }

    @Post('me/tutorials/:id/status')
    @UseGuards(JwtAuthGuard, TenantGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a tutorial as COMPLETED or SKIPPED for the logged-in user' })
    updateMyTutorialStatus(
        @Param('id') tutorialId: string,
        @Body() dto: UpdateTutorialStatusDto,
        @CurrentUser() user: JwtPayload
    ) {
        return this.tutorialsService.updateUserStatus(tutorialId, dto.status, user);
    }

    @Get('institution-admin/tutorials/stats')
    @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
    @Roles(UserRole.SCHOOL_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get aggregated tutorial completion stats for School Admins' })
    getAdminStats(@CurrentUser() user: JwtPayload) {
        return this.tutorialsService.getTenantStats(user);
    }

    // =========================================================================
    // Global Management Endpoints (Super Admin Only)
    // =========================================================================

    @Post('system-admin/tutorials')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN) // Notice we do NOT use TenantGuard for global content
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new global tutorial (Super Admin)' })
    createGlobalTutorial(@Body() dto: CreateTutorialDto) {
        return this.tutorialsService.createTutorial(dto);
    }

    @Get('system-admin/tutorials/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get global tutorial statistics (Super Admin)' })
    getGlobalStats() {
        return this.tutorialsService.getGlobalStats();
    }
}
