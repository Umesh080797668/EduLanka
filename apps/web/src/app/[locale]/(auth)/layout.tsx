import type { Metadata } from 'next';
import { GraduationCap } from 'lucide-react';

import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
    title: 'Sign In',
    description: 'Sign in to your EduLanka school dashboard.',
};

/**
 * Auth route group layout — centered card shell with the brand mark, a soft
 * radial glow behind it, and locale/theme controls always reachable.
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative isolate flex min-h-dvh flex-col bg-background">
            {/* Ambient brand glow. Purely decorative. */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] hero-glow"
            />

            <header className="flex items-center justify-between px-4 py-5 sm:px-8">
                <span className="flex items-center gap-2.5">
                    <span className="grid size-9 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-xs">
                        <GraduationCap className="size-5" />
                    </span>
                    <span className="text-[17px] font-bold tracking-tight text-foreground">
                        EduLanka
                    </span>
                </span>

                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                    <ThemeToggle variant="icon" />
                </div>
            </header>

            <main
                id="main-content"
                tabIndex={-1}
                className="flex flex-1 items-center justify-center px-4 pb-16 pt-2 sm:px-6"
            >
                <div className="w-full max-w-md animate-fade-in">{children}</div>
            </main>

            <footer className="px-4 pb-6 text-center text-xs text-muted-foreground sm:px-8">
                &copy; {new Date().getFullYear()} EduLanka · Sri Lanka
            </footer>
        </div>
    );
}
