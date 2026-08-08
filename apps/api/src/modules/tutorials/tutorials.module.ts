import { Module } from '@nestjs/common';
import { TutorialsController } from './tutorials.controller';
import { TutorialsService } from './tutorials.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [TutorialsController],
    providers: [TutorialsService],
    exports: [TutorialsService],
})
export class TutorialsModule { }
