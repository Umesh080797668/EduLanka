import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppVersionGuard } from '../../common/guards/app-version.guard';
import { SmsModule } from '../sms/sms.module';
import { SupabaseModule } from '../supabase/supabase.module';

import { FcmProcessor } from './fcm.processor';
import { MobileDisasterService } from './mobile-disaster.service';
import { MobilePushService } from './mobile-push.service';
import { MobileReleaseService } from './mobile-release.service';
import { MobileSyncService } from './mobile-sync.service';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { SyncMaintenanceService } from './sync-maintenance.service';

@Module({
    imports: [
        SupabaseModule,
        SmsModule,
        BullModule.registerQueue({
            name: 'fcm-push',
        }),
    ],
    controllers: [MobileController],
    providers: [
        MobileSyncService,
        MobilePushService,
        MobileDisasterService,
        MobileReleaseService,
        MobileService,
        AppVersionGuard,
        FcmProcessor,
        SyncMaintenanceService,
    ],
    exports: [
        MobileSyncService,
        MobilePushService,
        MobileDisasterService,
        MobileReleaseService,
        MobileService,
        AppVersionGuard,
        SyncMaintenanceService,
    ],
})
export class MobileModule {}
