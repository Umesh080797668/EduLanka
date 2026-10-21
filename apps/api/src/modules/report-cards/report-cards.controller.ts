import type { JwtPayload } from '@edu-lanka/shared-types';
import { Controller, Get, Post, Body, Param, ParseUUIDPipe, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { ReportCardsService } from './report-cards.service';
import { BulkReportCardsDto } from './dto/bulk-report-cards.dto';

@ApiTags('Report Cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('report-cards')
export class ReportCardsController {
    constructor(private readonly reportCardsService: ReportCardsService) { }

    @Get('student/:studentId/term/:term/year/:year/download')
    @ApiOperation({ summary: 'Generates and downloads a static report card document for a student' })
    @ApiResponse({ status: 200, description: 'File download' })
    async downloadReportCard(
        @Param('studentId', ParseUUIDPipe) studentId: string,
        @Param('term', ParseIntPipe) term: number,
        @Param('year', ParseIntPipe) year: number,
        @CurrentUser() caller: JwtPayload,
        @Res() res: any
    ) {
        const buffer = await this.reportCardsService.generateReportCard(studentId, term, year, caller);

        // We serve the generated PDF
        res.header('Content-Type', 'application/pdf');
        res.header('Content-Disposition', `attachment; filename="report-card-${studentId}-term${term}-${year}.pdf"`);
        res.header('Content-Length', buffer.length.toString());

        res.send(buffer);
    }

    @Post('bulk')
    @ApiOperation({ summary: 'Queue background bulk generation of report cards for a class or entire school' })
    @ApiResponse({ status: 202, description: 'Bulk job scheduled' })
    queueBulkReportCards(
        @CurrentUser() caller: JwtPayload,
        @Body() dto: BulkReportCardsDto,
    ) {
        return this.reportCardsService.queueBulkReportCardGeneration(dto, caller);
    }

    @Get('bulk/:jobId/status')
    @ApiOperation({ summary: 'Check status and progress of a bulk report card generation job' })
    getBulkJobStatus(
        @CurrentUser() caller: JwtPayload,
        @Param('jobId') jobId: string,
    ) {
        return this.reportCardsService.getBulkJobStatus(jobId, caller);
    }
}
