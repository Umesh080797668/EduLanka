import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';

import { FcmProcessor } from './fcm.processor';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
    imports: [
        SupabaseModule,
        BullModule.registerQueue({
            name: 'fcm-push',
        }),
    ],
    controllers: [MobileController],
    providers: [MobileService, FcmProcessor],
    exports: [MobileService],
})
export class MobileModule {}
