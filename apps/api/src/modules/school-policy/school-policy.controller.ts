// =============================================================================
// School Policy Controller
// =============================================================================
import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@edu-lanka/shared-types';
import { SchoolPolicyService } from './school-policy.service';
import { UpdatePolicyDto } from './dto/policy.dto';

@ApiTags('school-policy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('school-policy')
export class SchoolPolicyController {
    constructor(private readonly policyService: SchoolPolicyService) { }

    @Get()
    @ApiOperation({ summary: 'Get the current school policy settings' })
    getPolicy(@CurrentUser() user: JwtPayload) {
        return this.policyService.getPolicy(user);
    }

    @Patch()
    @ApiOperation({ summary: 'Update school policy settings (admin only)' })
    updatePolicy(@Body() dto: UpdatePolicyDto, @CurrentUser() user: JwtPayload) {
        return this.policyService.updatePolicy(dto, user);
    }
}
