import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { ChatModule } from '../chat/chat.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
    imports: [SupabaseModule, TenantModule, ChatModule],
    controllers: [StudentsController],
    providers: [StudentsService],
    exports: [StudentsService],
})
export class StudentsModule { }
