import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';

import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';

@Module({
    imports: [SupabaseModule],
    controllers: [MobileController],
    providers: [MobileService],
    exports: [MobileService],
})
export class MobileModule {}
