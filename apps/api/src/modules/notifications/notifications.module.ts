import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [SupabaseModule, JwtModule.register({})],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule { }
