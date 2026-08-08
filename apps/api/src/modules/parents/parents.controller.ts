// =============================================================================
// Parents Controller
// =============================================================================
import {
    Controller, Get, Post, Delete,
    Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { ParentsService } from './parents.service';
import { LinkStudentDto } from './dto/parent.dto';

@ApiTags('parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('parents')
export class ParentsController {
    constructor(private readonly parentsService: ParentsService) { }

    @Get()
    @ApiOperation({ summary: 'List all parent users in the current tenant' })
    findAll(@CurrentUser() user: JwtPayload) {
        return this.parentsService.findAll(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a parent by user ID (includes linked children)' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.parentsService.findOne(id, user);
    }

    @Get(':id/children')
    @ApiOperation({ summary: 'Get all children linked to a parent' })
    getChildren(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.parentsService.getChildren(id, user);
    }

    @Post(':id/link-student')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Link a student to a parent (admin only)' })
    linkToStudent(
        @Param('id', ParseUUIDPipe) parentUserId: string,
        @Body() dto: LinkStudentDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.parentsService.linkToStudent(parentUserId, dto, user);
    }

    @Delete(':id/students/:studentId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unlink a student from a parent (admin only)' })
    unlinkFromStudent(
        @Param('id', ParseUUIDPipe) parentUserId: string,
        @Param('studentId', ParseUUIDPipe) studentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.parentsService.unlinkFromStudent(parentUserId, studentId, user);
    }
}
