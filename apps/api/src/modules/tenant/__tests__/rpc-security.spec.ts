import * as path from 'path';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';


// Load environment variables from api and web .env files if present
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../../web/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yourproject.supabase.co';
const SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || 'invalid-anon-key-placeholder-wrong-secret';
const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY
    || 'invalid-service-role-key-placeholder-wrong-secret';

const shouldRun =
    !!SUPABASE_URL
    && !SUPABASE_URL.includes('yourproject')
    && !SUPABASE_URL.includes('invalid')
    && !!SUPABASE_SERVICE_ROLE_KEY
    && !SUPABASE_SERVICE_ROLE_KEY.includes('invalid')
    && !!SUPABASE_ANON_KEY
    && !SUPABASE_ANON_KEY.includes('invalid');

if (!shouldRun) {
    console.warn('Skipping RPC Security Isolation test: Live Supabase credentials not found in environment');
}

jest.setTimeout(60000);

async function withRetry<T extends { data?: any; error?: any }>(
    fn: () => PromiseLike<T>,
    retries = 3,
    delayMs = 1000,
): Promise<T> {
    let lastResult: T | undefined;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fn();
            if (!res.error || !res.error.message?.includes('fetch failed')) {
                return res;
            }
            lastResult = res;
        } catch (err: any) {
            if (attempt === retries) throw err;
        }
        await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
    return lastResult!;
}

describe('RPC Security Isolation (Real Database Anon Key Defense)', () => {
    let anonClient: SupabaseClient;
    let serviceClient: SupabaseClient;

    beforeAll(() => {
        anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
    });

    describe('Direct Anon Key PostgREST Execution', () => {
        it('should reject anon caller from executing activate_disaster_mode with 42501 permission denied', async () => {
            const { data, error } = await withRetry(() => anonClient.rpc('activate_disaster_mode', {
                p_tenant_id: '00000000-0000-0000-0000-000000000000',
                p_triggered_by: '00000000-0000-0000-0000-000000000000',
                p_reason: 'FLOOD',
            }));

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function activate_disaster_mode/i);
        });

        it('should reject anon caller from executing deactivate_disaster_mode with 42501 permission denied', async () => {
            const { data, error } = await withRetry(() => anonClient.rpc('deactivate_disaster_mode', {
                p_tenant_id: '00000000-0000-0000-0000-000000000000',
                p_deactivated_by: '00000000-0000-0000-0000-000000000000',
            }));

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function deactivate_disaster_mode/i);
        });

        it('should reject anon caller from executing increment_disaster_sms_count with 42501 permission denied', async () => {
            const { data, error } = await withRetry(() => anonClient.rpc('increment_disaster_sms_count', {
                p_event_id: '00000000-0000-0000-0000-000000000000',
                p_status: 'DELIVERED',
            }));

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function increment_disaster_sms_count/i);
        });

        it('should verify exec_sql has been dropped from database (not found in schema cache)', async () => {
            const { data, error } = await withRetry(() => anonClient.rpc('exec_sql', {
                sql: 'SELECT 1;',
            }));

            expect(data).toBeNull();
            expect(error).toBeDefined();
            // PGRST202 or message indicates function does not exist in PostgREST schema cache
            expect(
                ['PGRST202', '42883'].includes(error?.code || '') ||
                /could not find the function.*exec_sql/i.test(error?.message || '')
            ).toBe(true);
        });

        it('should reject anon caller from selecting from security_invoker view tenant_sms_quotas', async () => {
            const { data, error } = await withRetry(() => anonClient.from('tenant_sms_quotas').select('*'));

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for view tenant_sms_quotas/i);
        });
    });

    describe('Service Role Allowed Execution (Definer Privilege Verification)', () => {
        it('should permit service_role to call activate_disaster_mode without 42501 permission denied', async () => {
            const { error } = await withRetry(() => serviceClient.rpc('activate_disaster_mode', {
                p_tenant_id: '00000000-0000-0000-0000-000000000000',
                p_triggered_by: '00000000-0000-0000-0000-000000000000',
                p_reason: 'FLOOD',
            }));

            // May throw TENANT_NOT_FOUND (P0002), but must NOT fail with 42501 permission denied
            if (error) {
                expect(error.code).not.toBe('42501');
                expect(error.message).not.toMatch(/permission denied/i);
            }
        });

        it('should permit service_role to call deactivate_disaster_mode without 42501 permission denied', async () => {
            const { error } = await withRetry(() => serviceClient.rpc('deactivate_disaster_mode', {
                p_tenant_id: '00000000-0000-0000-0000-000000000000',
                p_deactivated_by: '00000000-0000-0000-0000-000000000000',
            }));

            // May throw TENANT_NOT_FOUND (P0002) or DISASTER_NOT_ACTIVE, but must NOT fail with 42501 permission denied
            if (error) {
                expect(error.code).not.toBe('42501');
                expect(error.message).not.toMatch(/permission denied/i);
            }
        });

        it('should verify service_role cannot call dropped exec_sql (PGRST202)', async () => {
            const { data, error } = await withRetry(() => serviceClient.rpc('exec_sql', {
                sql: 'SELECT 1;',
            }));

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(
                ['PGRST202', '42883'].includes(error?.code || '') ||
                /could not find the function.*exec_sql/i.test(error?.message || '')
            ).toBe(true);
        });
    });
});
