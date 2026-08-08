import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Sign In',
    description: 'Sign in to your EduLanka school dashboard.',
};

/**
 * Auth route group layout.
 * Provides a centered, brand-consistent shell for login / forgot-password pages.
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen grid place-items-center bg-[var(--color-surface-2)]">
            <main className="w-full max-w-md px-4 py-10">{children}</main>
        </div>
    );
}
