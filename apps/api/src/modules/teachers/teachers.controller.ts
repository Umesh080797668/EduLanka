import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('teachers')
export class TeachersController {
    constructor(private readonly teachersService: TeachersService) { }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new teacher account (admin only)' })
    create(@Body() dto: CreateTeacherDto, @CurrentUser() user: JwtPayload) {
        return this.teachersService.create(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all teachers in the current tenant' })
    findAll(@CurrentUser() user: JwtPayload) {
        return this.teachersService.findAll(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a teacher by ID (includes assigned classes)' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.teachersService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Update a teacher profile (admin only)' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTeacherDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.teachersService.update(id, dto, user);
    }

    @Get(':id/classes')
    @ApiOperation({ summary: 'Get all classes assigned to a teacher' })
    getClasses(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.teachersService.getClasses(id, user);
    }

    @Delete(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Deactivate a teacher account (admin only)' })
    deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.teachersService.deactivate(id, user);
    }
}
