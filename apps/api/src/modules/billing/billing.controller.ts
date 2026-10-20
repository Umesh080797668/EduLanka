import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@edu-lanka/shared-types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BillingService } from './billing.service';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
    constructor(private readonly billingService: BillingService) { }

    @Get('snapshots')
    @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'List billing snapshots for a specific month' })
    @ApiQuery({ name: 'billingMonth', required: false, type: String, description: 'Format: YYYY-MM' })
    getSnapshots(@Query('billingMonth') billingMonth?: string) {
        return this.billingService.getBillingSnapshots(billingMonth);
    }

    @Post('snapshots/generate')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger manual generation of billing snapshots (Super Admin only)' })
    generateSnapshots(@Body() body: { billingMonth?: string }) {
        return this.billingService.generateBillingSnapshots(body?.billingMonth);
    }

    @Get('status/:tenantId')
    @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Check tenant unpaid invoice grace period and lock status' })
    checkInvoiceStatus(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
        return this.billingService.checkTenantInvoiceStatus(tenantId);
    }
}
