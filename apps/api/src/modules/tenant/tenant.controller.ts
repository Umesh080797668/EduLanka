import type { JwtPayload } from '@edu-lanka/shared-types';
import { SchoolType, TenantPlan, TenantStatus } from '@edu-lanka/shared-types';
import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    ParseUUIDPipe,
    UseGuards,
    Version,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiOkResponse,
} from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
} from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantService } from './tenant.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export class CreateTenantDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsString()
    @IsNotEmpty()
    slug!: string;

    @IsEnum(SchoolType)
    schoolType!: SchoolType;

    @IsEmail()
    contactEmail!: string;

    @IsEnum(TenantPlan)
    @IsOptional()
    plan?: TenantPlan;
}

export class UpdateTenantStatusDto {
    @IsEnum(TenantStatus)
    status!: TenantStatus;

    @IsString()
    @IsOptional()
    deactivationReason?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('tenants')
export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    /**
     * POST /api/v1/tenants
     * Provision a new school tenant — SUPER_ADMIN only.
     */
    @Post()
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Provision a new school tenant (super admin only)' })
    @ApiCreatedResponse({ description: 'Tenant created and schema provisioned' })
    create(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtPayload) {
        return this.tenantService.create(dto, user);
    }

    /**
     * GET /api/v1/tenants/stats
     * Get aggregate statistics for the current tenant.
     */
    @Get('stats')
    @Version('1')
    @ApiOperation({ summary: 'Get statistics for the current school' })
    @ApiOkResponse({ description: 'Stats object' })
    getStats(@CurrentUser() user: JwtPayload) {
        return this.tenantService.getStats(user);
    }

    /**
     * GET /api/v1/tenants
     * List all tenants — SUPER_ADMIN only.
     */
    @Get()
    @Version('1')
    @ApiOperation({ summary: 'List all tenants (super admin only)' })
    @ApiOkResponse({ description: 'Array of tenant records' })
    listAll(@CurrentUser() user: JwtPayload) {
        return this.tenantService.listAll(user);
    }

    /**
     * GET /api/v1/tenants/:id
     * Retrieve a tenant by UUID — scoped to caller's tenantId.
     */
    @Get(':id')
    @Version('1')
    @ApiOperation({ summary: 'Get tenant by ID' })
    @ApiOkResponse({ description: 'Tenant record' })
    findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.tenantService.findOneById(id, user);
    }

    /**
     * PATCH /api/v1/tenants/:id/status
     * Update lifecycle status — SUPER_ADMIN only.
     */
    @Patch(':id/status')
    @Version('1')
    @ApiOperation({ summary: 'Update tenant status (super admin only)' })
    @ApiOkResponse({ description: 'Updated tenant record' })
    updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateTenantStatusDto,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.tenantService.updateStatus(id, dto, user);
    }
}
