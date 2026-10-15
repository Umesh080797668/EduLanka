import type { JwtPayload } from '@edu-lanka/shared-types';
import { Injectable } from '@nestjs/common';

import type {
    RegisterDeviceTokenDto,
    AppendSyncEventDto,
    TriggerDisasterPushDto,
    UpsertEmergencyContactDto,
    UpsertShelterDto,
    UpdateMobileVersionDto,
} from './dto/mobile.dto';
import { MobileDisasterService } from './mobile-disaster.service';
import { MobilePushService } from './mobile-push.service';
import { MobileReleaseService } from './mobile-release.service';
import { MobileSyncService } from './mobile-sync.service';

/**
 * MobileService acts as the unified facade aggregating the four specialized mobile sub-services:
 * - MobileSyncService: Monotonic sync events, snapshots, sync health, and Ed25519 offline license.
 * - MobilePushService: FCM device token registration and push job dispatch.
 * - MobileDisasterService: Disaster mode bundles, push broadcasts, emergency contacts & evacuation shelters.
 * - MobileReleaseService: Version enforcement, SemVer checks, and platform release metadata.
 */
@Injectable()
export class MobileService {
    // Static delegators for backward compatibility with testing suites
    public static get keyId(): string {
        return MobileSyncService.keyId;
    }

    public static get signingKeyPair() {
        return MobileSyncService.signingKeyPair;
    }

    public static set signingKeyPair(val) {
        MobileSyncService.signingKeyPair = val;
    }

    public static getSigningKeyPair() {
        return MobileSyncService.getSigningKeyPair();
    }

    constructor(
        private readonly syncService: MobileSyncService,
        private readonly pushService: MobilePushService,
        private readonly disasterService: MobileDisasterService,
        private readonly releaseService: MobileReleaseService,
    ) {}

    getKeyId(): string {
        return this.syncService.getKeyId();
    }

    getPublicKeyPem(): string {
        return this.syncService.getPublicKeyPem();
    }

    registerDeviceToken(dto: RegisterDeviceTokenDto, caller: JwtPayload) {
        return this.pushService.registerDeviceToken(dto, caller);
    }

    touchDeviceActivity(tenantId: string, userId: string, acknowledgedSequence?: number, deviceIdOrToken?: string) {
        return this.syncService.touchDeviceActivity(tenantId, userId, acknowledgedSequence, deviceIdOrToken);
    }

    appendSyncEvent(dto: AppendSyncEventDto, caller: JwtPayload, deviceIdOrToken?: string) {
        return this.syncService.appendSyncEvent(dto, caller, deviceIdOrToken);
    }

    getSyncEvents(caller: JwtPayload, sinceSequence = 0, limit = 50, deviceIdOrToken?: string) {
        return this.syncService.getSyncEvents(caller, sinceSequence, limit, deviceIdOrToken);
    }

    getOfflineLicense(caller: JwtPayload) {
        return this.syncService.getOfflineLicense(caller);
    }

    getSnapshot(caller: JwtPayload, deviceIdOrToken?: string) {
        return this.syncService.getSnapshot(caller, deviceIdOrToken);
    }

    getDisasterPack(caller: JwtPayload, deviceIdOrToken?: string) {
        return this.disasterService.getDisasterPack(caller, deviceIdOrToken);
    }

    triggerDisasterPush(dto: TriggerDisasterPushDto, caller: JwtPayload) {
        return this.disasterService.triggerDisasterPush(dto, caller);
    }

    getVersion(platform?: string) {
        return this.releaseService.getVersion(platform);
    }

    updateVersion(caller: JwtPayload, dto: UpdateMobileVersionDto) {
        return this.releaseService.updateVersion(caller, dto);
    }

    getSyncHealth(caller: JwtPayload) {
        return this.syncService.getSyncHealth(caller);
    }

    getEmergencyContacts(caller: JwtPayload) {
        return this.disasterService.getEmergencyContacts(caller);
    }

    upsertEmergencyContact(caller: JwtPayload, contact: UpsertEmergencyContactDto) {
        return this.disasterService.upsertEmergencyContact(caller, contact);
    }

    deleteEmergencyContact(caller: JwtPayload, id: string) {
        return this.disasterService.deleteEmergencyContact(caller, id);
    }

    getShelters(caller: JwtPayload) {
        return this.disasterService.getShelters(caller);
    }

    upsertShelter(caller: JwtPayload, shelter: UpsertShelterDto) {
        return this.disasterService.upsertShelter(caller, shelter);
    }

    deleteShelter(caller: JwtPayload, id: string) {
        return this.disasterService.deleteShelter(caller, id);
    }
}
