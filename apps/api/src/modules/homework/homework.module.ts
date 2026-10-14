import { Module } from '@nestjs/common';

import { SupabaseModule } from '../supabase/supabase.module';

import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';

@Module({
    imports: [SupabaseModule],
    controllers: [HomeworkController],
    providers: [HomeworkService],
    exports: [HomeworkService],
})
export class HomeworkModule { }
