import { Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { TenantAnalyticsController } from './modules/tenant-analytics/tenant-analytics.controller';
import { TenantAnalyticsService } from './modules/tenant-analytics/tenant-analytics.service';

@Module({
  imports: [],
  controllers: [TenantAnalyticsController],
  providers: [PrismaService, TenantAnalyticsService, SuperAdminGuard],
})
export class AppModule {}
