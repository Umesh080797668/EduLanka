import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';

@Module({
    imports: [SupabaseModule],
    controllers: [BlogController],
    providers: [BlogService],
    exports: [BlogService],
})
export class BlogModule { }
