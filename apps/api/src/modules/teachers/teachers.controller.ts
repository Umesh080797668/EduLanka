// =============================================================================
// Teachers Controller
// =============================================================================
import {
    Controller, Get, Post, Patch,
    Body, Param, ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/teacher.dto';

@ApiTags('teachers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('teachers')
export class TeachersController {
    constructor(private readonly teachersService: TeachersService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create a new teacher account (admin only)' })
    create(@Body() dto: CreateTeacherDto, @CurrentUser() user: JwtPayload) {
        return this.teachersService.create(dto, user);
    }

    @Get()
    @ApiOperation({ summary: 'List all teachers in the current tenant' })
    findAll(@CurrentUser() user: JwtPayload) {
        return this.teachersService.findAll(user);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a teacher by ID (includes assigned classes)' })
    findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.teachersService.findOne(id, user);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a teacher profile (admin only)' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTeacherDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.teachersService.update(id, dto, user);
    }

    @Get(':id/classes')
    @ApiOperation({ summary: 'Get all classes assigned to a teacher' })
    getClasses(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
        return this.teachersService.getClasses(id, user);
    }
}
