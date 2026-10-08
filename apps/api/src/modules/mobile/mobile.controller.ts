import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller,
    Post,
    Get,
    Body,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import { RegisterDeviceTokenDto, AppendSyncEventDto, TriggerDisasterPushDto } from './dto/mobile.dto';
import { MobileService } from './mobile.service';

@ApiTags('mobile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Controller('mobile')
export class MobileController {
    constructor(private readonly mobileService: MobileService) {}

    @Post('device-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Register or refresh an FCM device push token' })
    registerDeviceToken(@Body() dto: RegisterDeviceTokenDto, @CurrentUser() user: JwtPayload) {
        return this.mobileService.registerDeviceToken(dto, user);
    }

    @Post('sync-events')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Ingest an offline sync event into monotonic event stream' })
    appendSyncEvent(@Body() dto: AppendSyncEventDto, @CurrentUser() user: JwtPayload) {
        return this.mobileService.appendSyncEvent(dto, user);
    }

    @Get('sync-events')
    @ApiOperation({ summary: 'Pull sync events for the tenant since given sequence' })
    @ApiQuery({ name: 'since', required: false, type: Number, description: 'Last acknowledged sequence number' })
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of events to return (1-200)' })
    getSyncEvents(
        @Query('since') since: string | undefined,
        @Query('limit') limit: string | undefined,
        @CurrentUser() user: JwtPayload,
    ) {
        const sinceSeq = since ? parseInt(since, 10) : 0;
        const pageLimit = limit ? parseInt(limit, 10) : 50;
        return this.mobileService.getSyncEvents(
            user,
            isNaN(sinceSeq) ? 0 : sinceSeq,
            isNaN(pageLimit) ? 50 : pageLimit,
        );
    }

    @Get('disaster-pack')
    @ApiOperation({ summary: 'Download offline emergency disaster pack bundle' })
    getDisasterPack(@CurrentUser() user: JwtPayload) {
        return this.mobileService.getDisasterPack(user);
    }

    @Get('offline-license')
    @ApiOperation({ summary: 'Issue cryptographically signed offline entitlement license record' })
    getOfflineLicense(@CurrentUser() user: JwtPayload) {
        return this.mobileService.getOfflineLicense(user);
    }

    @Post('test-disaster-push')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger an emergency Disaster Mode push notification to tenant devices' })
    triggerDisasterPush(@Body() dto: TriggerDisasterPushDto, @CurrentUser() user: JwtPayload) {
        return this.mobileService.triggerDisasterPush(dto, user);
    }
}
