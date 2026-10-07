import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, UseGuards, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { CreateStudentDto, UpdateStudentDto, AssignClassDto } from './dto/student.dto';
import { StudentsService } from './students.service';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('students')
export class StudentsController {
    constructor(private readonly studentsService: StudentsService) { }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Enroll a new student (admin only)' })
    enroll(@Body() dto: CreateStudentDto, @CurrentUser() user: JwtPayload) {
        return this.studentsService.enroll(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all students in the current tenant' })
    findAll(@CurrentUser() user: JwtPayload) {
        return this.studentsService.findAll(user);
    }

    @Get('me')
    @ApiOperation({ summary: 'Get current student profile' })
    findMe(@CurrentUser() user: JwtPayload) {
        return this.studentsService.findMe(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a student by ID (includes class and parent info)' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.studentsService.findOne(id, user);
    }

    @Patch(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Update a student profile (admin only)' })
    updateProfile(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateStudentDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.studentsService.updateProfile(id, dto, user);
    }

    @Post(':id/assign-class')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Assign student to a class/section (admin only)' })
    assignToClass(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignClassDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.studentsService.assignToClass(id, dto, user);
    }

    @Delete(':id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Deactivate a student account (admin only)' })
    deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.studentsService.deactivate(id, user);
    }
}
