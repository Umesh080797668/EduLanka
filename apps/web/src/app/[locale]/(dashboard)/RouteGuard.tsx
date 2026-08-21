'use client';
import { authManager } from '@/lib/auth-store';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';

import { FullPageSpinner } from '@/components/ui/Spinner';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        let mounted = true;
        Promise.resolve().then(() => {
            if (!mounted) return;
            const role = authManager.getRole()?.toUpperCase();
            const isAuthenticated = typeof window !== 'undefined' ? localStorage.getItem('isAuthenticated') === 'true' : false;

            if (!isAuthenticated || !role) {
                router.replace('/login');
                return;
            }

            // Basic RBAC enforcing client side routes
            if (pathname && pathname !== '/dashboard') {
                if (pathname.startsWith('/institution-admin') && role !== 'SCHOOL_ADMIN') {
                    router.replace('/dashboard');
                    return;
                }
                if (pathname.startsWith('/system-admin') && role !== 'SUPER_ADMIN') {
                    router.replace('/dashboard');
                    return;
                }
                if (pathname.startsWith('/teacher') && role !== 'TEACHER') {
                    router.replace('/dashboard');
                    return;
                }
                if (pathname.startsWith('/student') && role !== 'STUDENT') {
                    router.replace('/dashboard');
                    return;
                }
                if (pathname.startsWith('/parent') && role !== 'PARENT') {
                    router.replace('/dashboard');
                    return;
                }
            }

            setAuthorized(true);
        });

        return () => { mounted = false; };
    }, [pathname, router]);

    if (!authorized) {
        return <FullPageSpinner />;
    }

    return <>{children}</>;
}
