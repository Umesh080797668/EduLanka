import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';

import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
    imports: [SupabaseModule, NotificationsModule],
    controllers: [NoticesController],
    providers: [NoticesService],
    exports: [NoticesService],
})
export class NoticesModule { }
