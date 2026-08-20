import { Controller, Get, Param, ParseUUIDPipe, ParseIntPipe, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { ReportCardsService } from './report-cards.service';

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
}
