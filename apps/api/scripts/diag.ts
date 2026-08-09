import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

async function check() {
    const { data: schemas, error: err1 } = await supabase.rpc('exec_sql', { sql: "SELECT schema_name FROM information_schema.schemata;" });
    console.log("Schemas:", schemas, err1);

    const { data: dbConf, error: err2 } = await supabase.rpc('exec_sql', { sql: "SHOW search_path;" });
    console.log("Search Path:", dbConf, err2);

    // Check if dev-school has users
    const { data: devUsers, error: err3 } = await supabase.rpc('exec_sql', { sql: "SELECT * FROM \"tenant_dev-school\".users;" });
    console.log("Dev School Users:", devUsers, err3);
}
check();
