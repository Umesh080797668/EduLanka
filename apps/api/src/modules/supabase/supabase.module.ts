import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SupabaseService } from './supabase.service';

/**
 * Global singleton module that provides the Supabase admin client
 * across the entire NestJS application.
 *
 * Import once at AppModule level — @Global() makes it available everywhere.
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [SupabaseService],
    exports: [SupabaseService],
})
export class SupabaseModule { }
