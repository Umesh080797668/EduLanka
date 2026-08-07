import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In',
};

/**
 * TODO (Phase 1): Wire up Supabase Auth form with server action.
 * This is a stub login page — styling and logic added in Phase 1 sprint.
 */
export default function LoginPage() {
    return (
        <div
            style={{
                background: 'white',
                borderRadius: 'var(--radius-card)',
                boxShadow: 'var(--shadow-card)',
                padding: '2rem',
            }}
        >
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'oklch(0.15 0 0)' }}>
                    EduLanka
                </h1>
                <p style={{ marginTop: '0.5rem', color: 'oklch(0.45 0 0)', fontSize: '0.9rem' }}>
                    Sign in to your school dashboard
                </p>
            </div>

            {/* Form shell — populated in Phase 1 */}
            <form style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@school.lk"
                        style={{
                            marginTop: '0.25rem',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid oklch(0.88 0 0)',
                            borderRadius: 'var(--radius-input)',
                            fontSize: '0.9rem',
                            outline: 'none',
                        }}
                    />
                </div>

                <div>
                    <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500 }}>
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        style={{
                            marginTop: '0.25rem',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            border: '1px solid oklch(0.88 0 0)',
                            borderRadius: 'var(--radius-input)',
                            fontSize: '0.9rem',
                            outline: 'none',
                        }}
                    />
                </div>

                <button
                    type="submit"
                    style={{
                        marginTop: '0.5rem',
                        padding: '0.625rem',
                        background: 'var(--color-brand-500)',
                        color: 'white',
                        borderRadius: 'var(--radius-input)',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                    }}
                >
                    Sign In
                </button>
            </form>
        </div>
    );
}
