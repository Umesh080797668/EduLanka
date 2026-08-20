import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/modules/supabase/supabase.service';
import { UserRole, TenantStatus, TenantPlan } from '@edu-lanka/shared-types';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const supabase = app.get(SupabaseService);

    console.log('Bootstrapping System Admin (SUPER_ADMIN) account...');

    try {
        // 1. Ensure a "System" tenant exists to hold the global admin
        let rootTenantId = 'a1b2c3d4-0000-0000-0000-000000000000';
        let tenantSlug = 'system_root';

        const { data: existingTenant } = await supabase.adminClient
            .from('tenants')
            .select('id, slug, status')
            .eq('slug', tenantSlug)
            .maybeSingle();

        if (!existingTenant) {
            console.log('Creating Root System Tenant...');
            const { data: newTenant, error: tErr } = await supabase.adminClient
                .from('tenants')
                .insert({
                    id: rootTenantId,
                    name: 'System Administration',
                    slug: tenantSlug,
                    plan: TenantPlan.COMMUNITY,
                    status: TenantStatus.ACTIVE,
                    school_type: 'TYPE_1AB' as any,
                    contact_email: 'admin@edulanka.lk',
                })
                .select()
                .single();

            if (tErr) throw new Error(`Tenant Insert Failed: ${tErr.message}`);

            console.log('Running Sprint 6 Schema Provisioning for Root...');
            const { error: rpcErr } = await supabase.adminClient.rpc('create_tenant_schema_sprint6_override', {
                p_slug: tenantSlug
            });
            if (rpcErr) throw new Error(`Schema Provisioning Failed: ${rpcErr.message}`);

            console.log('Reloading PostgREST cache...');
            await supabase.adminClient.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema'" });
            await new Promise((r) => setTimeout(r, 6000));

            rootTenantId = newTenant.id;
        } else {
            rootTenantId = existingTenant.id;
            tenantSlug = existingTenant.slug;
            console.log(`Root Tenant found: ${rootTenantId}`);
        }

        // 2. Create the Supabase Global Auth User
        const email = 'superadmin@edulanka.lk';
        const password = process.env.INITIAL_SUPER_ADMIN_PASSWORD || 'SystemAdmin123!';

        let authUid: string;
        const { data: existingAuth } = await supabase.adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: 'Global System Admin', tenant_id: rootTenantId },
        });

        if (existingAuth?.user?.id) {
            authUid = existingAuth.user.id;
            console.log('Created new auth user identity.');
        } else {
            // Already exists, fetch ID
            const { data: usersData } = await supabase.adminClient.auth.admin.listUsers();
            const matched = usersData.users.find(u => u.email === email);
            if (!matched) throw new Error('Could not create or find auth user.');
            authUid = matched.id;
            console.log('Utilizing existing auth identity.');
        }

        // 3. Bind Role inside the Tenant schema using exec_sql to bypass PostgREST unexposed schema issues
        const insertSql = `
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM "tenant_${tenantSlug}".users WHERE user_id = '${authUid}') THEN
                    INSERT INTO "tenant_${tenantSlug}".users (user_id, email, full_name, role, is_active)
                    VALUES ('${authUid}', '${email}', 'Global System Administrator', '${UserRole.SUPER_ADMIN}', true);
                END IF;
            END
            $$;
        `;
        const { error: insertErr } = await supabase.adminClient.rpc('exec_sql', { sql: insertSql });
        if (insertErr) throw new Error(`Failed binding user in schema via SQL: ${insertErr.message}`);
        console.log('User identity successfully bound as SUPER_ADMIN.');

        console.log(`
✅ SYSTEM BOOTSTRAP SUCCESSFUL
------------------------------
Login URL: /en/login
Tenant ID: ${rootTenantId}
Email    : ${email}
Password : ${password}
------------------------------
`);

    } catch (e: any) {
        console.error('❌ Bootstrap Failed:', e.message);
    } finally {
        await app.close();
    }
}

bootstrap();
