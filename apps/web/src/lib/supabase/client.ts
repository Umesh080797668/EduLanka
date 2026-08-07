import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client.
 * Used in Client Components for auth state, realtime, and public queries.
 *
 * Do NOT use for privileged operations — those use the service role key on the server.
 */
export function createSupabaseBrowserClient() {
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables',
        );
    }

    return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
