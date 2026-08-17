// =============================================================================
// Classes Controller
// =============================================================================
import {
    Controller, Get, Post, Patch, Delete, Query,
    Body, Param, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { ClassesService } from './classes.service';
import { CreateClassDto, UpdateClassDto, AssignTeacherDto } from './dto/class.dto';

@ApiTags('classes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('classes')
export class ClassesController {
    constructor(private readonly classesService: ClassesService) { }

    @Post()
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
    findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.findOne(id, user);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a class (admin only)' })
    update(
        @Param('id') id: string,
        @Body() dto: UpdateClassDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.classesService.update(id, dto, user);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a class (admin only)' })
    remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
        return this.classesService.remove(id, user);
    }

    @Post(':id/assign-teacher')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Assign a teacher to a class (admin only)' })
    assignTeacher(
        @Param('id') classId: string,
        @Body() dto: AssignTeacherDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.classesService.assignTeacher(classId, dto, user);
    }

    @Delete(':id/teachers/:teacherId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Remove a teacher from a class (admin only)' })
    removeTeacher(
        @Param('id') classId: string,
        @Param('teacherId') teacherId: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.classesService.removeTeacher(classId, teacherId, user);
    }
}
