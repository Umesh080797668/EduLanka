'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        let mounted = true;
        Promise.resolve().then(() => {
            if (!mounted) return;
            const token = localStorage.getItem('token');
            const role = localStorage.getItem('role')?.toUpperCase();

            if (!token || !role) {
                router.replace('/login');
                return;
            }

            // Basic RBAC enforcing client side routes
            if (pathname && pathname !== '/dashboard') {
                if (pathname.startsWith('/institution-admin') && role !== 'ADMIN') {
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
