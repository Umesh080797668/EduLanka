const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/api/.env' });

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { headers: { 'x-tenant-id': 'a1b2c3d4-0000-0000-0000-000000000001' } }
});

async function run() {
    console.log("Fetching users payload...");
    const { data: users, error: err1 } = await client.from('users').select('*').limit(1);
    console.log("Users:", users);

    console.log("Fetching classes payload...");
    const { data: classes, error: err2 } = await client.from('classes').select('*').limit(1);
    console.log("Classes:", classes);
}
run();
