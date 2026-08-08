import { Controller, Post, Get, Body, Param, UseGuards, ParseUUIDPipe, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { StudentMarksService } from './student-marks.service';
import { CreateMarkDto } from './dto/student-marks.dto';

@ApiTags('Student Marks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('student-marks')
export class StudentMarksController {
    constructor(private readonly studentMarksService: StudentMarksService) { }

    @Post()
    @ApiOperation({ summary: 'Creates or updates a student mark entry' })
    @ApiResponse({ status: 201, description: 'Success' })
    async recordMark(@Body() dto: CreateMarkDto, @CurrentUser() caller: JwtPayload) {
        return this.studentMarksService.upsertMark(dto, caller);
    }

    @Get('class/:classId')
    @ApiOperation({ summary: 'Get marks for a class by term and year' })
    @ApiResponse({ status: 200, description: 'Success' })
    async getMarksByClass(
        @Param('classId', ParseUUIDPipe) classId: string,
        @Query('term', ParseIntPipe) term: number,
        @Query('year', ParseIntPipe) year: number,
        @CurrentUser() caller: JwtPayload
    ) {
        return this.studentMarksService.getMarksByClass(classId, term, year, caller);
    }

    @Get('student/:studentId')
    @ApiOperation({ summary: 'Get all marks for a student' })
    @ApiResponse({ status: 200, description: 'Success' })
    async getMarksByStudent(
        @Param('studentId', ParseUUIDPipe) studentId: string,
        @CurrentUser() caller: JwtPayload
    ) {
        return this.studentMarksService.getMarksByStudent(studentId, caller);
    }
}
