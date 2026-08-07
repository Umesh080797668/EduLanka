import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import type { AppConfiguration } from '../../config/configuration';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

/**
 * Wraps a Supabase service-role client (full DB access, bypasses RLS).
 * All writes from the NestJS API go through this client; RLS is the
 * per-row safety net for any direct client queries.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
    private readonly logger = new Logger(SupabaseService.name);
    private _adminClient!: AnySupabaseClient;

    constructor(
        private readonly configService: ConfigService<AppConfiguration>,
    ) { }

    onModuleInit(): void {
        const url = this.configService.get('supabase.url', { infer: true })!;
        const key = this.configService.get('supabase.serviceRoleKey', { infer: true })!;

        this._adminClient = createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            db: { schema: 'public' },
        }) as AnySupabaseClient;

        this.logger.log('Supabase admin client initialised');
    }

    /**
     * Service-role client scoped to the `public` schema.
     * Use for tenant registry reads/writes.
     */
    get adminClient(): AnySupabaseClient {
        return this._adminClient;
    }

    /**
     * Returns a service-role client scoped to a specific tenant schema.
     * Schema: `tenant_<slug>` — queries run in the correct Postgres schema.
     *
     * @param slug - tenant slug, e.g. 'dev-school'
     */
    getTenantClient(slug: string): AnySupabaseClient {
        const url = this.configService.get('supabase.url', { infer: true })!;
        const key = this.configService.get('supabase.serviceRoleKey', { infer: true })!;

        // Cast via unknown to bypass the schema generic mismatch —
        // Supabase's .db.schema is typed as 'public' by default but we
        // need a runtime-variable schema name. This is safe: the JS
        // runtime uses the string directly; generics are compile-only.
        return createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
            db: { schema: `tenant_${slug}` as 'public' },
        }) as AnySupabaseClient;
    }
}
