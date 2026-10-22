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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { BillingService } from './billing.service';
import { SponsorshipService, AwardGrantDto, RevokeGrantDto } from './sponsorship.service';

import { GenerateBillingSnapshotsDto } from './dto/generate-snapshots.dto';
import { IndividualCheckoutDto } from './dto/individual-checkout.dto';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('billing')
export class BillingController {
    constructor(
        private readonly billingService: BillingService,
        private readonly sponsorshipService: SponsorshipService,
    ) { }

    @Get('snapshots')
    @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'List billing snapshots for a specific month' })
    @ApiQuery({ name: 'billingMonth', required: false, type: String, description: 'Format: YYYY-MM' })
    getSnapshots(@Query() query: GenerateBillingSnapshotsDto) {
        return this.billingService.getBillingSnapshots(query.billingMonth);
    }

    @Post('snapshots/generate')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger manual generation of billing snapshots (Super Admin only)' })
    generateSnapshots(@Body() body: GenerateBillingSnapshotsDto) {
        return this.billingService.generateBillingSnapshots(body.billingMonth);
    }

    @Get('status/:tenantId')
    @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
    @ApiOperation({ summary: 'Check tenant unpaid invoice grace period and lock status' })
    checkInvoiceStatus(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
        return this.billingService.checkTenantInvoiceStatus(tenantId);
    }

    @Post('snapshots/:id/issue')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Issue a DRAFT invoice to finalized ISSUED status (Super Admin only)' })
    issueInvoice(@Param('id', ParseUUIDPipe) id: string) {
        return this.billingService.issueInvoice(id);
    }

    @Post('snapshots/:id/pay')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark an ISSUED/OVERDUE invoice as PAID (Super Admin only)' })
    markPaid(@Param('id', ParseUUIDPipe) id: string) {
        return this.billingService.markInvoicePaid(id);
    }

    @Post('process-overdue')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Transition ISSUED invoices exceeding 14-day payment grace to OVERDUE' })
    processOverdue() {
        return this.billingService.processOverdueInvoices();
    }

    // ─── Sponsorship endpoints ─────────────────────────────────────────────────

    @Post('sponsorship/pools/calculate')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Calculate 10% of net profit into a sponsorship pool for a billing month' })
    calculatePool(
        @Body() body: { billingMonth: string; netProfitLkr: number },
        @CurrentUser() caller: JwtPayload,
    ) {
        return this.sponsorshipService.calculateMonthlyPool(body.billingMonth, body.netProfitLkr, caller);
    }

    @Get('sponsorship/pools')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'List all sponsorship pools (Super Admin only)' })
    listPools(@CurrentUser() caller: JwtPayload) {
        return this.sponsorshipService.listPools(caller);
    }

    @Get('sponsorship/grants')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'List all sponsored grants (Super Admin only)' })
    @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
    listGrants(
        @Query('activeOnly') activeOnly: string,
        @CurrentUser() caller: JwtPayload,
    ) {
        return this.sponsorshipService.listGrants(caller, activeOnly === 'true');
    }

    @Post('sponsorship/grants')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Award a sponsorship grant to a school or independent learner (Super Admin only)' })
    awardGrant(@Body() dto: AwardGrantDto, @CurrentUser() caller: JwtPayload) {
        return this.sponsorshipService.awardGrant(dto, caller);
    }

    @Post('sponsorship/grants/:id/revoke')
    @Roles(UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Revoke an active sponsorship grant (Super Admin only)' })
    revokeGrant(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RevokeGrantDto,
        @CurrentUser() caller: JwtPayload,
    ) {
        return this.sponsorshipService.revokeGrant(id, dto, caller);
    }

    // ─── Individual Learner Checkout & Plans (§7d) ────────────────────────────

    @Get('individual/subscription')
    @Roles(UserRole.INDEPENDENT_LEARNER, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Get current subscription tier, quota allowances, and available upgrade plans' })
    getIndividualSubscription(@CurrentUser() caller: JwtPayload) {
        return this.billingService.getIndividualSubscription(caller);
    }

    @Post('individual/checkout')
    @Roles(UserRole.INDEPENDENT_LEARNER, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Self-service checkout to upgrade individual learner plan (Sandbox Gateway Stub)' })
    processIndividualCheckout(
        @Body() dto: IndividualCheckoutDto,
        @CurrentUser() caller: JwtPayload,
    ) {
        return this.billingService.processIndividualCheckout(dto, caller);
    }
}
