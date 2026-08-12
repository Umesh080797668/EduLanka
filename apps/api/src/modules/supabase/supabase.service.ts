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
     * Sprint 7 Architecture: Returns a proxied service-role client.
     * All .from('table') queries natively automatically inject .eq('tenant_id', tenantId)
     * enforcing Data Partitioning at the Node.js layer seamlessly.
     *
     * @param tenantId - tenant UUID, e.g. a1b2c3d4...
     */
    getTenantClient(tenantId: string): AnySupabaseClient {
        // Return a perfectly invisible proxy wrapping the admin client
        return new Proxy(this._adminClient, {
            get(target, prop, receiver) {
                if (prop === 'from') {
                    // Intercept the .from('...') call
                    return (table: string) => {
                        const queryBuilder = (target as any).from(table);
                        const tableStr = String(table);

                        // If the table is literally `tenants` or global registry, don't partition it!
                        if (tableStr === 'tenants' || tableStr === 'plans' || tableStr === 'platform_admins' || tableStr === 'tutorials') {
                            return queryBuilder;
                        }

                        // Otherwise we hook into select, update, delete intelligently
                        const methods = ['select', 'update', 'delete'];
                        for (const method of methods) {
                            const original = queryBuilder[method];
                            if (typeof original === 'function') {
                                queryBuilder[method] = function (...args: any[]) {
                                    return original.apply(this, args).eq('tenant_id', tenantId);
                                };
                            }
                        }

                        return queryBuilder;
                    };
                }
                return Reflect.get(target, prop, receiver);
            }
        }) as AnySupabaseClient;
    }
}
