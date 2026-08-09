import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/modules/supabase/supabase.service';
import { UserRole, TenantStatus, TenantPlan } from '@edu-lanka/shared-types';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const supabase = app.get(SupabaseService);

    console.log('Bootstrapping Pilot School for Staging...');

    try {
        let pilotTenantId = 'a1b2c3d4-0000-0000-0000-000000000001';
        let tenantSlug = 'dev-school';

        const { data: existingTenant } = await supabase.adminClient
            .from('tenants')
            .select('id, slug')
            .eq('slug', tenantSlug)
            .maybeSingle();

        if (!existingTenant) {
            console.log('Creating Pilot School Tenant...');
            const { data: newTenant, error: tErr } = await supabase.adminClient
                .from('tenants')
                .insert({
                    id: pilotTenantId,
                    name: 'Staging Pilot School',
                    slug: tenantSlug,
                    plan: TenantPlan.PRO,
                    status: TenantStatus.ACTIVE,
                    school_type: 'TYPE_2' as any,
                    contact_email: 'pilot@edulanka.lk',
                })
                .select()
                .single();

            if (tErr) throw new Error(`Tenant Insert Failed: ${tErr.message}`);

            console.log('Running Schema Provisioning for Pilot School...');
            const { error: rpcErr } = await supabase.adminClient.rpc('create_tenant_schema_sprint6_override', {
                p_slug: tenantSlug
            });
            if (rpcErr) throw new Error(`Schema Provisioning Failed: ${rpcErr.message}`);

            pilotTenantId = newTenant.id;
        } else {
            pilotTenantId = existingTenant.id;
            console.log(`Pilot School Tenant found: ${pilotTenantId}`);
        }

        const roles = [
            { email: 'admin@pilot.edulanka.lk', role: UserRole.SCHOOL_ADMIN, name: 'Pilot Admin' },
            { email: 'teacher@pilot.edulanka.lk', role: UserRole.TEACHER, name: 'Pilot Teacher' },
            { email: 'student@pilot.edulanka.lk', role: UserRole.STUDENT, name: 'Pilot Student' },
            { email: 'parent@pilot.edulanka.lk', role: UserRole.PARENT, name: 'Pilot Parent' },
        ];

        const tenantClient = supabase.getTenantClient(tenantSlug);
        const password = 'PilotUser123!';

        for (const u of roles) {
            let authUid: string;
            const { data: existingAuth } = await supabase.adminClient.auth.admin.createUser({
                email: u.email,
                password,
                email_confirm: true,
                user_metadata: { full_name: u.name, tenant_id: pilotTenantId },
            });

            if (existingAuth?.user?.id) {
                authUid = existingAuth.user.id;
            } else {
                const { data: usersData } = await supabase.adminClient.auth.admin.listUsers();
                const matched = usersData.users.find(usr => usr.email === u.email);
                if (!matched) throw new Error(`User auth identity not found for ${u.email}`);
                authUid = matched.id;

                // Force update user metadata to ensure tenant_id matches
                await supabase.adminClient.auth.admin.updateUserById(authUid, {
                    user_metadata: { full_name: u.name, tenant_id: pilotTenantId }
                });
            }

            const { data: existingUser } = await tenantClient.from('users').select('id').eq('auth_uid', authUid).maybeSingle();
            if (!existingUser) {
                await tenantClient.from('users').insert({
                    auth_uid: authUid,
                    email: u.email,
                    full_name: u.name,
                    role: u.role,
                    is_active: true
                });
                console.log(`Provisioned ${u.role}: ${u.email}`);
            }
        }

        console.log(`✅ PILOT STAGING BOOTSTRAP SUCCESSFUL (Password for all: ${password})`);

    } catch (e: any) {
        console.error('❌ Bootstrap Failed:', e.message);
    } finally {
        await app.close();
    }
}

bootstrap();
