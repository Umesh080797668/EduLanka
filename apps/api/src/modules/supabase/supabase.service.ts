import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { UUID_HEX_REGEX } from '../../common/decorators/is-uuid-string.decorator';
import type { AppConfiguration } from '../../config/configuration';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

export function assertUuid(id: string, paramName = 'tenantId'): void {
    if (!id || typeof id !== 'string' || !UUID_HEX_REGEX.test(id.trim())) {
        throw new BadRequestException(`${paramName} must be a valid UUID format (8-4-4-4-12 hex string), received: "${id}"`);
    }
}

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
     * Returns an isolated Supabase client for password authentication.
     * Prevents mutating the singleton adminClient's session state.
     */
    createAuthClient(): AnySupabaseClient {
        const url = this.configService.get('supabase.url', { infer: true })!;
        const key = this.configService.get('supabase.serviceRoleKey', { infer: true })!;
        return createClient(url, key, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }) as AnySupabaseClient;
    }

    /**
     * Sprint 7 Architecture: Returns a proxied service-role client.
     * All .from('table') queries natively automatically inject .eq('tenant_id', tenantId)
     * enforcing Data Partitioning at the Node.js layer seamlessly.
     *
     * @param tenantId - tenant UUID, e.g. a1b2c3d4...
     */
    getTenantClient(tenantId: string): AnySupabaseClient {
        assertUuid(tenantId, 'tenantId');

        // Return a perfectly invisible proxy wrapping the admin client
        return new Proxy(this._adminClient, {
            get(target, prop, receiver) {
                if (prop === 'from') {
                    // Intercept the .from('...') call
                    return (table: string) => {
                        const queryBuilder = (target as any).from(table);
                        const tableStr = String(table);

                        // If the table is literally `tenants`, global registry, or scoped join table without tenant_id, don't partition it!
                        if (
                            tableStr === 'tenants' ||
                            tableStr === 'plans' ||
                            tableStr === 'platform_admins' ||
                            tableStr === 'tutorials' ||
                            tableStr === 'notice_reads'
                        ) {
                            return queryBuilder;
                        }

                        // Hook into select, update, delete intelligently
                        const filterMethods = ['select', 'update', 'delete'];
                        for (const method of filterMethods) {
                            const original = queryBuilder[method];
                            if (typeof original === 'function') {
                                queryBuilder[method] = function (...args: any[]) {
                                    return original.apply(this, args).eq('tenant_id', tenantId);
                                };
                            }
                        }

                        // Scope insert and upsert so tenant_id is enforced
                        const writeMethods = ['insert', 'upsert'];
                        for (const method of writeMethods) {
                            const original = queryBuilder[method];
                            if (typeof original === 'function') {
                                queryBuilder[method] = function (values: any, ...args: any[]) {
                                    let scopedValues = values;
                                    if (Array.isArray(values)) {
                                        scopedValues = values.map((v) =>
                                            v && typeof v === 'object' ? { ...v, tenant_id: tenantId } : v,
                                        );
                                    } else if (values && typeof values === 'object') {
                                        scopedValues = { ...values, tenant_id: tenantId };
                                    }
                                    return original.call(this, scopedValues, ...args);
                                };
                            }
                        }

                        return queryBuilder;
                    };
                }

                if (prop === 'rpc') {
                    // Intercept .rpc('fn', args, options) to inject tenant_id parameter
                    return (fnName: string, args: Record<string, any> = {}, options?: any) => {
                        const scopedArgs = typeof args === 'object' && args !== null ? { ...args } : {};
                        if (scopedArgs.p_tenant_id === undefined && scopedArgs.tenant_id === undefined) {
                            scopedArgs.p_tenant_id = tenantId;
                        }
                        return (target as any).rpc(fnName, scopedArgs, options);
                    };
                }

                return Reflect.get(target, prop, receiver);
            },
        });
    }
}

