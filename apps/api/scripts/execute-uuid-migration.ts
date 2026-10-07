import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const mapPath = path.resolve(__dirname, '../../../docs/uuid-migration-map.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

async function finishMigration() {
    console.log('--- Finishing Database Migration ---');

    const newSchoolTenantId = map.tenants['a1b2c3d4-0000-0000-0000-000000000001'];
    const newStudentId = map.students['d0000000-0000-0000-0000-000000000001'];
    const studentUserId = map.users['b0000000-0000-0000-0000-000000000003'];
    const parentUserId = map.users['b0000000-0000-0000-0000-000000000004'];
    const class10A = map.classes['c0000000-0000-0000-0000-000000000001'];

    // 1. Restore/Insert students
    console.log('1. Inserting students...');
    const studentsToInsert = [
        {
            id: newStudentId,
            tenant_id: newSchoolTenantId,
            user_id: studentUserId,
            class_id: class10A,
            admission_no: 'DS-2026-001',
            al_stream: null,
            date_of_birth: '2010-03-15',
            gender: 'MALE',
            enrolled_at: '2026-08-12',
        },
        {
            id: 'e826d59b-aba3-4f74-9b6d-83d51c67bb62',
            tenant_id: newSchoolTenantId,
            user_id: '9d6aa21c-3f5d-4e4b-9f77-0cdc8b61b9c5',
            class_id: null,
            admission_no: '2026/7330',
            al_stream: null,
            date_of_birth: '2019-06-18',
            gender: 'MALE',
            enrolled_at: '2026-08-18',
        },
    ];

    for (const s of studentsToInsert) {
        const { error: sErr } = await supabase.from('students').upsert(s);
        if (sErr) console.error(`Student insert error:`, sErr);
        else console.log(`  Student ${s.admission_no} inserted with ID: ${s.id}`);
    }

    // 2. Restore/Insert parent
    console.log('2. Inserting parents...');
    const { error: pErr } = await supabase.from('parents').upsert({
        id: '398add9b-e357-41c5-b970-0685658b72fe',
        tenant_id: newSchoolTenantId,
        user_id: parentUserId,
        student_id: newStudentId,
        relationship: 'FATHER',
    });
    if (pErr) console.error(`Parent insert error:`, pErr);
    else console.log('  Parent inserted successfully');

    // 3. Restore/Insert student_marks
    console.log('3. Inserting student_marks...');
    const { error: mErr } = await supabase.from('student_marks').upsert({
        id: '8c253b52-4966-4e73-9e61-5aab38284170',
        tenant_id: newSchoolTenantId,
        student_id: newStudentId,
        class_id: class10A,
        term: '1',
        subject: 'MATHEMATICS',
        marks: 60,
        total_score: 60,
        grade: null,
    });
    if (mErr) console.error(`Marks insert error:`, mErr);
    else console.log('  Student marks inserted successfully');

    // 4. Migrate tutorials cleanly
    console.log('4. Migrating tutorials...');
    for (const [oldTutId, newTutId] of Object.entries(map.tutorials)) {
        const { data: tut } = await supabase.from('tutorials').select('*').eq('id', oldTutId).maybeSingle();
        if (tut) {
            // Temporarily rename screen_id on old tutorial to avoid unique violation
            await supabase.from('tutorials').update({ screen_id: `${tut.screen_id}_migrating` }).eq('id', oldTutId);

            const { error: insTutErr } = await supabase.from('tutorials').insert({
                ...tut,
                id: newTutId,
                screen_id: tut.screen_id,
            });
            if (insTutErr) {
                console.error(`Insert tutorial ${newTutId} failed:`, insTutErr);
                continue;
            }

            // Repoint steps
            await supabase.from('tutorial_steps').update({ tutorial_id: newTutId }).eq('tutorial_id', oldTutId);
            // Delete old tutorial
            await supabase.from('tutorials').delete().eq('id', oldTutId);
            console.log(`  Tutorial ${oldTutId} -> ${newTutId}`);
        }
    }

    // 5. Update auth user metadata
    console.log('5. Updating Supabase Auth user metadata...');
    const { data: authUsers, error: listAuthErr } = await supabase.auth.admin.listUsers();
    if (listAuthErr) throw new Error(`List auth users failed: ${listAuthErr.message}`);

    for (const u of authUsers.users) {
        if (u.user_metadata?.tenant_id === 'a1b2c3d4-0000-0000-0000-000000000001') {
            await supabase.auth.admin.updateUserById(u.id, {
                user_metadata: {
                    ...u.user_metadata,
                    tenant_id: newSchoolTenantId,
                },
            });
            console.log(`  Auth user ${u.email} tenant_id metadata updated to ${newSchoolTenantId}`);
        }
    }

    console.log('--- Database Migration Finished Successfully! ---');
}

finishMigration().catch(console.error);
