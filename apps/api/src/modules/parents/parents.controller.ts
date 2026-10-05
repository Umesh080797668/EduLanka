import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller, Get, Post, Delete,
    Body, Param, UseGuards, HttpCode, HttpStatus, Patch
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { LinkStudentDto, CreateParentDto, UpdateParentDto } from './dto/parent.dto';
import { ParentsService } from './parents.service';

@ApiTags('parents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('parents')
export class ParentsController {
    constructor(private readonly parentsService: ParentsService) { }

    @Get('me')
    @ApiOperation({ summary: 'Get current parent profile and linked children' })
    getMe(@CurrentUser() user: JwtPayload) {
        return this.parentsService.getMe(user);
    }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new parent account (admin only)' })
    create(@Body() dto: CreateParentDto, @CurrentUser() user: JwtPayload) {
        return this.parentsService.create(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all parent users in the current tenant' })
    findAll(@CurrentUser() user: JwtPayload) {
        return this.parentsService.findAll(user);
    }

    @Patch(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Update a parent account (admin only)' })
    update(@Param('id') id: string, @Body() dto: UpdateParentDto, @CurrentUser() user: JwtPayload) {
        return this.parentsService.update(id, dto, user);
    }

    @Delete(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Deactivate a parent account (admin only)' })
    deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
        return this.parentsService.deactivate(id, user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a parent by user ID (includes linked children)' })
    findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
        return this.parentsService.findOne(id, user);
    }

    @Get(':id/children')
    @ApiOperation({ summary: 'Get all children linked to a parent' })
    getChildren(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
        return this.parentsService.getChildren(id, user);
    }

    @Post(':id/link-student')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Link a student to a parent (admin only)' })
    linkToStudent(
        @Param('id') parentUserId: string,
        @Body() dto: LinkStudentDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.parentsService.linkToStudent(parentUserId, dto, user);
    }

    @Delete(':id/students/:studentId')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Unlink a student from a parent (admin only)' })
    unlinkFromStudent(
        @Param('id') parentUserId: string,
        @Param('studentId') studentId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.parentsService.unlinkFromStudent(parentUserId, studentId, user);
    }
}
