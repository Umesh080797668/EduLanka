#!/usr/bin/env ts-node
/**
 * EduLanka — Cross-Tenant Migration Tool
 *
 * Applies a SQL file against every ACTIVE tenant schema.
 *
 * Usage:
 *   pnpm --filter api run migrate:tenants -- --file=<path-to-sql>
 *
 * Example:
 *   pnpm --filter api run migrate:tenants -- --file=supabase/migrations/20260807000002_add_homework.sql
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load env from apps/api/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

// Parse --file argument
const fileArg = process.argv.find((a) => a.startsWith('--file='));
if (!fileArg) {
    console.error('❌  Usage: migrate:tenants -- --file=<path-to-sql>');
    process.exit(1);
}

const sqlFilePath = path.resolve(process.cwd(), fileArg.replace('--file=', ''));
if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌  SQL file not found: ${sqlFilePath}`);
    process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');
console.log(`\n📄  Migration file: ${sqlFilePath}`);
console.log(`    SQL preview: ${sqlContent.slice(0, 120).replace(/\n/g, ' ')}...\n`);

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

interface TenantRow {
    slug: string;
}

async function run(): Promise<void> {
    // 1. Fetch all ACTIVE tenant slugs
    const { data: tenants, error } = await adminClient
        .from('tenants')
        .select('slug')
        .eq('status', 'ACTIVE')
        .returns<TenantRow[]>();

    if (error) {
        console.error('❌  Failed to fetch tenants:', error.message);
        process.exit(1);
    }

    if (!tenants || tenants.length === 0) {
        console.warn('⚠️   No ACTIVE tenants found — nothing to migrate.');
        return;
    }

    console.log(`🏫  Migrating ${tenants.length} tenant(s)...\n`);

    const results: Array<{ slug: string; ok: boolean; error?: string }> = [];

    for (const tenant of tenants) {
        const schemaName = `tenant_${tenant.slug}`;
        // Wrap SQL inside a SET search_path block so it runs in the right schema
        const wrappedSql = `
SET search_path TO "${schemaName}";
${sqlContent}
RESET search_path;
        `.trim();

        try {
            const { error: execError } = await adminClient.rpc('exec_sql', {
                sql: wrappedSql,
            });

            if (execError) {
                results.push({ slug: tenant.slug, ok: false, error: execError.message });
                console.error(`  ✗ ${schemaName}: ${execError.message}`);
            } else {
                results.push({ slug: tenant.slug, ok: true });
                console.log(`  ✓ ${schemaName}`);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            results.push({ slug: tenant.slug, ok: false, error: msg });
            console.error(`  ✗ ${schemaName}: ${msg}`);
        }
    }

    const failures = results.filter((r) => !r.ok);
    console.log(`\n──────────────────────────────────`);
    console.log(`✅  ${results.length - failures.length}/${results.length} succeeded`);

    if (failures.length > 0) {
        console.error(`❌  ${failures.length} tenant(s) failed migration:`);
        failures.forEach((f) => console.error(`    • ${f.slug}: ${f.error}`));
        process.exit(1);
    }

    console.log('Migration complete.\n');
}

void run();
