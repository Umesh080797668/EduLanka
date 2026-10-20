import type { JwtPayload } from '@edu-lanka/shared-types';
import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    Param,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { RecordAttendanceDto, GetAttendanceQueryDto } from './dto/attendance.dto';
import { AttendanceService } from './attendance.service';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
    constructor(private readonly attendanceService: AttendanceService) { }

    @Get('my-attendance')
    @ApiOperation({ summary: 'Get current student attendance history' })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getMyAttendance(
        @CurrentUser() user: JwtPayload,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.attendanceService.getMyAttendance(user, startDate, endDate);
    }

    @Get('student/:studentId')
    @ApiOperation({ summary: 'Get attendance history for a specific student (Admins, Teachers, and Parents)' })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getStudentAttendance(
        @CurrentUser() user: JwtPayload,
        @Param('studentId') studentId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.attendanceService.getStudentAttendance(user, studentId, startDate, endDate);
    }

    @Get()
    @ApiOperation({ summary: 'Get class attendance roster and status for a specific date and period' })
    getAttendance(
        @CurrentUser() user: JwtPayload,
        @Query() query: GetAttendanceQueryDto,
    ) {
        return this.attendanceService.getAttendance(user, query.classId, query.date, query.period ?? 1);
    }

    @Post()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Record or update class roll call attendance (Teachers & Admins)' })
    recordAttendance(
        @CurrentUser() user: JwtPayload,
        @Body() dto: RecordAttendanceDto,
    ) {
        return this.attendanceService.recordAttendance(user, dto);
    }

    @Get('stats')
    @ApiOperation({ summary: 'Get attendance trends and statistics for a class' })
    @ApiQuery({ name: 'classId', required: true, type: String })
    @ApiQuery({ name: 'startDate', required: false, type: String })
    @ApiQuery({ name: 'endDate', required: false, type: String })
    getClassAttendanceStats(
        @CurrentUser() user: JwtPayload,
        @Query('classId') classId: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.attendanceService.getClassAttendanceStats(user, classId, startDate, endDate);
    }
}
