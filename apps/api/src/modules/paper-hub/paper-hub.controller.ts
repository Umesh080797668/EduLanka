import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PaperHubService } from './paper-hub.service';
import { CreatePaperDto, AttachMarkingSchemeDto, BulkUploadPapersDto } from './dto/create-paper.dto';

@ApiTags('papers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('papers')
export class PaperHubController {
    constructor(private readonly paperHubService: PaperHubService) { }

    @Get()
    @ApiOperation({ summary: 'Browse examination past papers with subject, grade, year, and medium filters' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'subject', required: false, type: String })
    @ApiQuery({ name: 'gradeLevel', required: false, type: Number })
    @ApiQuery({ name: 'examType', required: false, type: String })
    @ApiQuery({ name: 'medium', required: false, type: String })
    @ApiQuery({ name: 'year', required: false, type: Number })
    listPapers(
        @CurrentUser() user: JwtPayload,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('subject') subject?: string,
        @Query('gradeLevel') gradeLevel?: string,
        @Query('examType') examType?: string,
        @Query('medium') medium?: string,
        @Query('year') year?: string,
    ) {
        return this.paperHubService.listPapers(user, {
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            subject,
            gradeLevel: gradeLevel ? parseInt(gradeLevel, 10) : undefined,
            examType,
            medium,
            year: year ? parseInt(year, 10) : undefined,
        });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a specific paper and its paired marking scheme' })
    getPaperById(@Param('id') id: string) {
        return this.paperHubService.getPaperById(id);
    }

    @Post()
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN, UserRole.TEACHER)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Upload a school-specific past or term examination paper' })
    createPaper(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaperDto) {
        return this.paperHubService.createPaper(user, dto);
    }

    @Post('bulk-upload')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Bulk upload national past papers into the national hub (Super Admin only)' })
    bulkUploadNationalPapers(@CurrentUser() user: JwtPayload, @Body() dto: BulkUploadPapersDto) {
        return this.paperHubService.bulkUploadNationalPapers(user, dto.papers);
    }

    @Patch(':id/scheme')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Attach a marking scheme to an existing paper' })
    attachMarkingScheme(@Param('id') id: string, @Body() dto: AttachMarkingSchemeDto) {
        return this.paperHubService.attachMarkingScheme(id, dto);
    }
}
