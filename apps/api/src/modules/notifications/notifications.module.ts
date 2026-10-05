import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

import { NotificationsGateway } from './notifications.gateway';

@Module({
  imports: [SupabaseModule, JwtModule.register({}), AuthModule],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule { }
