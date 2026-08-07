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

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const SUPABASE_URL = process.env['SUPABASE_URL'] ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

const SLUG_A = 'e2e-isolation-tenant-a';
const SLUG_B = 'e2e-isolation-tenant-b';
const SCHEMA_A = `tenant_${SLUG_A}`;
const SCHEMA_B = `tenant_${SLUG_B}`;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

describe('Tenant Isolation (E2E)', () => {
    // ── Setup: provision two disposable test tenants ──────────────────────────

    beforeAll(async () => {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error(
                'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for E2E tests'
            );
        }

        // Insert tenant A
        await admin.from('tenants').insert({
            name: 'E2E Tenant A',
            slug: SLUG_A,
            plan: 'FREE',
            status: 'PROVISIONING',
            school_type: 'TYPE_2',
            contact_email: 'a@e2e.lk',
        });
        // Provision schema A
        await admin.rpc('create_tenant_schema', { p_slug: SLUG_A });

        // Insert tenant B
        await admin.from('tenants').insert({
            name: 'E2E Tenant B',
            slug: SLUG_B,
            plan: 'FREE',
            status: 'PROVISIONING',
            school_type: 'TYPE_2',
            contact_email: 'b@e2e.lk',
        });
        // Provision schema B
        await admin.rpc('create_tenant_schema', { p_slug: SLUG_B });
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
        const clientA = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: SCHEMA_A },
        });

        const { error } = await clientA.from('users').insert({
            email: 'student-a@e2e.lk',
            full_name: 'Student A',
            role: 'STUDENT',
        });

        expect(error).toBeNull();
    });

    it('should NOT see schema A data when querying schema B (isolation proof)', async () => {
        const clientB = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: SCHEMA_B },
        });

        const { data, error } = await clientB.from('users').select('*');

        expect(error).toBeNull();
        // Schema B should have zero users — the student inserted into A is invisible here
        expect(data).toHaveLength(0);
    });

    it('should NOT see schema B data when querying schema A', async () => {
        // Insert something into B first
        const clientB = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: SCHEMA_B },
        });
        await clientB.from('users').insert({
            email: 'student-b@e2e.lk',
            full_name: 'Student B',
            role: 'STUDENT',
        });

        // Now query A — should not see B's student
        const clientA = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: SCHEMA_A },
        });

        const { data } = await clientA.from('users').select('email');
        const emails = (data ?? []).map((r: { email: string }) => r.email);

        expect(emails).not.toContain('student-b@e2e.lk');
        expect(emails).toContain('student-a@e2e.lk');
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
        const clientA = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: SCHEMA_A },
        });

        // Delete all users from A
        await clientA.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // B's student should still be present
        const clientB = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
            db: { schema: SCHEMA_B },
        });
        const { data } = await clientB.from('users').select('email');
        const emails = (data ?? []).map((r: { email: string }) => r.email);
        expect(emails).toContain('student-b@e2e.lk');
    });
});
