import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule { }
