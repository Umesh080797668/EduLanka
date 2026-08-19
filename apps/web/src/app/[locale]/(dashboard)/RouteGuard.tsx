'use client';
import { authManager } from '@/lib/auth-store';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from '@/i18n/routing';
import { Loader2 } from 'lucide-react';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        let mounted = true;
        Promise.resolve().then(() => {
            if (!mounted) return;
            const role = authManager.getRole()?.toUpperCase();
            const token = authManager.getToken();

            if (!token || !role) {
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
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return <>{children}</>;
}
