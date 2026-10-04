import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [SupabaseModule, NotificationsModule],
    controllers: [NoticesController],
    providers: [NoticesService],
    exports: [NoticesService],
})
export class NoticesModule { }
