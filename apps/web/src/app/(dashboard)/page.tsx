import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard Home',
};

/**
 * Dashboard home page.
 * TODO (Phase 1): Display role-appropriate summary cards (attendance, notices, grades).
 */
export default function DashboardPage() {
    return (
        <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
                Welcome to EduLanka
            </h1>
            <p style={{ color: 'oklch(0.45 0 0)', fontSize: '0.9rem' }}>
                Your dashboard is being set up. Core modules ship in Phase 1.
            </p>
        </div>
    );
}
