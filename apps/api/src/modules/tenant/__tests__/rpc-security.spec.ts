import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

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

jest.setTimeout(25000);

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
            const { data, error } = await anonClient.rpc('activate_disaster_mode', {
                p_tenant_id: '00000000-0000-0000-0000-000000000000',
                p_triggered_by: '00000000-0000-0000-0000-000000000000',
                p_reason: 'FLOOD',
            });

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function activate_disaster_mode/i);
        });

        it('should reject anon caller from executing deactivate_disaster_mode with 42501 permission denied', async () => {
            const { data, error } = await anonClient.rpc('deactivate_disaster_mode', {
                p_tenant_id: '00000000-0000-0000-0000-000000000000',
                p_deactivated_by: '00000000-0000-0000-0000-000000000000',
            });

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function deactivate_disaster_mode/i);
        });

        it('should reject anon caller from executing increment_disaster_sms_count with 42501 permission denied', async () => {
            const { data, error } = await anonClient.rpc('increment_disaster_sms_count', {
                p_event_id: '00000000-0000-0000-0000-000000000000',
                p_status: 'DELIVERED',
            });

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function increment_disaster_sms_count/i);
        });

        it('should reject anon caller from executing exec_sql with 42501 permission denied', async () => {
            const { data, error } = await anonClient.rpc('exec_sql', {
                sql: 'SELECT 1;',
            });

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for function exec_sql/i);
        });

        it('should reject anon caller from selecting from security_invoker view tenant_sms_quotas', async () => {
            const { data, error } = await anonClient.from('tenant_sms_quotas').select('*');

            expect(data).toBeNull();
            expect(error).toBeDefined();
            expect(error?.code).toBe('42501');
            expect(error?.message).toMatch(/permission denied for view tenant_sms_quotas/i);
        });
    });

    describe('PostgreSQL Function Privileges Verification (has_function_privilege)', () => {
        const functionsToCheck = [
            'public.activate_disaster_mode(uuid,uuid,text,text,timestamptz)',
            'public.deactivate_disaster_mode(uuid,uuid,text)',
            'public.increment_disaster_sms_count(uuid,text)',
            'public.exec_sql(text)',
        ];

        for (const fn of functionsToCheck) {
            it(`should verify anon has NO execute privilege on ${fn}`, async () => {
                const { error } = await serviceClient.rpc('exec_sql', {
                    sql: `DO $$ BEGIN IF has_function_privilege('anon', '${fn}', 'EXECUTE') THEN RAISE EXCEPTION 'LEAKED: anon has EXECUTE on ${fn}'; END IF; END $$;`,
                });
                expect(error).toBeNull();
            });

            it(`should verify authenticated has NO execute privilege on ${fn}`, async () => {
                const { error } = await serviceClient.rpc('exec_sql', {
                    sql: `DO $$ BEGIN IF has_function_privilege('authenticated', '${fn}', 'EXECUTE') THEN RAISE EXCEPTION 'LEAKED: authenticated has EXECUTE on ${fn}'; END IF; END $$;`,
                });
                expect(error).toBeNull();
            });

            it(`should verify service_role HAS execute privilege on ${fn}`, async () => {
                const { error } = await serviceClient.rpc('exec_sql', {
                    sql: `DO $$ BEGIN IF NOT has_function_privilege('service_role', '${fn}', 'EXECUTE') THEN RAISE EXCEPTION 'MISSING: service_role lacks EXECUTE on ${fn}'; END IF; END $$;`,
                });
                expect(error).toBeNull();
            });
        }
    });
});
