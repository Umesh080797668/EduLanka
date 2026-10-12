import type { JwtPayload } from '@edu-lanka/shared-types';
import { UserRole } from '@edu-lanka/shared-types';
import {
    Controller,
    Post,
    Get,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { AppVersionGuard } from '../../common/guards/app-version.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';

import {
    RegisterDeviceTokenDto,
    AppendSyncEventDto,
    TriggerDisasterPushDto,
    UpsertEmergencyContactDto,
    UpsertShelterDto,
    UpdateMobileVersionDto,
} from './dto/mobile.dto';
import { MobileService } from './mobile.service';

@ApiTags('mobile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, AppVersionGuard)
@Controller('mobile')
export class MobileController {
    constructor(private readonly mobileService: MobileService) { }

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

    @Get('public-key')
    @ApiOperation({ summary: 'Get server public key for offline entitlement license verification' })
    getPublicKey() {
        return {
            kid: this.mobileService.getKeyId(),
            algorithm: 'Ed25519',
            publicKey: this.mobileService.getPublicKeyPem(),
        };
    }

    @Get('snapshot')
    @ApiOperation({ summary: 'Re-hydrate state via full snapshot when client is beyond retention window' })
    getSnapshot(@CurrentUser() user: JwtPayload) {
        return this.mobileService.getSnapshot(user);
    }

    @Post('test-disaster-push')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Trigger an emergency Disaster Mode push notification to tenant devices' })
    triggerDisasterPush(@Body() dto: TriggerDisasterPushDto, @CurrentUser() user: JwtPayload) {
        return this.mobileService.triggerDisasterPush(dto, user);
    }

    @Get('version')
    @ApiOperation({ summary: 'Returns minimum supported mobile app version and release metadata (P3-S1)' })
    @ApiQuery({ name: 'platform', required: false, enum: ['android', 'ios', 'all'], description: 'Platform target' })
    getVersion(@Query('platform') platform?: string) {
        return this.mobileService.getVersion(platform);
    }

    @Put('version')
    @Roles(UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Update mobile app release and min supported version (P3-S9)' })
    updateVersion(
        @CurrentUser() user: JwtPayload,
        @Body() dto: UpdateMobileVersionDto,
    ) {
        return this.mobileService.updateVersion(user, dto);
    }

    @Get('sync-health')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Query sync health metrics and stale devices for School Admin (P3-S3)' })
    getSyncHealth(@CurrentUser() user: JwtPayload) {
        return this.mobileService.getSyncHealth(user);
    }

    @Get('emergency-contacts')
    @ApiOperation({ summary: 'List school emergency contacts for disaster pack (P3-S8)' })
    getEmergencyContacts(@CurrentUser() user: JwtPayload) {
        return this.mobileService.getEmergencyContacts(user);
    }

    @Post('emergency-contacts')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Upsert school emergency contact (P3-S8)' })
    upsertEmergencyContact(
        @CurrentUser() user: JwtPayload,
        @Body() contact: UpsertEmergencyContactDto,
    ) {
        return this.mobileService.upsertEmergencyContact(user, contact);
    }

    @Delete('emergency-contacts/:id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Delete school emergency contact (P3-S8)' })
    deleteEmergencyContact(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.mobileService.deleteEmergencyContact(user, id);
    }

    @Get('shelters')
    @ApiOperation({ summary: 'List school emergency evacuation shelters (P3-S8)' })
    getShelters(@CurrentUser() user: JwtPayload) {
        return this.mobileService.getShelters(user);
    }

    @Post('shelters')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Upsert school emergency evacuation shelter (P3-S8)' })
    upsertShelter(
        @CurrentUser() user: JwtPayload,
        @Body() shelter: UpsertShelterDto,
    ) {
        return this.mobileService.upsertShelter(user, shelter);
    }

    @Delete('shelters/:id')
    @Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
    @ApiOperation({ summary: 'Delete school emergency evacuation shelter (P3-S8)' })
    deleteShelter(
        @CurrentUser() user: JwtPayload,
        @Param('id') id: string,
    ) {
        return this.mobileService.deleteShelter(user, id);
    }
}
