'use client';

import { useEffect } from 'react';
import { GraduationCap } from 'lucide-react';

import { useRouter } from '@/i18n/routing';
import { authManager } from '@/lib/auth-store';
import { Spinner } from '@/components/ui/Spinner';

export default function RootPage() {
    const router = useRouter();

    useEffect(() => {
        // The JWT lives in an httpOnly cookie, so the client can only check for the
        // marker the login flow wrote alongside it.
        const authenticated =
            authManager.getToken() || localStorage.getItem('isAuthenticated') === 'true';
        router.replace(authenticated ? '/dashboard' : '/login');
    }, [router]);

    return (
        <div className="relative isolate grid min-h-dvh place-items-center bg-background">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] hero-glow"
            />
            <div className="flex flex-col items-center gap-5">
                <span className="grid size-12 place-items-center rounded-card bg-primary text-primary-foreground shadow-card">
                    <GraduationCap className="size-6" />
                </span>
                <p className="text-lg font-bold tracking-tight text-foreground">EduLanka</p>
                <Spinner size="sm" />
            </div>
        </div>
    );
}
