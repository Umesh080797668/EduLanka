// =============================================================================
// Students Controller
// =============================================================================
import {
    Controller, Get, Post, Patch, Delete,
    Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, AssignClassDto } from './dto/student.dto';

@ApiTags('students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('students')
export class StudentsController {
    constructor(private readonly studentsService: StudentsService) { }

    @Post()
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
    @ApiOperation({ summary: 'Update a student profile (admin only)' })
    updateProfile(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateStudentDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.studentsService.updateProfile(id, dto, user);
    }

    @Post(':id/assign-class')
    @ApiOperation({ summary: 'Assign student to a class/section (admin only)' })
    assignToClass(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignClassDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.studentsService.assignToClass(id, dto, user);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Deactivate a student account (admin only)' })
    deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.studentsService.deactivate(id, user);
    }
}
