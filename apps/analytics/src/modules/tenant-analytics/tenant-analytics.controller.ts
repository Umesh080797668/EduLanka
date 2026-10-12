import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../guards/super-admin.guard';
import { TenantAnalyticsService } from './tenant-analytics.service';

@ApiTags('analytics')
@Controller()
@UseGuards(SuperAdminGuard)
export class TenantAnalyticsController {
  constructor(private readonly analyticsService: TenantAnalyticsService) {}

  @Get('tenants/active-students')
  @ApiOperation({ summary: 'Active students per tenant (Phase 3 billing integration)' })
  @ApiQuery({ name: 'billingMonth', required: false })
  getActiveStudents(@Query('billingMonth') billingMonth?: string) {
    return this.analyticsService.getActiveStudents(billingMonth);
  }

  @Get('tenants/sms-usage')
  @ApiOperation({ summary: 'SMS blast usage per tenant' })
  getSmsUsage() {
    return this.analyticsService.getSmsUsage();
  }

  @Get('tenants/storage')
  @ApiOperation({ summary: 'Tenant storage usage vs plan quotas' })
  getStorageUsage() {
    return this.analyticsService.getStorageUsage();
  }

  @Get('sync-health')
  @ApiOperation({ summary: 'Stale device sync telemetry across tenants' })
  @ApiQuery({ name: 'staleDays', required: false, type: Number })
  getSyncHealth(@Query('staleDays') staleDays?: string) {
    const days = staleDays ? parseInt(staleDays, 10) : 3;
    return this.analyticsService.getSyncHealth(days);
  }

  @Get('media/downloads')
  @ApiOperation({ summary: 'Media asset offline downloads and distribution statistics' })
  getMediaDownloads() {
    return this.analyticsService.getMediaDownloads();
  }
}
