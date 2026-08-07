import { redirect } from 'next/navigation';

/**
 * Root page — redirects authenticated users to dashboard,
 * unauthenticated users to login.
 *
 * TODO (Phase 1): Check Supabase session and route accordingly.
 */
export default function RootPage() {
    redirect('/login');
}
