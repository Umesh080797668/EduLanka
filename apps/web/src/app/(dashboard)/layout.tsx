import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard',
};

/**
 * Dashboard route group layout.
 * Provides the shared sidebar + header shell for all protected portal routes.
 *
 * TODO (Phase 1): Add server-side session check; redirect if unauthenticated.
 */
export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // TODO (Phase 1): const session = await getServerSession(); if (!session) redirect('/login');
    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Sidebar placeholder */}
            <aside
                style={{
                    width: '240px',
                    background: 'var(--color-brand-900)',
                    color: 'white',
                    padding: '1.5rem 1rem',
                    flexShrink: 0,
                }}
            >
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '2rem' }}>
                    EduLanka
                </div>
                <nav>
                    <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Navigation
                    </p>
                    {/* Nav items populated in Phase 1 */}
                    <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>← Phase 1</p>
                </nav>
            </aside>

            {/* Main content area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header
                    style={{
                        height: '60px',
                        borderBottom: '1px solid oklch(0.91 0 0)',
                        padding: '0 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'white',
                    }}
                >
                    <span style={{ fontSize: '0.875rem', color: 'oklch(0.45 0 0)' }}>
                        EduLanka Dashboard
                    </span>
                </header>

                <main style={{ flex: 1, padding: '1.5rem', background: 'var(--color-surface-2)' }}>
                    {children}
                </main>
            </div>
        </div>
    );
}
