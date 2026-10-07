// =============================================================================
// Classes Controller
// =============================================================================
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller, Get, Post, Patch, Delete, Query,
    Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto, AssignTeacherDto } from './dto/class.dto';

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
    constructor(private readonly classesService: ClassesService) { }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new class / section (admin only)' })
    create(@Body() dto: CreateClassDto, @CurrentUser() user: JwtPayload) {
        return this.classesService.create(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all classes for the current tenant' })
    @ApiQuery({ name: 'teacherId', required: false, description: 'Filter by assigned teacher user ID' })
    findAll(@Query('teacherId') teacherId: string | undefined, @CurrentUser() user: JwtPayload) {
        return this.classesService.findAll(user, teacherId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a class by ID (includes teacher and student info)' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Update a class (admin only)' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateClassDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.classesService.update(id, dto, user);
    }

    @Delete(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a class (admin only)' })
    remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.remove(id, user);
    }

    @Post(':id/assign-teacher')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Assign a teacher to a class (admin only)' })
    assignTeacher(
        @Param('id', ParseUUIDPipe) classId: string,
        @Body() dto: AssignTeacherDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.classesService.assignTeacher(classId, dto, user);
    }

    @Delete(':id/teachers/:teacherId')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a teacher from a class (admin only)' })
    removeTeacher(
        @Param('id', ParseUUIDPipe) classId: string,
        @Param('teacherId', ParseUUIDPipe) teacherId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.classesService.removeTeacher(classId, teacherId, user);
    }
}
