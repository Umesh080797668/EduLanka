import type { JwtPayload } from '@edu-lanka/shared-types';
import { Controller, Post, Get, Body, Param, UseGuards, ParseUUIDPipe, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { CreateMarkDto } from './dto/student-marks.dto';
import { StudentMarksService } from './student-marks.service';

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
        @Query('year') year: string,
        @CurrentUser() caller: JwtPayload
    ) {
        const yr = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.studentMarksService.getMarksByClass(classId, term, yr, caller);
    }

    @Get('class/:classId/status')
    @ApiOperation({ summary: 'Get term finalization status for a class' })
    @ApiResponse({ status: 200, description: 'Success' })
    async getFinalizationStatus(
        @Param('classId', ParseUUIDPipe) classId: string,
        @Query('term', ParseIntPipe) term: number,
        @Query('year') year: string,
        @CurrentUser() caller: JwtPayload
    ) {
        const yr = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.studentMarksService.getFinalizationStatus(classId, term, yr, caller);
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

    @Get('student/:studentId/term/:term')
    @ApiOperation({ summary: 'Get marks for a student filtered strictly by term and year' })
    @ApiResponse({ status: 200, description: 'Success' })
    async getStudentMarksByTerm(
        @Param('studentId', ParseUUIDPipe) studentId: string,
        @Param('term', ParseIntPipe) term: number,
        @Query('year') year: string,
        @CurrentUser() caller: JwtPayload,
    ) {
        const yr = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.studentMarksService.getStudentMarksByTerm(studentId, term, yr, caller);
    }

    @Post('class/:classId/finalize')
    @ApiOperation({ summary: 'Finalizes term marks for a class' })
    @ApiResponse({ status: 200, description: 'Term finalized successfully' })
    async finalizeTerm(
        @Param('classId', ParseUUIDPipe) classId: string,
        @Query('term', ParseIntPipe) term: number,
        @Query('year') year: string,
        @CurrentUser() caller: JwtPayload
    ) {
        const yr = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.studentMarksService.finalizeTerm(classId, term, yr, caller);
    }

    @Post('class/:classId/reopen')
    @ApiOperation({ summary: 'Reopens finalized term marks for a class (School Admin only)' })
    @ApiResponse({ status: 200, description: 'Term reopened successfully' })
    async reopenTerm(
        @Param('classId', ParseUUIDPipe) classId: string,
        @Query('term', ParseIntPipe) term: number,
        @Query('year') year: string,
        @CurrentUser() caller: JwtPayload
    ) {
        const yr = year ? parseInt(year, 10) : new Date().getFullYear();
        return this.studentMarksService.reopenTerm(classId, term, yr, caller);
    }
}
