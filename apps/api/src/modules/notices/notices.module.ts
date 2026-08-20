import { Module } from '@nestjs/common';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [NoticesController],
    providers: [NoticesService],
    exports: [NoticesService],
})
export class NoticesModule { }
