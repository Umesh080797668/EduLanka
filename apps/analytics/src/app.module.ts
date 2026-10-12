import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma/prisma.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { TenantAnalyticsController } from './modules/tenant-analytics/tenant-analytics.controller';
import { TenantAnalyticsService } from './modules/tenant-analytics/tenant-analytics.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'edulanka-jwt-secret-dev-super-key',
    }),
  ],
  controllers: [TenantAnalyticsController],
  providers: [
    PrismaService,
    TenantAnalyticsService,
    JwtStrategy,
    JwtAuthGuard,
    SuperAdminGuard,
  ],
  exports: [JwtAuthGuard, SuperAdminGuard],
})
export class AppModule {}
