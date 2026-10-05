import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';

import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';


@Module({
  imports: [SupabaseModule, JwtModule.register({}), AuthModule],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
  // ClassesModule keeps class group rosters in sync through ChatService.
  exports: [ChatService]
})
export class ChatModule { }
