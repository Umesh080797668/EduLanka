import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { GradesService } from './grades.service';
import { CreateGradeDto, UpdateGradeDto } from './dto/grade.dto';

@ApiTags('Grades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('grades')
export class GradesController {
    constructor(private readonly gradesService: GradesService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new curriculum grade (Admin only)' })
    @ApiResponse({ status: 201, description: 'Created' })
    async create(@Body() dto: CreateGradeDto, @CurrentUser() caller: JwtPayload) {
        return this.gradesService.create(dto, caller);
    }

    @Get()
    @ApiOperation({ summary: 'List all active grades in school' })
    @ApiResponse({ status: 200, description: 'Success' })
    async findAll(@CurrentUser() caller: JwtPayload) {
        return this.gradesService.findAll(caller);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get grade details' })
    @ApiResponse({ status: 200, description: 'Success' })
    async findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() caller: JwtPayload) {
        return this.gradesService.findOne(id, caller);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a grade metadata (Admin only)' })
    @ApiResponse({ status: 200, description: 'Updated' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateGradeDto,
        @CurrentUser() caller: JwtPayload,
    ) {
        return this.gradesService.update(id, dto, caller);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a grade (Admin only)' })
    @ApiResponse({ status: 200, description: 'Deleted' })
    async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() caller: JwtPayload) {
        return this.gradesService.delete(id, caller);
    }
}
