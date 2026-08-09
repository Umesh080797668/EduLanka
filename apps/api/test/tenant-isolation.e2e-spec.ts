/**
 * EduLanka — Tenant Isolation E2E Test
 *
 * Proves that no cross-tenant data leakage occurs between two separate
 * tenant schemas on Supabase Cloud.
 *
 * Requires live Supabase credentials in apps/api/.env:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Run with:
 *   pnpm --filter api run test:e2e -- --testPathPattern=tenant-isolation
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

const SLUG_A = 'e2e-isolation-tenant-a';
const SLUG_B = 'e2e-isolation-tenant-b';
const SCHEMA_A = `tenant_${SLUG_A}`;
const SCHEMA_B = `tenant_${SLUG_B}`;

let admin: any;

const shouldRun = !!SUPABASE_URL && !!SUPABASE_SERVICE_ROLE_KEY;

if (!shouldRun) {
    console.warn('Skipping Tenant Isolation (E2E) test: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

(shouldRun ? describe : describe.skip)('Tenant Isolation (E2E)', () => {
    // ── Setup: provision two disposable test tenants ──────────────────────────

    beforeAll(async () => {
        admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Insert tenant A
        const { error: errA1 } = await admin.from('tenants').insert({
            name: 'E2E Tenant A',
            slug: SLUG_A,
            plan: 'FREE',
            status: 'PROVISIONING',
            school_type: 'TYPE_2',
            contact_email: 'a@e2e.lk',
        });
        if (errA1) throw new Error(`Failed to insert Tenant A: ${errA1.message}`);

        // Provision schema A
        const { error: errA2 } = await admin.rpc('create_tenant_schema', { p_slug: SLUG_A });
        if (errA2) throw new Error(`Schema create failed for A: ${errA2.message}`);

        // Insert tenant B
        const { error: errB1 } = await admin.from('tenants').insert({
            name: 'E2E Tenant B',
            slug: SLUG_B,
            plan: 'FREE',
            status: 'PROVISIONING',
            school_type: 'TYPE_2',
            contact_email: 'b@e2e.lk',
        });
        if (errB1) throw new Error(`Failed to insert Tenant B: ${errB1.message}`);

        // Provision schema B
        const { error: errB2 } = await admin.rpc('create_tenant_schema', { p_slug: SLUG_B });
        if (errB2) throw new Error(`Schema create failed for B: ${errB2.message}`);

        // Wait for PostgREST schema cache to reload
        await new Promise(resolve => setTimeout(resolve, 2000));
    }, 30_000);

    // ── Teardown: destroy both test tenants ───────────────────────────────────

    afterAll(async () => {
        await admin.rpc('drop_tenant_schema', { p_slug: SLUG_A });
        await admin.rpc('drop_tenant_schema', { p_slug: SLUG_B });
        await admin.from('tenants').delete().eq('slug', SLUG_A);
        await admin.from('tenants').delete().eq('slug', SLUG_B);
    }, 30_000);

    // ── Tests ─────────────────────────────────────────────────────────────────

    it('should insert a user into schema A', async () => {
        const { error } = await admin.rpc('exec_sql', {
            sql: `
            INSERT INTO "tenant_${SLUG_A}".users (user_id, tenant_id, email, full_name, role)
            VALUES ('11111111-1111-1111-1111-111111111111', '${SLUG_A}', 'student-a@e2e.lk', 'Student A', 'STUDENT');
        `});
        expect(error).toBeNull();
    });

    it('should NOT see schema A data when querying schema B (isolation proof)', async () => {
        await admin.rpc('exec_sql', {
            sql: `
            CREATE OR REPLACE FUNCTION public.get_tenant_b_users() RETURNS TABLE(email TEXT) AS $fn$
            BEGIN RETURN QUERY SELECT u.email::TEXT FROM "tenant_${SLUG_B}".users u; END;
            $fn$ LANGUAGE plpgsql SECURITY DEFINER;
            NOTIFY pgrst, 'reload schema';
        `});
        await new Promise(r => setTimeout(r, 2000));

        const { data, error } = await admin.rpc('get_tenant_b_users');

        expect(error).toBeNull();
        expect(data).toHaveLength(0);

        await admin.rpc('exec_sql', { sql: 'DROP FUNCTION public.get_tenant_b_users(); NOTIFY pgrst, \'reload schema\';' });
    });

    it('should NOT see schema B data when querying schema A', async () => {
        // Insert something into B first
        const { error: insErr } = await admin.rpc('exec_sql', {
            sql: `
            INSERT INTO "tenant_${SLUG_B}".users (user_id, tenant_id, email, full_name, role)
            VALUES ('22222222-2222-2222-2222-222222222222', '${SLUG_B}', 'student-b@e2e.lk', 'Student B', 'STUDENT');
        `});
        expect(insErr).toBeNull();

        // Now query A
        await admin.rpc('exec_sql', {
            sql: `
            CREATE OR REPLACE FUNCTION public.get_tenant_a_users() RETURNS TABLE(email TEXT) AS $fn$
            BEGIN RETURN QUERY SELECT u.email::TEXT FROM "tenant_${SLUG_A}".users u; END;
            $fn$ LANGUAGE plpgsql SECURITY DEFINER;
            NOTIFY pgrst, 'reload schema';
        `});
        await new Promise(r => setTimeout(r, 2000));

        const { data } = await admin.rpc('get_tenant_a_users');
        const emails = (data ?? []).map((r: { email: string }) => r.email);

        expect(emails).not.toContain('student-b@e2e.lk');
        expect(emails).toContain('student-a@e2e.lk');

        await admin.rpc('exec_sql', { sql: 'DROP FUNCTION public.get_tenant_a_users(); NOTIFY pgrst, \'reload schema\';' });
    });

    it('public.tenants should list both tenants independently', async () => {
        const { data } = await admin
            .from('tenants')
            .select('slug')
            .in('slug', [SLUG_A, SLUG_B]);

        const slugs = (data ?? []).map((r: { slug: string }) => r.slug);
        expect(slugs).toContain(SLUG_A);
        expect(slugs).toContain(SLUG_B);
    });

    it('deleting a user in schema A must not delete users in schema B', async () => {
        await admin.rpc('exec_sql', {
            sql: `
            DELETE FROM "tenant_${SLUG_A}".users WHERE id != '00000000-0000-0000-0000-000000000000';
            
            CREATE OR REPLACE FUNCTION public.get_tenant_b_users() RETURNS TABLE(email TEXT) AS $fn$
            BEGIN RETURN QUERY SELECT u.email::TEXT FROM "tenant_${SLUG_B}".users u; END;
            $fn$ LANGUAGE plpgsql SECURITY DEFINER;
            NOTIFY pgrst, 'reload schema';
        `});
        await new Promise(r => setTimeout(r, 2000));

        const { data, error } = await admin.rpc('get_tenant_b_users');
        if (error) console.error("get_tenant_b_users ERROR:", error);
        const emails = (data ?? []).map((r: { email: string }) => r.email);

        expect(emails).toContain('student-b@e2e.lk');

        await admin.rpc('exec_sql', { sql: 'DROP FUNCTION public.get_tenant_b_users(); NOTIFY pgrst, \'reload schema\';' });
    });
});
