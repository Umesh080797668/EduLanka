import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SmsModule } from '../sms/sms.module';
import { SupabaseModule } from '../supabase/supabase.module';

import { FcmProcessor } from './fcm.processor';
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
    providers: [MobileService, FcmProcessor, SyncMaintenanceService],
    exports: [MobileService, SyncMaintenanceService],
})
export class MobileModule {}
