import type { JwtPayload } from '@edu-lanka/shared-types';
import { SchoolType, TenantPlan } from '@edu-lanka/shared-types';
import {
    Controller,
    Get,
    Post,
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
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { TenantService } from './tenant.service';

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

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantController {
    constructor(private readonly tenantService: TenantService) { }

    /**
     * POST /api/v1/tenants
     * Provision a new school tenant. Super-admin only.
     */
    @Post()
    @Version('1')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Provision a new school tenant' })
    @ApiCreatedResponse({ description: 'Tenant created' })
    create(@Body() dto: CreateTenantDto, @CurrentUser() user: JwtPayload) {
        return this.tenantService.create(dto, user);
    }

    /**
     * GET /api/v1/tenants/:id
     * Retrieve a tenant by UUID. Scoped to caller's tenantId.
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
}
